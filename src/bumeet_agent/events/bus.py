"""Asynchronous in-process event bus."""

from __future__ import annotations

import asyncio
import inspect
from collections import defaultdict
from collections.abc import Awaitable, Callable

from bumeet_agent.events.models import AgentEvent


EventHandler = Callable[[AgentEvent], Awaitable[None] | None]
WILDCARD_TOPIC = "*"


class AsyncEventBus:
	"""Minimal async event bus with topic subscriptions and wildcard listeners."""

	def __init__(self) -> None:
		self._subscribers: dict[str, list[EventHandler]] = defaultdict(list)
		self._lock = asyncio.Lock()

	async def subscribe(self, topic: str, handler: EventHandler) -> Callable[[], Awaitable[None]]:
		async with self._lock:
			self._subscribers[topic].append(handler)

		async def unsubscribe() -> None:
			async with self._lock:
				handlers = self._subscribers.get(topic, [])
				if handler in handlers:
					handlers.remove(handler)

		return unsubscribe

	async def publish(self, event: AgentEvent) -> None:
		async with self._lock:
			handlers = list(self._subscribers.get(event.topic, []))
			handlers.extend(self._subscribers.get(WILDCARD_TOPIC, []))

		if not handlers:
			return

		await asyncio.gather(*(self._invoke(handler, event) for handler in handlers))

	async def emit(self, topic: str, **payload: object) -> None:
		await self.publish(AgentEvent(topic=topic, payload=dict(payload)))

	async def _invoke(self, handler: EventHandler, event: AgentEvent) -> None:
		result = handler(event)
		if inspect.isawaitable(result):
			await result
