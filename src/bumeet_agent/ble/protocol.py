"""BLE protocol helpers for serializing state payloads."""

from __future__ import annotations

from enum import Enum

from bumeet_agent.config import BleSettings


class PresenceState(str, Enum):
	FREE = "free"
	BUSY = "busy"


def encode_payload(raw_value: str, encoding: str) -> bytes:
	if encoding == "hex":
		normalized = raw_value.replace(" ", "")
		return bytes.fromhex(normalized)
	return raw_value.encode("utf-8")


def payload_for_state(state: PresenceState, settings: BleSettings) -> bytes:
	raw_value = settings.busy_payload if state is PresenceState.BUSY else settings.free_payload
	return encode_payload(raw_value, settings.payload_encoding)
