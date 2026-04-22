"""Application entry point."""

from __future__ import annotations

import argparse
import asyncio
import signal
import sys
from pathlib import Path

from bumeet_agent.bootstrap import build_container
from bumeet_agent.detection.service import AgentOrchestrator
from bumeet_agent.events.models import AgentEvent, EventTopic
from bumeet_agent.logging import configure_logging, get_logger
from bumeet_agent.simulation import run_simulation_session
from bumeet_agent.ui.simulator import launch_simulation_viewer


logger = get_logger(__name__)


def _build_detector(poll_interval: float):
    """Return the platform-appropriate hardware detector."""
    if sys.platform == "darwin":
        from bumeet_agent.detection.macos import MacOSHardwareDetector
        return MacOSHardwareDetector(poll_interval=poll_interval)
    if sys.platform == "win32":
        from bumeet_agent.detection.windows import WindowsHardwareDetector
        return WindowsHardwareDetector()
    raise RuntimeError(f"No hardware detector available for platform: {sys.platform}")


async def run(
    config_path: Path | None = None,
    *,
    simulate: bool = False,
    scenario: str = "default",
    delay_scale: float = 1.0,
) -> int:
    if simulate:
        async def log_event(event: AgentEvent) -> None:
            logger.info("event=%s payload=%s", event.topic, event.payload)

        result = await run_simulation_session(
            config_path=config_path,
            scenario=scenario,
            delay_scale=delay_scale,
            event_consumer=log_event,
        )
        return result.exit_code

    container = build_container(config_path)

    async def log_event(event: AgentEvent) -> None:
        logger.info("event=%s payload=%s", event.topic, event.payload)

    await container.event_bus.subscribe("*", log_event)
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

    await orchestrator.start_api_polling()

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()

    def _request_stop() -> None:
        loop.call_soon_threadsafe(stop_event.set)

    try:
        loop.add_signal_handler(signal.SIGINT, _request_stop)
        loop.add_signal_handler(signal.SIGTERM, _request_stop)
    except (NotImplementedError, RuntimeError):
        pass  # Windows does not support loop.add_signal_handler

    detection_task = asyncio.create_task(detector.start(orchestrator.handle_snapshot))
    try:
        await stop_event.wait()
    finally:
        await detector.stop()
        try:
            await asyncio.wait_for(detection_task, timeout=3.0)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            detection_task.cancel()
        await orchestrator.stop_api_polling()
        await container.event_bus.emit(EventTopic.APP_STOPPING.value)
        await container.ble_client.disconnect()

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="BUMEET local agent")
    parser.add_argument("--config", type=Path, default=None, help="Path to the local settings JSON file")
    parser.add_argument("--simulate", action="store_true", help="Run a full offline simulation without BLE hardware")
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
    parser.add_argument("--simulate-ui", action="store_true", help="Launch a desktop UI to visualize the simulation")
    args = parser.parse_args()

    configure_logging()
    if args.simulate_ui:
        launch_simulation_viewer()
        return 0

    return asyncio.run(
        run(
            args.config,
            simulate=args.simulate,
            scenario=args.scenario,
            delay_scale=args.delay_scale,
        )
    )


if __name__ == "__main__":
    raise SystemExit(main())
