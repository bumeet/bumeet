"""BLE client wrapper around bleak."""

from __future__ import annotations

import asyncio
import shutil
from collections.abc import Callable
from typing import Any

from bumeet_agent.ble.protocol import PresenceState, payload_for_state
from bumeet_agent.config import BleSettings
from bumeet_agent.events.bus import AsyncEventBus
from bumeet_agent.events.models import EventTopic
from bumeet_agent.logging import get_logger

try:
    from bleak import BleakClient, BleakScanner
except Exception:  # pragma: no cover
    BleakClient = None  # type: ignore
    BleakScanner = None  # type: ignore

logger = get_logger(__name__)

_RECONNECT_INTERVAL_S = 5.0
# macOS CoreBluetooth drops idle BLE connections after ~45 s with no traffic.
# Sending a keepalive write every 20 s prevents this.
_KEEPALIVE_INTERVAL_S = 20.0
# Generous timeout so write_now survives the initial ~30 s scan+connect.
_WRITE_WAIT_S = 60.0
# After this many consecutive "not found" failures (~3 min at 15 s retry),
# toggle macOS Bluetooth to flush CoreBluetooth's stale device cache.
_BT_RESET_AFTER_FAILURES = 12
# Minimum spacing between Bluetooth resets. Without it, a display that is simply
# out of range (laptop taken home, dead battery) would power-cycle the user's
# whole BT stack — AirPods, keyboard, mouse — every ~3 min, indefinitely.
_BT_RESET_COOLDOWN_S = 30 * 60.0


