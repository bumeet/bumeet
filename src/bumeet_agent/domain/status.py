"""Domain status models for occupancy detection."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum


class OccupancyStatus(str, Enum):
	FREE = "free"
	BUSY = "busy"


@dataclass(slots=True, frozen=True)
class HardwareSnapshot:
	"""Normalized snapshot of system hardware activity."""

	camera_in_use: bool = False
	microphone_in_use: bool = False
	source: str = "unknown"
	occurred_at: datetime = field(default_factory=lambda: datetime.now(UTC))

	@property
	def any_in_use(self) -> bool:
		return self.camera_in_use or self.microphone_in_use

	@property
	def active_resources(self) -> tuple[str, ...]:
		resources: list[str] = []
		if self.camera_in_use:
			resources.append("camera")
		if self.microphone_in_use:
			resources.append("microphone")
		return tuple(resources)


@dataclass(slots=True, frozen=True)
class StateTransition:
	"""State transition derived from a hardware snapshot."""

	previous_status: OccupancyStatus
	current_status: OccupancyStatus
	snapshot: HardwareSnapshot
	reason: str
	changed: bool
