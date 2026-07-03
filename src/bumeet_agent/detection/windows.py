"""Windows hardware detector using the Capability Access Manager registry.

Windows records per-app microphone/camera ("videocapture") usage under
``HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore``.
For each app subkey, ``LastUsedTimeStart`` is the FILETIME the app began using the
device and ``LastUsedTimeStop`` is when it stopped — ``LastUsedTimeStop == 0`` while
``LastUsedTimeStart != 0`` means the device is *currently in use*. Packaged apps live
directly under the capability key; classic (win32) apps live under a ``NonPackaged``
child whose own subkeys carry the timestamps.
"""

# winreg is a Windows-only stdlib module; when type-checking on macOS/Linux its
# symbols resolve to nothing. The whole module only runs on win32.
# mypy: disable-error-code="attr-defined"

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from bumeet_agent.detection.base import DetectionCallback, HardwareDetector
from bumeet_agent.domain.status import HardwareSnapshot
from bumeet_agent.logging import get_logger

logger = get_logger(__name__)

_CONSENT_STORE = r"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore"


def _scan_consent_key(key: Any) -> bool:
    """Return True if any app subkey shows the device currently in use."""
    import winreg  # Windows-only; imported lazily so the module loads anywhere

    sub_count, _, _ = winreg.QueryInfoKey(key)
    for index in range(sub_count):
        try:
            name = winreg.EnumKey(key, index)
            sub = winreg.OpenKey(key, name)
        except OSError:
            continue
        try:
            if name == "NonPackaged":
                # win32 apps are nested one level deeper.
                if _scan_consent_key(sub):
                    return True
                continue
            try:
                stop, _ = winreg.QueryValueEx(sub, "LastUsedTimeStop")
                start, _ = winreg.QueryValueEx(sub, "LastUsedTimeStart")
            except OSError:
                continue
            if start and stop == 0:
                return True
        finally:
            winreg.CloseKey(sub)
    return False


def _capability_in_use(capability: str) -> bool:
    """capability is 'microphone' or 'videocapture' (the camera consent key)."""
    import winreg

    try:
        root = winreg.OpenKey(winreg.HKEY_CURRENT_USER, f"{_CONSENT_STORE}\\{capability}")
    except OSError:
        return False
    try:
        return _scan_consent_key(root)
    finally:
        winreg.CloseKey(root)


def _take_snapshot() -> HardwareSnapshot:
    return HardwareSnapshot(
        camera_in_use=_capability_in_use("videocapture"),
        microphone_in_use=_capability_in_use("microphone"),
        source="windows:registry",
    )


class WindowsHardwareDetector(HardwareDetector):
    """Poll the Capability Access Manager registry for camera/microphone usage."""

    def __init__(self, poll_interval: float = 2.0) -> None:
        self._poll_interval = poll_interval
        self._stop_event: asyncio.Event | None = None
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="win-detect")

    async def start(self, callback: DetectionCallback) -> None:
        self._stop_event = asyncio.Event()
        loop = asyncio.get_running_loop()
        while not self._stop_event.is_set():
            try:
                snapshot = await loop.run_in_executor(self._executor, _take_snapshot)
                result = callback(snapshot)
                if asyncio.iscoroutine(result):
                    await result
            except Exception:
                logger.exception("Windows detection iteration failed; continuing")
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._poll_interval)
                break  # stop requested; exit cleanly
            except TimeoutError:
                pass  # normal poll interval elapsed; continue

    async def stop(self) -> None:
        if self._stop_event is not None:
            self._stop_event.set()
        self._executor.shutdown(wait=False)