class BleClient:
    """Async BLE GATT client with persistent connection and keepalive.

    Maintains a persistent background connection so state changes are
    delivered in <100 ms. Sends a keepalive write every 20 s to prevent
    macOS from dropping the idle link.
    """

    def __init__(
        self,
        settings: BleSettings,
        event_bus: AsyncEventBus,
        client_factory: Callable[[str], Any] | None = None,
    ) -> None:
        self._settings = settings
        self._event_bus = event_bus
        self._client_factory = client_factory or self._default_client_factory
        # A custom factory means a simulated/test backend — skip real RF scans.
        self._uses_custom_factory = client_factory is not None
        self._client: Any | None = None
        self._lock = asyncio.Lock()
        # Serializes every GATT write (keepalive, reconnect resync, send_payload)
        # so the keepalive can't interleave a stale payload after a fresh one.
        self._write_lock = asyncio.Lock()
        self._keep_connected = False
        self._connection_task: asyncio.Task[None] | None = None
        self._connected_event = asyncio.Event()
        # Set to wake the connection loop early (e.g. on a disconnect) instead of
        # busy-polling once per second.
        self._wake = asyncio.Event()
        self._last_payload: bytes = b""  # empty until first successful write
        # Monotonic time of the last successful GATT write (keepalive or real).
        # Shared across both paths so keepalive backs off after a real write.
        self._last_write_time: float = 0.0
        self._not_found_streak: int = 0
        self._last_bt_reset: float | None = None

    @property
    def is_connected(self) -> bool:
        return bool(self._client and getattr(self._client, "is_connected", False))

    # ── Persistent connection ─────────────────────────────────────────────────

    async def start_persistent_connection(self) -> None:
        """Start background task that keeps the BLE connection alive."""
        if not self._settings.is_configured:
            return
        self._keep_connected = True
        self._connection_task = asyncio.create_task(self._connection_loop())

    async def stop_persistent_connection(self) -> None:
        self._keep_connected = False
        if self._connection_task and not self._connection_task.done():
            self._connection_task.cancel()
        await self.disconnect()

    async def _connection_loop(self) -> None:
        """Reconnect on drops; send keepalive every 20 s to beat macOS idle timeout.

        Event-driven: sleeps until the next keepalive is due (≈20 s when idle)
        and wakes early via ``_wake`` on a disconnect, instead of polling at 1 Hz.
        """
        loop = asyncio.get_running_loop()
        while self._keep_connected:
            now = loop.time()
            sleep_for = _KEEPALIVE_INTERVAL_S

            if not self.is_connected:
                self._connected_event.clear()
                try:
                    await self.connect()
                    # Re-send current state after reconnect so the e-ink display is
                    # always in sync after a firmware reboot or BLE dropout.
                    # Skip on first connect (empty payload) so the API poll's
                    # write_now (waiting on _connected_event) is the first write.
                    assert self._client is not None
                    if self._last_payload:
                        async with self._write_lock:
                            await self._client.write_gatt_char(
                                self._settings.characteristic_uuid,
                                self._last_payload,
                                response=self._settings.write_with_response,
                            )
                        self._last_write_time = loop.time()
                        logger.debug("BLE reconnect sync sent")
                    self._connected_event.set()
                    self._not_found_streak = 0
                except Exception as exc:
                    logger.debug(
                        "Reconnect failed: %s — retry in %.0fs", exc, _RECONNECT_INTERVAL_S
                    )
                    self._not_found_streak += 1
                    if self._not_found_streak >= _BT_RESET_AFTER_FAILURES:
                        self._not_found_streak = 0
                        if (
                            self._last_bt_reset is None
                            or loop.time() - self._last_bt_reset >= _BT_RESET_COOLDOWN_S
                        ):
                            self._last_bt_reset = loop.time()
                            await self._reset_bluetooth()
                        else:
                            logger.debug("Skipping BT reset — cooldown active")
                    await self._sleep_or_wake(_RECONNECT_INTERVAL_S)
                    continue
            else:
                # Connection may have been established outside this loop (eager
                # connect() at startup): unblock write_now waiters.
                if not self._connected_event.is_set():
                    self._connected_event.set()
                elapsed = now - self._last_write_time
                if not self._last_payload:
                    # Nothing written yet — never send a 0-byte keepalive, which is
                    # a garbage message (or an error) on the firmware side.
                    sleep_for = _KEEPALIVE_INTERVAL_S
                elif elapsed >= _KEEPALIVE_INTERVAL_S:
                    # Re-write last payload only if no real write happened recently.
                    # Firmware deduplicates identical payloads — fire-and-forget is
                    # intentional here (a missed keepalive just reconnects).
                    try:
                        assert self._client is not None
                        async with self._write_lock:
                            await self._client.write_gatt_char(
                                self._settings.characteristic_uuid,
                                self._last_payload,
                                response=False,
                            )
                        self._last_write_time = loop.time()
                        logger.debug("BLE keepalive sent")
                    except Exception as exc:
                        logger.debug(
                            "Keepalive failed: %s — reconnect in %.0fs", exc, _RECONNECT_INTERVAL_S
                        )
                        await self.disconnect()
                        await self._sleep_or_wake(_RECONNECT_INTERVAL_S)
                        continue
                else:
                    sleep_for = _KEEPALIVE_INTERVAL_S - elapsed

            await self._sleep_or_wake(sleep_for)

    async def _sleep_or_wake(self, delay: float) -> None:
        """Sleep up to ``delay`` seconds, returning early if ``_wake`` is set."""
        try:
            await asyncio.wait_for(self._wake.wait(), timeout=max(0.0, delay))
        except TimeoutError:
            pass
        finally:
            self._wake.clear()

    # ── Write ─────────────────────────────────────────────────────────────────

    async def write_now(self, payload: bytes) -> None:
        """Write payload via persistent connection.

        Waits up to 60 s for the connection to be ready (covers initial
        scan+connect), then writes. Retries once on transient failure.
        """
        if not self._settings.is_configured:
            return

        try:
            await asyncio.wait_for(self._connected_event.wait(), timeout=_WRITE_WAIT_S)
        except TimeoutError:
            logger.warning("BLE write skipped — device not reachable within %.0fs", _WRITE_WAIT_S)
            await self._emit_write_failure(payload, "device not reachable")
            return

        for attempt in range(2):
            try:
                await self.send_payload(payload)
                self._last_payload = payload  # authoritative only after a successful write
                return
            except Exception as exc:
                logger.debug("Write attempt %d failed: %s", attempt + 1, exc)
                self._connected_event.clear()
                await self.disconnect()
                if attempt == 0:
                    try:
                        await asyncio.wait_for(self._connected_event.wait(), timeout=_WRITE_WAIT_S)
                    except TimeoutError:
                        break

        logger.warning("BLE write failed after retries")
        await self._emit_write_failure(payload, "write failed after retries")

    async def _emit_write_failure(self, payload: bytes, reason: str) -> None:
        """Notify upstream that a push failed so it can react (not wait for heartbeat)."""
        await self._event_bus.emit(
            EventTopic.BLE_ERROR.value,
            address=self._settings.device_address,
            error=reason,
            payload_hex=payload.hex(),
        )

    async def resend_last(self) -> None:
        """Re-send the last successfully written payload (used by the heartbeat)."""
        if self._last_payload:
            await self.write_now(self._last_payload)

    # ── Low-level connection management ──────────────────────────────────────

    async def _scan_for_device(self) -> Any | None:
        """Active BLE scan to force macOS to rediscover the device, bypassing cache.

        CoreBluetooth caches devices as 'not found' after an abrupt disconnect
        (e.g. device reboot). A scanner pass forces a real RF scan so the cache
        is refreshed. Returns the BLEDevice if found, None otherwise.
        """
        if BleakScanner is None:
            return None
        try:
            return await BleakScanner.find_device_by_address(
                self._settings.device_address, timeout=10.0
            )
        except Exception as exc:
            logger.debug("Active scan failed: %s", exc)
            return None

    async def _reset_bluetooth(self) -> None:
        """Toggle macOS Bluetooth off/on to flush the CoreBluetooth device cache.

        Called automatically after _BT_RESET_AFTER_FAILURES consecutive 'not found'
        failures (~3 min). Requires blueutil; silently skips if not installed.
        """
        if not shutil.which("blueutil"):
            logger.debug("blueutil not found — skipping BT reset")
            return
        logger.info("BLE cache stale after repeated failures — resetting macOS Bluetooth")
        try:
            p = await asyncio.create_subprocess_exec("blueutil", "--power", "0")
            await p.wait()
            await asyncio.sleep(2)
            p = await asyncio.create_subprocess_exec("blueutil", "--power", "1")
            await p.wait()
            await asyncio.sleep(5)
        except Exception as exc:
            logger.debug("Bluetooth reset failed: %s", exc)

    async def connect(self) -> None:
        if not self._settings.is_configured:
            raise ValueError("BLE settings incomplete.")

        async with self._lock:
            if self.is_connected:
                return

            await self._event_bus.emit(
                EventTopic.BLE_CONNECTING.value, address=self._settings.device_address
            )
            # Active scan forces macOS to search the RF band, bypassing the
            # CoreBluetooth cache that marks recently-rebooted devices as absent.
            # Simulated/test backends have no radio — skip the 10 s scan.
            discovered = None if self._uses_custom_factory else await self._scan_for_device()
            client = (
                BleakClient(discovered)
                if discovered is not None and BleakClient is not None
                else self._client_factory(self._settings.device_address)
            )

            try:
                await client.connect(timeout=self._settings.connect_timeout_seconds)
            except Exception as exc:
                await self._event_bus.emit(
                    EventTopic.BLE_ERROR.value,
                    address=self._settings.device_address,
                    error=str(exc),
                )
                raise

            self._client = client
            await self._event_bus.emit(
                EventTopic.BLE_CONNECTED.value, address=self._settings.device_address
            )

    async def disconnect(self) -> None:
        async with self._lock:
            if not self._client:
                return
            try:
                if getattr(self._client, "is_connected", False):
                    await self._client.disconnect()
            finally:
                self._client = None
                self._connected_event.clear()
                self._wake.set()  # wake the connection loop to reconnect promptly
                await self._event_bus.emit(
                    EventTopic.BLE_DISCONNECTED.value,
                    address=self._settings.device_address,
                )

    async def ensure_connected(self) -> None:
        if not self.is_connected:
            await self.connect()

    async def send_payload(self, payload: bytes) -> None:
        await self.ensure_connected()
        assert self._client is not None

        try:
            async with self._write_lock:
                await self._client.write_gatt_char(
                    self._settings.characteristic_uuid,
                    payload,
                    response=self._settings.write_with_response,
                )
            self._last_write_time = asyncio.get_running_loop().time()
        except Exception as exc:
            await self._event_bus.emit(
                EventTopic.BLE_ERROR.value,
                address=self._settings.device_address,
                error=str(exc),
            )
            raise

        await self._event_bus.emit(
            EventTopic.BLE_PAYLOAD_SENT.value,
            address=self._settings.device_address,
            payload_hex=payload.hex(),
        )

    async def send_state(self, state: PresenceState) -> bytes:
        payload = payload_for_state(state, self._settings)
        await self.send_payload(payload)
        return payload

    # ── Fallback for heartbeat ────────────────────────────────────────────────

    async def send_when_available(self, payload: bytes, *, give_up_after: float = 3600.0) -> None:
        """Fallback: alias to write_now for heartbeat compatibility."""
        await self.write_now(payload)

    async def read_battery(self) -> int | None:
        """Read battery level (0–100) from standard BLE Battery Service (0x2A19).

        Returns None if not connected or the characteristic is unavailable.
        """
        if not self.is_connected or self._client is None:
            return None
        try:
            data = await self._client.read_gatt_char("00002a19-0000-1000-8000-00805f9b34fb")
            return int(data[0]) if data else None
        except Exception as exc:
            logger.debug("Battery read failed: %s", exc)
            return None

    def _default_client_factory(self, address: str) -> Any:
        if BleakClient is None:
            raise RuntimeError("bleak is not available in the current environment")
        return BleakClient(address)
