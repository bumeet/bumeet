"""BLE device identifier abstraction."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True, frozen=True)
class BleDeviceAddress:
	"""Normalized BLE address or logical peripheral identifier."""

	value: str
	platform: str

	def normalized(self) -> str:
		if self.platform.lower() == "win32":
			return self.value.upper()
		return self.value

