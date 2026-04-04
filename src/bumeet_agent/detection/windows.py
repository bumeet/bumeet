"""Windows detector stub for future native implementation."""

from __future__ import annotations

from bumeet_agent.detection.base import DetectionCallback, HardwareDetector


class WindowsHardwareDetector(HardwareDetector):
	"""Reserved for the Windows capability-access based implementation."""

	async def start(self, callback: DetectionCallback) -> None:
		raise NotImplementedError("Windows hardware detection is not implemented yet")

	async def stop(self) -> None:
		return None
