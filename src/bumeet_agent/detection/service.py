"""Detection orchestration and simulated detector implementation."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Sequence

try:
	import aiohttp
except ImportError:
	aiohttp = None  # type: ignore[assignment]

from bumeet_agent.ble.client import BleClient
from bumeet_agent.ble.protocol import PresenceState
from bumeet_agent.config import ApiSettings
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
	"""Bridge detector snapshots + API busy status to BLE writes."""

	def __init__(
		self,
		event_bus: AsyncEventBus,
		state_machine: PresenceStateMachine,
		ble_client: BleClient,
		api_settings: ApiSettings | None = None,
	) -> None:
		self._event_bus = event_bus
		self._state_machine = state_machine
		self._ble_client = ble_client
		self._api = api_settings
		self._pending_send: asyncio.Task[None] | None = None
		self._api_poll_task: asyncio.Task[None] | None = None
		self._last_api_busy: bool = False
		self._last_api_upcoming: bool = False
		self._last_hw_busy: bool = False

	async def start_api_polling(self) -> None:
		"""Poll /integrations/busy on interval and push to CoreInk."""
		if not self._api or not self._api.is_configured or aiohttp is None:
			return
		self._api_poll_task = asyncio.create_task(self._api_poll_loop())

	async def stop_api_polling(self) -> None:
		if self._api_poll_task and not self._api_poll_task.done():
			self._api_poll_task.cancel()

	async def _api_poll_loop(self) -> None:
		assert self._api is not None
		headers = {"Authorization": f"Bearer {self._api.token}"}
		# live-status includes real-time Slack/Teams/Zoom/Webex presence — /busy only checks calendar
		url = f"{self._api.url}/integrations/live-status"
		interval = self._api.poll_interval_seconds
		async with aiohttp.ClientSession(headers=headers) as session:
			while True:
				try:
					async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
						if resp.status == 200:
							data: dict[str, Any] = await resp.json()
							busy: bool = data.get("busy", False)
							upcoming: bool = data.get("upcoming", False)
							effective_busy = busy and not upcoming
							if effective_busy != self._last_api_busy or upcoming != self._last_api_upcoming:
								self._last_api_busy = effective_busy
								self._last_api_upcoming = upcoming
								await self._push_combined_state(api_data=data)
				except (aiohttp.ClientError, asyncio.TimeoutError):
					pass
				await asyncio.sleep(interval)

	async def _push_combined_state(self, api_data: dict[str, Any] | None = None) -> None:
		"""Send payload to CoreInk. live-status already builds the final payload string."""
		# If hardware (mic/cam) is active, override with BUSY · Call regardless of API state
		if self._last_hw_busy:
			payload = b"BUSY"
		elif api_data and (api_data.get("busy") or api_data.get("upcoming")):
			# payload field from live-status is the ready-to-send string (e.g. "BUSY · Slack")
			raw: str = api_data.get("payload") or ("BUSY" if api_data.get("busy") else "FREE")
			payload = raw.encode("utf-8")
		else:
			payload = b"FREE"

		if self._pending_send and not self._pending_send.done():
			self._pending_send.cancel()
		self._pending_send = asyncio.create_task(
			self._ble_client.send_when_available(payload)
		)

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

		self._last_hw_busy = transition.current_status is OccupancyStatus.BUSY
		await self._push_combined_state()


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
