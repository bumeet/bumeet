"""Detection orchestration and simulated detector implementation."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

import aiohttp

from bumeet_agent.ble.client import BleClient
from bumeet_agent.config import ApiSettings
from bumeet_agent.detection.base import DetectionCallback, HardwareDetector
from bumeet_agent.domain.state_machine import PresenceStateMachine
from bumeet_agent.domain.status import HardwareSnapshot, OccupancyStatus
from bumeet_agent.events.bus import AsyncEventBus
from bumeet_agent.events.models import EventTopic
from bumeet_agent.logging import get_logger

logger = get_logger(__name__)


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
        self._heartbeat_task: asyncio.Task[None] | None = None
        self._last_api_busy: bool = False
        self._last_api_upcoming: bool = False
        self._last_hw_busy: bool = False
        self._last_api_data: dict[str, Any] | None = None
        self._last_api_success_at: float = 0.0
        # Serialize all BLE writes so a state change and the heartbeat can't race
        # on the single GATT connection. BleClient owns the authoritative payload.
        self._send_lock = asyncio.Lock()

    _HEARTBEAT_INTERVAL_S: int = 5 * 60  # resend current state every 5 min
    _MAX_AUTH_BACKOFF_S: float = 300.0  # cap exponential backoff on repeated 401s
    _API_STALENESS_S: float = (
        15 * 60.0
    )  # treat cached API data as stale after 15 min without a successful poll

    @staticmethod
    def _log_send_exc(task: asyncio.Task[None]) -> None:
        """Done-callback: surface exceptions from fire-and-forget send tasks."""
        if task.cancelled():
            return
        exc = task.exception()
        if exc is not None:
            logger.warning("BLE send task failed: %s", exc)

    async def _send(self, payload: bytes) -> None:
        async with self._send_lock:
            await self._ble_client.write_now(payload)

    async def _heartbeat_send(self) -> None:
        async with self._send_lock:
            await self._ble_client.resend_last()

    async def start_api_polling(self) -> None:
        """Poll /integrations/live-status on interval and push to CoreInk."""
        if not self._api or not self._api.is_configured:
            return
        self._api_poll_task = asyncio.create_task(self._api_poll_loop())
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def stop_api_polling(self) -> None:
        for task in (self._api_poll_task, self._heartbeat_task):
            if task and not task.done():
                task.cancel()

    async def _heartbeat_loop(self) -> None:
        """Periodically re-send the last known payload.

        Ensures the CoreInk recovers its display state after a BLE dropout,
        device reboot, or any missed state change.
        """
        while True:
            await asyncio.sleep(self._HEARTBEAT_INTERVAL_S)
            if self._pending_send and not self._pending_send.done():
                continue  # an active send is already in flight — skip
            self._pending_send = asyncio.create_task(self._heartbeat_send())
            self._pending_send.add_done_callback(self._log_send_exc)

    async def _api_poll_loop(self) -> None:
        assert self._api is not None
        headers = {"x-agent-key": self._api.token}
        # /agent/live-status uses the permanent agentToken (x-agent-key), not a JWT session token
        url = f"{self._api.url}/agent/live-status"
        interval = self._api.poll_interval_seconds
        auth_failures = 0
        async with aiohttp.ClientSession(headers=headers) as session:
            while True:
                sleep_for = interval
                try:
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                        if resp.status == 401:
                            # Token rejected: back off exponentially (honoring any
                            # Retry-After) so we don't hammer the API while broken.
                            auth_failures += 1
                            retry_after = resp.headers.get("Retry-After", "")
                            if retry_after.isdigit():
                                sleep_for = min(self._MAX_AUTH_BACKOFF_S, float(retry_after))
                            else:
                                sleep_for = min(
                                    self._MAX_AUTH_BACKOFF_S, interval * (2**auth_failures)
                                )
                            logger.warning(
                                "API token rejected (401) — calendar/Slack integration "
                                "disabled. Re-pair the agent to restore it. "
                                "Backing off %.0fs.",
                                sleep_for,
                            )
                        elif resp.status == 200:
                            auth_failures = 0
                            data: dict[str, Any] = await resp.json()
                            busy: bool = data.get("busy", False)
                            upcoming: bool = data.get("upcoming", False)
                            # Always track last successful response so _push_combined_state
                            # can use it when triggered by a hardware change (no api_data arg).
                            self._last_api_data = data
                            self._last_api_success_at = time.monotonic()
                            effective_busy = busy and not upcoming
                            if (
                                effective_busy != self._last_api_busy
                                or upcoming != self._last_api_upcoming
                            ):
                                self._last_api_busy = effective_busy
                                self._last_api_upcoming = upcoming
                                await self._push_combined_state(api_data=data)
                except (TimeoutError, aiohttp.ClientError):
                    pass
                await asyncio.sleep(sleep_for)

    async def _push_combined_state(self, api_data: dict[str, Any] | None = None) -> None:
        """Send payload to CoreInk. live-status already builds the final payload string."""
        # When called from a hardware event (no api_data), fall back to the cached API
        # response so UPCOMING meetings aren't lost when the mic/cam state changes.
        # Discard the cache if the API has been unreachable long enough to be stale —
        # in that case we'd rather show FREE than a payload that may be hours old.
        effective_api = api_data
        if effective_api is None and self._last_api_data is not None:
            age = time.monotonic() - self._last_api_success_at
            if age < self._API_STALENESS_S:
                effective_api = self._last_api_data

        if self._last_hw_busy:
            payload = b"BUSY"
        elif effective_api and (effective_api.get("busy") or effective_api.get("upcoming")):
            # payload field from live-status is the ready-to-send string
            # (e.g. "BUSY · Slack", "UPCOMING · Google Calendar · starts 14:30")
            raw: str = effective_api.get("payload") or (
                "BUSY" if effective_api.get("busy") else "FREE"
            )
            payload = raw.encode("utf-8")
        else:
            payload = b"FREE"

        # Don't cancel an in-flight write (it may be mid-GATT); the send lock
        # serializes this after any pending write. BleClient tracks the payload.
        self._pending_send = asyncio.create_task(self._send(payload))
        self._pending_send.add_done_callback(self._log_send_exc)

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
            SimulationStep(
                scaled(0.0),
                HardwareSnapshot(camera_in_use=False, microphone_in_use=False, source="sim:init"),
                "initial free",
            ),
            SimulationStep(
                scaled(0.2),
                HardwareSnapshot(
                    camera_in_use=False, microphone_in_use=True, source="sim:join-call"
                ),
                "busy on mic",
            ),
            SimulationStep(
                scaled(0.2),
                HardwareSnapshot(
                    camera_in_use=False, microphone_in_use=False, source="sim:mute-end"
                ),
                "free",
            ),
            SimulationStep(
                scaled(0.2),
                HardwareSnapshot(
                    camera_in_use=True, microphone_in_use=True, source="sim:camera-on"
                ),
                "busy on camera and mic",
            ),
            SimulationStep(
                scaled(0.2),
                HardwareSnapshot(
                    camera_in_use=False, microphone_in_use=False, source="sim:end-call"
                ),
                "free again",
            ),
        ]

    if name == "camera-only":
        return [
            SimulationStep(
                scaled(0.0),
                HardwareSnapshot(camera_in_use=False, microphone_in_use=False, source="sim:init"),
                "initial free",
            ),
            SimulationStep(
                scaled(0.2),
                HardwareSnapshot(
                    camera_in_use=True, microphone_in_use=False, source="sim:camera-only"
                ),
                "busy on camera",
            ),
            SimulationStep(
                scaled(0.2),
                HardwareSnapshot(
                    camera_in_use=False, microphone_in_use=False, source="sim:camera-off"
                ),
                "free",
            ),
        ]

    return [
        SimulationStep(
            scaled(0.0),
            HardwareSnapshot(camera_in_use=False, microphone_in_use=False, source="sim:init"),
            "initial free",
        ),
        SimulationStep(
            scaled(0.3),
            HardwareSnapshot(
                camera_in_use=False, microphone_in_use=True, source="sim:meeting-start"
            ),
            "busy on microphone",
        ),
        SimulationStep(
            scaled(0.3),
            HardwareSnapshot(
                camera_in_use=False, microphone_in_use=False, source="sim:meeting-end"
            ),
            "free on meeting end",
        ),
    ]
