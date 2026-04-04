from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from bumeet_agent.ble.protocol import PresenceState, payload_for_state
from bumeet_agent.config import BleSettings


class ProtocolTests(unittest.TestCase):
	def test_hex_payloads_are_serialized_to_bytes(self) -> None:
		settings = BleSettings(device_address="SIM", characteristic_uuid="uuid", payload_encoding="hex")

		self.assertEqual(payload_for_state(PresenceState.BUSY, settings), b"\x01")
		self.assertEqual(payload_for_state(PresenceState.FREE, settings), b"\x00")

	def test_text_payloads_are_serialized_to_utf8(self) -> None:
		settings = BleSettings(
			device_address="SIM",
			characteristic_uuid="uuid",
			payload_encoding="text",
			busy_payload="BUSY",
			free_payload="FREE",
		)

		self.assertEqual(payload_for_state(PresenceState.BUSY, settings), b"BUSY")
		self.assertEqual(payload_for_state(PresenceState.FREE, settings), b"FREE")


if __name__ == "__main__":
	unittest.main()
