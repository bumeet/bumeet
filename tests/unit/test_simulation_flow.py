from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from bumeet_agent.ble.client import BleClient
from bumeet_agent.ble.simulated import build_fake_client_factory
from bumeet_agent.config import BleSettings
from bumeet_agent.detection.service import AgentOrchestrator, SimulatedHardwareDetector, build_simulation_steps
from bumeet_agent.domain.state_machine import PresenceStateMachine
from bumeet_agent.events.bus import AsyncEventBus
from bumeet_agent.events.models import AgentEvent, EventTopic


class SimulationFlowTests(unittest.IsolatedAsyncioTestCase):
	async def test_default_simulation_sends_busy_then_free_payloads(self) -> None:
		event_bus = AsyncEventBus()
		client_factory, created_clients = build_fake_client_factory()
		ble_client = BleClient(
			settings=BleSettings(device_address="SIM", characteristic_uuid="char-uuid"),
			event_bus=event_bus,
			client_factory=client_factory,
		)
		state_machine = PresenceStateMachine()
		orchestrator = AgentOrchestrator(event_bus=event_bus, state_machine=state_machine, ble_client=ble_client)
		detector = SimulatedHardwareDetector(build_simulation_steps(name="default", delay_scale=0))

		recorded_events: list[AgentEvent] = []

		async def capture(event: AgentEvent) -> None:
			recorded_events.append(event)

		await event_bus.subscribe("*", capture)
		await detector.start(orchestrator.handle_snapshot)

		self.assertEqual(len(created_clients), 1)
		self.assertEqual([write.payload for write in created_clients[0].writes], [b"\x01", b"\x00"])

		occupancy_events = [event for event in recorded_events if event.topic == EventTopic.OCCUPANCY_CHANGED.value]
		self.assertEqual(len(occupancy_events), 2)
		self.assertEqual(occupancy_events[0].payload["current_status"], "busy")
		self.assertEqual(occupancy_events[1].payload["current_status"], "free")


if __name__ == "__main__":
	unittest.main()
