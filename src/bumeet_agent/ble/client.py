"""BLE client wrapper around bleak."""

from __future__ import annotations

import asyncio
from typing import Any, Callable

from bumeet_agent.ble.protocol import PresenceState, payload_for_state
from bumeet_agent.config import BleSettings
from bumeet_agent.events.bus import AsyncEventBus
from bumeet_agent.events.models import EventTopic

try:
	from bleak import BleakClient
except Exception:  # pragma: no cover - depends on platform/runtime availability
	BleakClient = None  # type: ignore[assignment]


class BleClient:
	"""Async BLE GATT client for sending busy/free state changes."""

	def __init__(
		self,
		settings: BleSettings,
		event_bus: AsyncEventBus,
		client_factory: Callable[[str], Any] | None = None,
	) -> None:
		self._settings = settings
		self._event_bus = event_bus
		self._client_factory = client_factory or self._default_client_factory
		self._client: Any | None = None
		self._lock = asyncio.Lock()

	@property
	def is_connected(self) -> bool:
		return bool(self._client and getattr(self._client, "is_connected", False))

	async def connect(self) -> None:
		if not self._settings.is_configured:
			raise ValueError("BLE settings are incomplete. device_address and characteristic_uuid are required.")

		async with self._lock:
			if self.is_connected:
				return

			await self._event_bus.emit(EventTopic.BLE_CONNECTING.value, address=self._settings.device_address)
			client = self._client_factory(self._settings.device_address)

			try:
				await client.connect(timeout=self._settings.connect_timeout_seconds)
			except Exception as exc:
				await self._event_bus.emit(
					EventTopic.BLE_ERROR.value,
					address=self._settings.device_address,
					error=str(exc),
				)
				raise

			self._client = client
			await self._event_bus.emit(EventTopic.BLE_CONNECTED.value, address=self._settings.device_address)

	async def disconnect(self) -> None:
		async with self._lock:
			if not self._client:
				return

			try:
				if getattr(self._client, "is_connected", False):
					await self._client.disconnect()
			finally:
				self._client = None
				await self._event_bus.emit(
					EventTopic.BLE_DISCONNECTED.value,
					address=self._settings.device_address,
				)

	async def ensure_connected(self) -> None:
		if not self.is_connected:
			await self.connect()

	async def send_state(self, state: PresenceState) -> bytes:
		payload = payload_for_state(state, self._settings)
		await self.send_payload(payload)
		return payload

	async def set_busy(self) -> bytes:
		return await self.send_state(PresenceState.BUSY)

	async def set_free(self) -> bytes:
		return await self.send_state(PresenceState.FREE)

	async def send_payload(self, payload: bytes) -> None:
		await self.ensure_connected()
		assert self._client is not None

		try:
			await self._client.write_gatt_char(
				self._settings.characteristic_uuid,
				payload,
				response=self._settings.write_with_response,
			)
		except Exception as exc:
			await self._event_bus.emit(
				EventTopic.BLE_ERROR.value,
				address=self._settings.device_address,
				error=str(exc),
			)
			raise

		await self._event_bus.emit(
			EventTopic.BLE_PAYLOAD_SENT.value,
			address=self._settings.device_address,
			payload_hex=payload.hex(),
		)

	def _default_client_factory(self, address: str) -> Any:
		if BleakClient is None:
			raise RuntimeError("bleak is not available in the current environment")
		return BleakClient(address)
