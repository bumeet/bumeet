"""Event models used across the local agent."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any


class EventTopic(str, Enum):
	APP_STARTED = "app.started"
	APP_STOPPING = "app.stopping"
	SIMULATION_STARTED = "simulation.started"
	SIMULATION_COMPLETED = "simulation.completed"
	DETECTION_UPDATED = "detection.updated"
	OCCUPANCY_CHANGED = "occupancy.changed"
	BLE_CONNECTING = "ble.connecting"
	BLE_CONNECTED = "ble.connected"
	BLE_DISCONNECTED = "ble.disconnected"
	BLE_PAYLOAD_SENT = "ble.payload_sent"
	BLE_ERROR = "ble.error"


@dataclass(slots=True, frozen=True)
class AgentEvent:
	"""Immutable domain event for internal pub-sub communication."""

	topic: str
	payload: dict[str, Any] = field(default_factory=dict)
	occurred_at: datetime = field(default_factory=lambda: datetime.now(UTC))
