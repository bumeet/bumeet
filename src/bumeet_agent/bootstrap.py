"""Bootstrap helpers to compose agent services."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from bumeet_agent.ble.client import BleClient
from bumeet_agent.config import AppSettings, BleSettings, RuntimeSettings, SettingsStore
from bumeet_agent.domain.state_machine import PresenceStateMachine
from bumeet_agent.events.bus import AsyncEventBus


@dataclass(slots=True)
class AgentContainer:
	"""Runtime service container for the local agent."""

	settings_store: SettingsStore
	settings: AppSettings
	event_bus: AsyncEventBus
	state_machine: PresenceStateMachine
	ble_client: BleClient


def build_container(
	settings_path: Path | None = None,
	*,
	settings_override: AppSettings | None = None,
	client_factory: Callable[[str], Any] | None = None,
) -> AgentContainer:
	settings_store = SettingsStore(settings_path)
	settings = settings_override or settings_store.load()
	event_bus = AsyncEventBus()
	state_machine = PresenceStateMachine()
	ble_client = BleClient(settings=settings.ble, event_bus=event_bus, client_factory=client_factory)
	return AgentContainer(
		settings_store=settings_store,
		settings=settings,
		event_bus=event_bus,
		state_machine=state_machine,
		ble_client=ble_client,
	)


def build_simulated_settings() -> AppSettings:
	"""Return a self-contained config suitable for offline simulation."""

	return AppSettings(
		ble=BleSettings(
			device_address="SIMULATED-DEVICE",
			characteristic_uuid="0000feed-0000-1000-8000-00805f9b34fb",
			payload_encoding="hex",
			busy_payload="01",
			free_payload="00",
		),
		runtime=RuntimeSettings(auto_connect_on_start=False, poll_interval_seconds=0.5),
	)
