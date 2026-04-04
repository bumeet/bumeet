"""Detection orchestration and simulated detector implementation."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Sequence

from bumeet_agent.ble.client import BleClient
from bumeet_agent.ble.protocol import PresenceState
from bumeet_agent.detection.base import DetectionCallback, HardwareDetector
from bumeet_agent.domain.state_machine import PresenceStateMachine
from bumeet_agent.domain.status import HardwareSnapshot, OccupancyStatus
from bumeet_agent.events.bus import AsyncEventBus
from bumeet_agent.events.models import EventTopic


@dataclass(slots=True, frozen=True)
class SimulationStep:
	"""Single simulation step with delay and resulting hardware snapshot."""

	delay_seconds: float
	snapshot: HardwareSnapshot
	label: str


class SimulatedHardwareDetector(HardwareDetector):
	"""Emit predetermined snapshots to simulate camera/microphone activity."""

	def __init__(self, steps: Sequence[SimulationStep]) -> None:
		self._steps = list(steps)
		self._stopped = False

	async def start(self, callback: DetectionCallback) -> None:
		self._stopped = False
		for step in self._steps:
			if self._stopped:
				break
			if step.delay_seconds > 0:
				await asyncio.sleep(step.delay_seconds)
			result = callback(step.snapshot)
			if asyncio.iscoroutine(result):
				await result

	async def stop(self) -> None:
		self._stopped = True


class AgentOrchestrator:
	"""Bridge detector snapshots to domain transitions and BLE writes."""

	def __init__(self, event_bus: AsyncEventBus, state_machine: PresenceStateMachine, ble_client: BleClient) -> None:
		self._event_bus = event_bus
		self._state_machine = state_machine
		self._ble_client = ble_client

	async def handle_snapshot(self, snapshot: HardwareSnapshot) -> None:
		await self._event_bus.emit(
			EventTopic.DETECTION_UPDATED.value,
			source=snapshot.source,
			camera_in_use=snapshot.camera_in_use,
			microphone_in_use=snapshot.microphone_in_use,
			active_resources=list(snapshot.active_resources),
		)

		transition = self._state_machine.apply_snapshot(snapshot)
		if not transition.changed:
			return

		await self._event_bus.emit(
			EventTopic.OCCUPANCY_CHANGED.value,
			previous_status=transition.previous_status.value,
			current_status=transition.current_status.value,
			reason=transition.reason,
		)

		if transition.current_status is OccupancyStatus.BUSY:
			await self._ble_client.send_state(PresenceState.BUSY)
		else:
			await self._ble_client.send_state(PresenceState.FREE)


def build_simulation_steps(name: str = "default", delay_scale: float = 1.0) -> list[SimulationStep]:
	"""Build named simulation scenarios for offline app testing."""

	def scaled(delay_seconds: float) -> float:
		return max(0.0, delay_seconds * delay_scale)

	if name == "bounce":
		return [
			SimulationStep(scaled(0.0), HardwareSnapshot(camera_in_use=False, microphone_in_use=False, source="sim:init"), "initial free"),
			SimulationStep(scaled(0.2), HardwareSnapshot(camera_in_use=False, microphone_in_use=True, source="sim:join-call"), "busy on mic"),
			SimulationStep(scaled(0.2), HardwareSnapshot(camera_in_use=False, microphone_in_use=False, source="sim:mute-end"), "free"),
			SimulationStep(scaled(0.2), HardwareSnapshot(camera_in_use=True, microphone_in_use=True, source="sim:camera-on"), "busy on camera and mic"),
			SimulationStep(scaled(0.2), HardwareSnapshot(camera_in_use=False, microphone_in_use=False, source="sim:end-call"), "free again"),
		]

	if name == "camera-only":
		return [
			SimulationStep(scaled(0.0), HardwareSnapshot(camera_in_use=False, microphone_in_use=False, source="sim:init"), "initial free"),
			SimulationStep(scaled(0.2), HardwareSnapshot(camera_in_use=True, microphone_in_use=False, source="sim:camera-only"), "busy on camera"),
			SimulationStep(scaled(0.2), HardwareSnapshot(camera_in_use=False, microphone_in_use=False, source="sim:camera-off"), "free"),
		]

	return [
		SimulationStep(scaled(0.0), HardwareSnapshot(camera_in_use=False, microphone_in_use=False, source="sim:init"), "initial free"),
		SimulationStep(scaled(0.3), HardwareSnapshot(camera_in_use=False, microphone_in_use=True, source="sim:meeting-start"), "busy on microphone"),
		SimulationStep(scaled(0.3), HardwareSnapshot(camera_in_use=False, microphone_in_use=False, source="sim:meeting-end"), "free on meeting end"),
	]
