"""BLE client wrapper around bleak."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any

from bumeet_agent.ble.protocol import PresenceState, payload_for_state
from bumeet_agent.config import BleSettings
from bumeet_agent.events.bus import AsyncEventBus
from bumeet_agent.events.models import EventTopic
from bumeet_agent.logging import get_logger

try:
    from bleak import BleakClient, BleakScanner
except Exception:  # pragma: no cover
    BleakClient = None  # type: ignore
    BleakScanner = None  # type: ignore

logger = get_logger(__name__)

_RECONNECT_INTERVAL_S = 5.0
# macOS CoreBluetooth drops idle BLE connections after ~45 s with no traffic.
# Sending a keepalive write every 20 s prevents this.
_KEEPALIVE_INTERVAL_S = 20.0
# Generous timeout so write_now survives the initial ~30 s scan+connect.
_WRITE_WAIT_S = 60.0


class BleClient:
    """Async BLE GATT client with persistent connection and keepalive.

    Maintains a persistent background connection so state changes are
    delivered in <100 ms. Sends a keepalive write every 20 s to prevent
    macOS from dropping the idle link.
    """

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
        self._keep_connected = False
        self._connection_task: asyncio.Task[None] | None = None
        self._connected_event = asyncio.Event()
        self._last_payload: bytes = b"FREE"
        # Monotonic time of the last successful GATT write (keepalive or real).
        # Shared across both paths so keepalive backs off after a real write.
        self._last_write_time: float = 0.0

    @property
    def is_connected(self) -> bool:
        return bool(self._client and getattr(self._client, "is_connected", False))

    # ── Persistent connection ─────────────────────────────────────────────────

    async def start_persistent_connection(self) -> None:
        """Start background task that keeps the BLE connection alive."""
        if not self._settings.is_configured:
            return
        self._keep_connected = True
        self._connection_task = asyncio.create_task(self._connection_loop())

    async def stop_persistent_connection(self) -> None:
        self._keep_connected = False
        if self._connection_task and not self._connection_task.done():
            self._connection_task.cancel()
        await self.disconnect()

    async def _connection_loop(self) -> None:
        """Reconnect on drops; send keepalive every 20 s to beat macOS idle timeout."""
        while self._keep_connected:
            now = asyncio.get_event_loop().time()

            if not self.is_connected:
                self._connected_event.clear()
                try:
                    await self.connect()
                    # Re-send current state immediately after reconnect so the
                    # e-ink display is always in sync even after a firmware reboot.
                    assert self._client is not None
                    await self._client.write_gatt_char(
                        self._settings.characteristic_uuid,
                        self._last_payload,
                        response=False,
                    )
                    self._last_write_time = asyncio.get_event_loop().time()
                    self._connected_event.set()
                    logger.debug("BLE reconnect sync sent")
                except Exception as exc:
                    logger.debug("Reconnect failed: %s — retry in %.0fs", exc, _RECONNECT_INTERVAL_S)
                    await asyncio.sleep(_RECONNECT_INTERVAL_S)
                    continue

            elif now - self._last_write_time >= _KEEPALIVE_INTERVAL_S:
                # Re-write last payload only if no real write happened recently.
                # Firmware deduplicates identical payloads — no display refresh.
                try:
                    assert self._client is not None
                    await self._client.write_gatt_char(
                        self._settings.characteristic_uuid,
                        self._last_payload,
                        response=False,
                    )
                    self._last_write_time = asyncio.get_event_loop().time()
                    logger.debug("BLE keepalive sent")
                except Exception as exc:
                    logger.debug("Keepalive failed: %s — will reconnect", exc)
                    await self.disconnect()
                    continue

            await asyncio.sleep(1)

    # ── Write ─────────────────────────────────────────────────────────────────

    async def write_now(self, payload: bytes) -> None:
        """Write payload via persistent connection.

        Waits up to 60 s for the connection to be ready (covers initial
        scan+connect), then writes. Retries once on transient failure.
        """
        if not self._settings.is_configured:
            return

        self._last_payload = payload

        try:
            await asyncio.wait_for(self._connected_event.wait(), timeout=_WRITE_WAIT_S)
        except TimeoutError:
            logger.warning("BLE write skipped — device not reachable within %.0fs", _WRITE_WAIT_S)
            return

        for attempt in range(2):
            try:
                await self.send_payload(payload)
                return
            except Exception as exc:
                logger.debug("Write attempt %d failed: %s", attempt + 1, exc)
                self._connected_event.clear()
                await self.disconnect()
                if attempt == 0:
                    try:
                        await asyncio.wait_for(
                            self._connected_event.wait(), timeout=_WRITE_WAIT_S
                        )
                    except TimeoutError:
                        break

        logger.warning("BLE write failed after retries")

    # ── Low-level connection management ──────────────────────────────────────

    async def connect(self) -> None:
        if not self._settings.is_configured:
            raise ValueError("BLE settings incomplete.")

        async with self._lock:
            if self.is_connected:
                return

            await self._event_bus.emit(
                EventTopic.BLE_CONNECTING.value, address=self._settings.device_address
            )
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
            await self._event_bus.emit(
                EventTopic.BLE_CONNECTED.value, address=self._settings.device_address
            )

    async def disconnect(self) -> None:
        async with self._lock:
            if not self._client:
                return
            try:
                if getattr(self._client, "is_connected", False):
                    await self._client.disconnect()
            finally:
                self._client = None
                self._connected_event.clear()
                await self._event_bus.emit(
                    EventTopic.BLE_DISCONNECTED.value,
                    address=self._settings.device_address,
                )

    async def ensure_connected(self) -> None:
        if not self.is_connected:
            await self.connect()

    async def send_payload(self, payload: bytes) -> None:
        await self.ensure_connected()
        assert self._client is not None

        try:
            await self._client.write_gatt_char(
                self._settings.characteristic_uuid,
                payload,
                response=self._settings.write_with_response,
            )
            self._last_write_time = asyncio.get_event_loop().time()
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

    async def send_state(self, state: PresenceState) -> bytes:
        payload = payload_for_state(state, self._settings)
        await self.send_payload(payload)
        return payload

    # ── Fallback for heartbeat ────────────────────────────────────────────────

    async def send_when_available(self, payload: bytes, *, give_up_after: float = 3600.0) -> None:
        """Fallback: alias to write_now for heartbeat compatibility."""
        await self.write_now(payload)

    def _default_client_factory(self, address: str) -> Any:
        if BleakClient is None:
            raise RuntimeError("bleak is not available in the current environment")
        return BleakClient(address)
