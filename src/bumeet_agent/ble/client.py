"""BLE client wrapper around bleak."""

from __future__ import annotations

import asyncio
from typing import Any, Callable

from bumeet_agent.ble.protocol import PresenceState, payload_for_state
from bumeet_agent.config import BleSettings
from bumeet_agent.events.bus import AsyncEventBus
from bumeet_agent.events.models import EventTopic
from bumeet_agent.logging import get_logger

try:
    from bleak import BleakClient, BleakScanner
except Exception:  # pragma: no cover
    BleakClient = None  # type: ignore[assignment]
    BleakScanner = None  # type: ignore[assignment]

logger = get_logger(__name__)

# How long to scan for the device on each retry attempt.
_SCAN_TIMEOUT_S = 15.0
# Gap between retry attempts (CoreInk wakes every 10 min; retry every 30 s so
# we catch the next available advertising window quickly).
_RETRY_INTERVAL_S = 30.0


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

    async def send_when_available(self, payload: bytes, *, give_up_after: float = 3600.0) -> None:
        """Send payload as soon as the device is reachable, retrying every 30 s.

        The CoreInk wakes every 10 minutes for a 20-second advertising window.
        This method scans for the device and connects the moment it appears.
        Retries until success or give_up_after seconds have elapsed.
        """
        if not self._settings.is_configured:
            logger.warning("BLE not configured — skipping send")
            return

        deadline = asyncio.get_event_loop().time() + give_up_after
        attempt = 0

        while asyncio.get_event_loop().time() < deadline:
            attempt += 1
            try:
                # Scan first: wait until the device advertises before connecting.
                # This is more reliable than blind connect when the device sleeps.
                logger.debug("BLE scan attempt %d for %s", attempt, self._settings.device_address)
                found = await self._scan_for_device(timeout=_SCAN_TIMEOUT_S)
                if not found:
                    logger.debug("Device not found in scan, retrying in %ds", int(_RETRY_INTERVAL_S))
                    await asyncio.sleep(_RETRY_INTERVAL_S)
                    continue

                await self.disconnect()   # clean up any stale connection
                await self.send_payload(payload)
                await self.disconnect()
                logger.debug("Payload delivered after %d attempt(s)", attempt)
                return

            except Exception as exc:
                logger.debug("Delivery attempt %d failed: %s", attempt, exc)
                await self.disconnect()
                await asyncio.sleep(_RETRY_INTERVAL_S)

        logger.warning("Could not deliver BLE payload within %.0f s", give_up_after)

    async def _scan_for_device(self, timeout: float) -> bool:
        """Return True if the configured device address is seen advertising."""
        if BleakScanner is None:
            # bleak unavailable — optimistically try to connect directly
            return True

        target = self._settings.device_address.upper()
        found_event = asyncio.Event()

        def _cb(device: Any, _adv: Any) -> None:
            if device.address.upper() == target:
                found_event.set()

        try:
            async with BleakScanner(detection_callback=_cb):
                await asyncio.wait_for(found_event.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False

    def _default_client_factory(self, address: str) -> Any:
        if BleakClient is None:
            raise RuntimeError("bleak is not available in the current environment")
        return BleakClient(address)
