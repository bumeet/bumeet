from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from bumeet_agent.domain.state_machine import PresenceStateMachine
from bumeet_agent.domain.status import HardwareSnapshot, OccupancyStatus


class PresenceStateMachineTests(unittest.TestCase):
	def test_snapshot_with_microphone_transitions_to_busy(self) -> None:
		machine = PresenceStateMachine()
		transition = machine.apply_snapshot(HardwareSnapshot(camera_in_use=False, microphone_in_use=True))

		self.assertTrue(transition.changed)
		self.assertEqual(transition.previous_status, OccupancyStatus.FREE)
		self.assertEqual(transition.current_status, OccupancyStatus.BUSY)

	def test_same_busy_state_does_not_emit_new_transition(self) -> None:
		machine = PresenceStateMachine(initial_status=OccupancyStatus.BUSY)
		transition = machine.apply_snapshot(HardwareSnapshot(camera_in_use=True, microphone_in_use=False))

		self.assertFalse(transition.changed)
		self.assertEqual(transition.current_status, OccupancyStatus.BUSY)


if __name__ == "__main__":
	unittest.main()
