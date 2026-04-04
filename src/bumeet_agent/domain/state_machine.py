"""State machine translating hardware snapshots into occupancy states."""

from __future__ import annotations

from bumeet_agent.domain.status import HardwareSnapshot, OccupancyStatus, StateTransition


class PresenceStateMachine:
	"""Determine whether the user should be marked free or busy."""

	def __init__(self, initial_status: OccupancyStatus = OccupancyStatus.FREE) -> None:
		self._current_status = initial_status

	@property
	def current_status(self) -> OccupancyStatus:
		return self._current_status

	def apply_snapshot(self, snapshot: HardwareSnapshot) -> StateTransition:
		next_status = OccupancyStatus.BUSY if snapshot.any_in_use else OccupancyStatus.FREE
		changed = next_status != self._current_status
		reason = self._build_reason(snapshot, next_status)
		transition = StateTransition(
			previous_status=self._current_status,
			current_status=next_status,
			snapshot=snapshot,
			reason=reason,
			changed=changed,
		)
		self._current_status = next_status
		return transition

	def _build_reason(self, snapshot: HardwareSnapshot, next_status: OccupancyStatus) -> str:
		if next_status is OccupancyStatus.BUSY:
			resources = ", ".join(snapshot.active_resources) or "unknown"
			return f"resources active: {resources}"
		return "no active camera or microphone usage"
