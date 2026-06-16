"""Application entry point."""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import secrets
import signal
import sys
import threading
import webbrowser
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from bumeet_agent.tray.icon import TrayIcon

import aiohttp

from bumeet_agent.bootstrap import build_container
from bumeet_agent.config import ApiSettings, AppSettings, BleSettings, SettingsStore
from bumeet_agent.detection.base import HardwareDetector
from bumeet_agent.detection.service import AgentOrchestrator
from bumeet_agent.events.models import AgentEvent, EventTopic
from bumeet_agent.logging import configure_logging, get_logger
from bumeet_agent.simulation import run_simulation_session

logger = get_logger(__name__)

# Lifecycle/state events worth surfacing at INFO; everything else (e.g. the ~2 s
# detection.updated polls) stays at DEBUG to keep the log readable.
_INFO_LOG_TOPICS = frozenset(
    {
        EventTopic.APP_STARTED.value,
        EventTopic.BLE_CONNECTED.value,
        EventTopic.BLE_DISCONNECTED.value,
        EventTopic.BLE_ERROR.value,
        EventTopic.BLE_PAYLOAD_SENT.value,
        EventTopic.OCCUPANCY_CHANGED.value,
    }
)


def _build_detector(poll_interval: float) -> HardwareDetector:
    """Return the platform-appropriate hardware detector."""
    if sys.platform == "darwin":
        from bumeet_agent.detection.macos import MacOSHardwareDetector

        return MacOSHardwareDetector(poll_interval=poll_interval)
    if sys.platform == "win32":
        from bumeet_agent.detection.windows import WindowsHardwareDetector

        return WindowsHardwareDetector()
    raise RuntimeError(f"No hardware detector available for platform: {sys.platform}")


async def _fetch_remote_ble_config(api: ApiSettings) -> BleSettings | None:
    """Fetch BLE device config from the BUMEET API. Returns None on failure."""
    url = f"{api.url}/agent/config"
    headers = {"x-agent-key": api.token}
    try:
        async with aiohttp.ClientSession(headers=headers) as session:  # noqa: SIM117
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status != 200:
                    return None
                data: dict[str, Any] = await resp.json()
                ble_data: dict[str, Any] = data.get("ble") or {}
                addr: str = ble_data.get("deviceAddress") or ""
                uuid: str = ble_data.get("characteristicUuid") or ""
                if addr and uuid:
                    encoding: str = data.get("encoding") or "text"
                    return BleSettings(
                        device_address=addr,
                        characteristic_uuid=uuid,
                        payload_encoding=encoding,  # type: ignore[arg-type]
                        busy_payload=str(data.get("payloadBusy") or "BUSY"),
                        free_payload=str(data.get("payloadFree") or "FREE"),
                    )
    except Exception as exc:
        logger.debug("Could not fetch remote BLE config: %s", exc)
    return None


_BUMEET_SERVICE_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567891"
_BUMEET_CHAR_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567892"


async def _auto_discover_ble(tray: TrayIcon | None) -> BleSettings | None:
    """Scan for BUMEET displays by service UUID and auto-configure if exactly one is found."""
    from bleak import BleakScanner  # noqa: PLC0415

    logger.info("No BLE config found — scanning for BUMEET display (10 s)…")
    if tray is not None:
        tray.set_payload("BUMEET · Scanning…")

    try:
        devices = await BleakScanner.discover(
            timeout=10.0,
            service_uuids=[_BUMEET_SERVICE_UUID],
        )
    except Exception as exc:
        logger.warning("BLE scan failed: %s", exc)
        return None

    if not devices:
        logger.info(
            "No BUMEET display found nearby. "
            "Configure the BLE address in the dashboard: https://app.bumeet.es/device"
        )
        if tray is not None:
            tray.set_payload("BUMEET · No display found")
        return None

    if len(devices) > 1:
        addrs = ", ".join(d.address for d in devices)
        logger.warning(
            "Multiple BUMEET displays found (%s). "
            "Select one in the dashboard: https://app.bumeet.es/device",
            addrs,
        )
        if tray is not None:
            tray.set_payload("BUMEET · Select display")
        return None

    device = devices[0]
    logger.info(
        "BUMEET display found: %s (%s). Configuring automatically.",
        device.name or "unnamed",
        device.address,
    )
    return BleSettings(
        device_address=device.address,
        characteristic_uuid=_BUMEET_CHAR_UUID,
    )


_PAIR_ALPHABET = "BCDFGHJKMNPQRSTVWXYZ2345689"
_PAIR_TTL = 300  # seconds


def _generate_pairing_code() -> str:
    return "".join(secrets.choice(_PAIR_ALPHABET) for _ in range(6))


