"""Simulated BLE backend used for offline testing and demos."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable


@dataclass(slots=True, frozen=True)
class RecordedWrite:
	characteristic_uuid: str
	payload: bytes
	response: bool


class FakeBleakClient:
	"""Minimal in-memory replacement for bleak.BleakClient."""

	def __init__(self, address: str, fail_on_connect: bool = False, fail_on_write: bool = False) -> None:
		self.address = address
		self.fail_on_connect = fail_on_connect
		self.fail_on_write = fail_on_write
		self.is_connected = False
		self.writes: list[RecordedWrite] = []

	async def connect(self, timeout: float = 10.0) -> None:
		if self.fail_on_connect:
			raise RuntimeError(f"simulated connection failure to {self.address} after {timeout}s")
		self.is_connected = True

	async def disconnect(self) -> None:
		self.is_connected = False

	async def write_gatt_char(self, characteristic_uuid: str, payload: bytes, response: bool = True) -> None:
		if self.fail_on_write:
			raise RuntimeError(f"simulated write failure to {characteristic_uuid}")
		self.writes.append(RecordedWrite(characteristic_uuid=characteristic_uuid, payload=payload, response=response))


def build_fake_client_factory(
	*, fail_on_connect: bool = False, fail_on_write: bool = False
) -> tuple[Callable[[str], FakeBleakClient], list[FakeBleakClient]]:
	"""Return a factory compatible with BleClient and a list of created clients."""

	created_clients: list[FakeBleakClient] = []

	def factory(address: str) -> FakeBleakClient:
		client = FakeBleakClient(address, fail_on_connect=fail_on_connect, fail_on_write=fail_on_write)
		created_clients.append(client)
		return client

	return factory, created_clients