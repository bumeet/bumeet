"""Shared simulation runner used by CLI and UI modes."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Awaitable, Callable

from bumeet_agent.ble.simulated import FakeBleakClient, build_fake_client_factory
from bumeet_agent.bootstrap import AgentContainer, build_container, build_simulated_settings
from bumeet_agent.detection.service import AgentOrchestrator, SimulatedHardwareDetector, build_simulation_steps
from bumeet_agent.events.models import AgentEvent, EventTopic


EventConsumer = Callable[[AgentEvent], Awaitable[None] | None]


@dataclass(slots=True)
class SimulationResult:
    """Structured result from a simulation session."""

    exit_code: int
    container: AgentContainer
    fake_clients: list[FakeBleakClient]


async def run_simulation_session(
    *,
    config_path: Path | None = None,
    scenario: str = "default",
    delay_scale: float = 1.0,
    event_consumer: EventConsumer | None = None,
    fail_on_connect: bool = False,
    fail_on_write: bool = False,
) -> SimulationResult:
    """Run a full offline simulation and return the resulting runtime state."""

    client_factory, created_clients = build_fake_client_factory(
        fail_on_connect=fail_on_connect,
        fail_on_write=fail_on_write,
    )
    container = build_container(
        config_path,
        settings_override=build_simulated_settings(),
        client_factory=client_factory,
    )

    if event_consumer is not None:
        await container.event_bus.subscribe("*", event_consumer)

    await container.event_bus.emit(
        EventTopic.APP_STARTED.value,
        config_path=str(container.settings_store.path),
        ble_configured=container.settings.ble.is_configured,
        simulate=True,
    )

    orchestrator = AgentOrchestrator(
        event_bus=container.event_bus,
        state_machine=container.state_machine,
        ble_client=container.ble_client,
    )
    detector = SimulatedHardwareDetector(build_simulation_steps(name=scenario, delay_scale=delay_scale))

    await container.event_bus.emit(EventTopic.SIMULATION_STARTED.value, scenario=scenario, delay_scale=delay_scale)

    try:
        await detector.start(orchestrator.handle_snapshot)
    finally:
        await detector.stop()
        await container.event_bus.emit(EventTopic.SIMULATION_COMPLETED.value, scenario=scenario)
        await container.event_bus.emit(EventTopic.APP_STOPPING.value)
        await container.ble_client.disconnect()

    return SimulationResult(exit_code=0, container=container, fake_clients=created_clients)
