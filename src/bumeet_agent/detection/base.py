"""Base contracts for hardware activity detection."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable

from bumeet_agent.domain.status import HardwareSnapshot


DetectionCallback = Callable[[HardwareSnapshot], Awaitable[None] | None]


class HardwareDetector(ABC):
	"""Abstract contract for OS-specific or simulated hardware detectors."""

	@abstractmethod
	async def start(self, callback: DetectionCallback) -> None:
		"""Begin detection and invoke the callback for each snapshot."""

	@abstractmethod
	async def stop(self) -> None:
		"""Stop any ongoing detection loop."""