async def _pair_with_portal(api: ApiSettings, settings_store: SettingsStore) -> bool:
    """Show a pairing code, wait for the user to approve it in the portal.

    Returns True if pairing succeeded and the token was saved to disk.
    """
    code = _generate_pairing_code()
    register_url = f"{api.url}/agent/pair/register"
    status_url = f"{api.url}/agent/pair/status"

    # Single shared session for both the register call and the status poll.
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(
                register_url,
                json={"code": code},
                timeout=aiohttp.ClientTimeout(total=5),
            ) as resp:
                if resp.status not in (200, 201):
                    logger.warning("Could not register pairing code (HTTP %s)", resp.status)
                    return False
        except Exception as exc:
            logger.warning("Could not reach API to register pairing code: %s", exc)
            return False

        # Open browser — portal will auto-approve if the user is logged in
        portal_url = f"https://app.bumeet.es/device?pair={code}"
        webbrowser.open(portal_url)

        print("\n" + "=" * 50)
        print("  BUMEET — linking to your account…")
        print("=" * 50)
        print("\n  A browser window has opened. Log in if needed.")
        print("  The agent will link automatically once you're logged in.")
        print(f"\n  Manual fallback code: {code}")
        print("\n  Waiting… (expires in 5 min)")
        print("=" * 50 + "\n")

        deadline = asyncio.get_running_loop().time() + _PAIR_TTL
        while asyncio.get_running_loop().time() < deadline:
            await asyncio.sleep(5)
            try:
                async with session.get(
                    status_url,
                    params={"code": code},
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    if resp.status != 200:
                        continue
                    data: dict[str, Any] = await resp.json()
                    status: str = data.get("status", "pending")
                    if status == "approved":
                        token: str = data.get("token", "")
                        if token:
                            current = settings_store.load()
                            updated = current.model_copy(
                                update={"api": current.api.model_copy(update={"token": token})}
                            )
                            settings_store.save(updated)
                            print("\n✓ Agent linked successfully!\n")
                            return True
                    elif status == "expired":
                        break
            except Exception:
                pass

    print("\n  Code expired. Restart the agent to try again.\n")
    return False


async def run(
    config_path: Path | None = None,
    *,
    simulate: bool = False,
    scenario: str = "default",
    delay_scale: float = 1.0,
    tray: TrayIcon | None = None,
) -> int:
    if simulate:

        async def log_event(event: AgentEvent) -> None:
            # Payloads can contain meeting details (PII) — keep them at DEBUG.
            logger.debug("event=%s payload=%s", event.topic, event.payload)

        result = await run_simulation_session(
            config_path=config_path,
            scenario=scenario,
            delay_scale=delay_scale,
            event_consumer=log_event,
        )
        return result.exit_code

    # Self-install as a startup service on first run (frozen binary only; no-op from source).
    from bumeet_agent.autostart import ensure_autostart  # noqa: PLC0415

    ensure_autostart()

    # Load settings. If no API token yet, run the pairing flow first.
    store = SettingsStore(config_path)
    settings = store.load()

    default_api_url = AppSettings().api.url
    if not settings.api.is_configured:
        if tray is not None:
            tray.set_payload("BUMEET · Pairing…")
        api_for_pairing = settings.api.model_copy(update={"url": default_api_url})
        paired = await _pair_with_portal(api_for_pairing, store)
        if not paired:
            return 1
        settings = store.load()  # reload with saved token

    # BLE config: try portal first, then auto-discover via BLE scan.
    if not settings.ble.is_configured:
        remote_ble = await _fetch_remote_ble_config(settings.api)
        if remote_ble:
            logger.info("BLE config loaded from portal: %s", remote_ble.device_address)
            settings = settings.model_copy(update={"ble": remote_ble})
        else:
            discovered = await _auto_discover_ble(tray)
            if discovered:
                settings = settings.model_copy(update={"ble": discovered})
                store.save(settings)

    container = build_container(config_path, settings_override=settings)

    async def _log_container_event(event: AgentEvent) -> None:
        if event.topic in _INFO_LOG_TOPICS:
            logger.info("event=%s payload=%s", event.topic, event.payload)
        else:
            logger.debug("event=%s payload=%s", event.topic, event.payload)

    await container.event_bus.subscribe("*", _log_container_event)

    if tray is not None:

        async def _on_ble_payload(event: AgentEvent) -> None:
            hex_str: str = event.payload.get("payload_hex", "")
            try:
                text = bytes.fromhex(hex_str).decode("utf-8")
            except (ValueError, UnicodeDecodeError):
                return
            if text.startswith(("FREE", "BUSY", "UPCOMING")):
                tray.set_payload(f"BUMEET · {text}")

        async def _on_ble_disconnected(event: AgentEvent) -> None:
            tray.set_payload("BUMEET · Disconnected")

        async def _on_ble_connected(event: AgentEvent) -> None:
            tray.set_payload("BUMEET · Connected")

        await container.event_bus.subscribe(EventTopic.BLE_PAYLOAD_SENT.value, _on_ble_payload)
        await container.event_bus.subscribe(EventTopic.BLE_DISCONNECTED.value, _on_ble_disconnected)
        await container.event_bus.subscribe(EventTopic.BLE_CONNECTED.value, _on_ble_connected)

    await container.event_bus.emit(
        EventTopic.APP_STARTED.value,
        config_path=str(container.settings_store.path),
        ble_configured=container.settings.ble.is_configured,
        simulate=False,
    )

    orchestrator = AgentOrchestrator(
        event_bus=container.event_bus,
        state_machine=container.state_machine,
        ble_client=container.ble_client,
        api_settings=container.settings.api,
    )
    detector = _build_detector(poll_interval=container.settings.runtime.poll_interval_seconds)

    if container.settings.runtime.auto_connect_on_start and container.settings.ble.is_configured:
        await container.ble_client.connect()

    await container.ble_client.start_persistent_connection()
    await orchestrator.start_api_polling()

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()

    def _request_stop() -> None:
        loop.call_soon_threadsafe(stop_event.set)

    if tray is not None:
        tray.register_quit(_request_stop)

    try:
        loop.add_signal_handler(signal.SIGINT, _request_stop)
        loop.add_signal_handler(signal.SIGTERM, _request_stop)
    except (NotImplementedError, RuntimeError, ValueError):
        # NotImplementedError/ValueError: Windows loop or non-main thread (tray owns it).
        # Fall back to signal.signal — also suppressed when not in main thread.
        def _signal_stop(*_: Any) -> None:
            _request_stop()

        for _sig in (signal.SIGINT, getattr(signal, "SIGBREAK", signal.SIGTERM)):
            with contextlib.suppress(ValueError, OSError):
                signal.signal(_sig, _signal_stop)

    detection_task = asyncio.create_task(detector.start(orchestrator.handle_snapshot))
    try:
        # Ctrl-C / Ctrl-Break: swallow so the finally cleanup below still runs.
        with contextlib.suppress(KeyboardInterrupt, asyncio.CancelledError):
            await stop_event.wait()
    finally:
        await detector.stop()
        try:
            await asyncio.wait_for(detection_task, timeout=3.0)
        except (TimeoutError, asyncio.CancelledError):
            detection_task.cancel()
        await orchestrator.stop_api_polling()
        await container.event_bus.emit(EventTopic.APP_STOPPING.value)
        await container.ble_client.stop_persistent_connection()

    return 0


async def _scan_ble() -> None:
    """Discover nearby BLE devices and print their addresses (for onboarding)."""
    from bleak import BleakScanner  # noqa: PLC0415

    print("Scanning for BLE devices (10 s)…", flush=True)
    devices = await BleakScanner.discover(timeout=10.0)
    if not devices:
        print(
            "\nNo devices found.\n"
            "Make sure your BUMEET display is powered on and not already connected to another host."
        )
        return
    print(f"\nFound {len(devices)} device(s):\n")
    for d in sorted(devices, key=lambda x: getattr(x, "rssi", -999) or -999, reverse=True):
        name = d.name or "(unnamed)"
        rssi = getattr(d, "rssi", "?")
        print(f"  {d.address}  {name}  (RSSI {rssi} dBm)")
    print("\nCopy your BUMEET display's address into the Device settings page.")


def main() -> int:
    parser = argparse.ArgumentParser(description="BUMEET local agent")
    parser.add_argument(
        "--config", type=Path, default=None, help="Path to the local settings JSON file"
    )
    parser.add_argument(
        "--scan", action="store_true", help="Scan for nearby BLE devices and print their addresses"
    )
    parser.add_argument(
        "--simulate", action="store_true", help="Run a full offline simulation without BLE hardware"
    )
    parser.add_argument(
        "--scenario",
        choices=["default", "bounce", "camera-only"],
        default="default",
        help="Simulation scenario to execute when --simulate is enabled",
    )
    parser.add_argument(
        "--delay-scale",
        type=float,
        default=1.0,
        help="Scale factor for simulation delays; use 0 for near-instant runs",
    )
    parser.add_argument(
        "--simulate-ui", action="store_true", help="Launch a desktop UI to visualize the simulation"
    )
    args = parser.parse_args()

    configure_logging()

    if args.scan:
        asyncio.run(_scan_ble())
        return 0

    if args.simulate_ui:
        from bumeet_agent.ui.simulator import launch_simulation_viewer  # noqa: PLC0415

        launch_simulation_viewer()
        return 0

    # Simulation mode: no tray (dev/test tool).
    if args.simulate:
        return asyncio.run(
            run(args.config, simulate=True, scenario=args.scenario, delay_scale=args.delay_scale)
        )

    # Production mode: system tray icon in the menu bar / notification area.
    try:
        from bumeet_agent.tray.icon import TrayIcon  # noqa: PLC0415

        tray: TrayIcon | None = TrayIcon()
    except ImportError:
        tray = None

    if tray is None:
        # Headless fallback (no pystray available).
        return asyncio.run(run(args.config))

    exit_code: list[int] = [0]
    done = threading.Event()

    def _async_main(icon: object) -> None:
        try:
            exit_code[0] = asyncio.run(run(args.config, tray=tray))
        finally:
            done.set()
            tray.stop()

    tray.start(_async_main)  # blocks this thread (AppKit on macOS, Win32 on Windows)
    done.wait(timeout=10.0)  # wait for asyncio cleanup before returning
    return exit_code[0]


if __name__ == "__main__":
    raise SystemExit(main())
