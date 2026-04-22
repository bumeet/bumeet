"""Configuration models and local settings persistence."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from platformdirs import user_config_dir
from pydantic import BaseModel, Field


APP_NAME = "bumeet-agent"
APP_AUTHOR = "bumeet"
DEFAULT_CONFIG_FILE = "config.json"


class BleSettings(BaseModel):
	"""BLE transport settings for the local agent."""

	device_address: str = ""
	characteristic_uuid: str = ""
	service_uuid: str | None = None
	payload_encoding: Literal["hex", "text"] = "text"
	busy_payload: str = "BUSY"
	free_payload: str = "FREE"
	write_with_response: bool = True
	connect_timeout_seconds: float = Field(default=10.0, ge=1.0, le=60.0)

	@property
	def is_configured(self) -> bool:
		return bool(self.device_address and self.characteristic_uuid)


class RuntimeSettings(BaseModel):
	"""Runtime and polling behavior settings."""

	auto_connect_on_start: bool = False
	poll_interval_seconds: float = Field(default=2.0, ge=0.25, le=60.0)


class ApiSettings(BaseModel):
	"""BUMEET cloud API settings for enriched busy payloads."""

	url: str = "https://api.bumeet.es/api/v1"
	token: str = ""
	poll_interval_seconds: float = Field(default=5.0, ge=1.0, le=60.0)

	@property
	def is_configured(self) -> bool:
		return bool(self.token)


class TelemetrySettings(BaseModel):
	"""Telemetry flags reserved for later cloud integration."""

	enabled: bool = False
	endpoint: str | None = None


class AppSettings(BaseModel):
	"""Top-level application settings."""

	ble: BleSettings = Field(default_factory=BleSettings)
	runtime: RuntimeSettings = Field(default_factory=RuntimeSettings)
	api: ApiSettings = Field(default_factory=ApiSettings)
	telemetry: TelemetrySettings = Field(default_factory=TelemetrySettings)


class SettingsStore:
	"""Persist agent settings to the standard OS configuration directory."""

	def __init__(self, path: Path | None = None) -> None:
		self._path = path or self.default_path()

	@property
	def path(self) -> Path:
		return self._path

	@staticmethod
	def default_path() -> Path:
		config_dir = Path(user_config_dir(APP_NAME, APP_AUTHOR))
		return config_dir / DEFAULT_CONFIG_FILE

	def load(self) -> AppSettings:
		if not self._path.exists():
			return AppSettings()

		raw_data = json.loads(self._path.read_text(encoding="utf-8"))
		return AppSettings.model_validate(raw_data)

	def save(self, settings: AppSettings) -> None:
		self._path.parent.mkdir(parents=True, exist_ok=True)
		payload = settings.model_dump(mode="json")
		self._path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
