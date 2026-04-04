"""macOS hardware detector using CoreAudio (mic) and IOKit subprocess (camera)."""

from __future__ import annotations

import asyncio
import ctypes
import ctypes.util
import struct
import subprocess

from bumeet_agent.detection.base import DetectionCallback, HardwareDetector
from bumeet_agent.domain.status import HardwareSnapshot
from bumeet_agent.logging import get_logger

logger = get_logger(__name__)


# ── CoreAudio constants (verified against macOS 15.4 SDK AudioHardware.h) ────

def _fourcc(s: str) -> int:
    """Convert 4-char string to CoreAudio FourCC big-endian uint32."""
    b = s.encode("ascii")
    return (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]


_kAudioObjectSystemObject = 1
_kAudioObjectPropertyScopeGlobal = _fourcc("glob")
_kAudioObjectPropertyScopeInput = _fourcc("inpt")
_kAudioObjectPropertyElementMain = 0
_kAudioHardwarePropertyDevices = _fourcc("dev#")
_kAudioDevicePropertyDeviceIsRunningSomewhere = _fourcc("gone")
_kAudioDevicePropertyStreamConfiguration = _fourcc("slay")


class _PropertyAddress(ctypes.Structure):
    _fields_ = [
        ("mSelector", ctypes.c_uint32),
        ("mScope", ctypes.c_uint32),
        ("mElement", ctypes.c_uint32),
    ]


def _load_core_audio() -> ctypes.CDLL | None:
    path = ctypes.util.find_library("CoreAudio")
    if not path:
        return None
    try:
        lib = ctypes.CDLL(path)
        lib.AudioObjectGetPropertyDataSize.restype = ctypes.c_int32
        lib.AudioObjectGetPropertyData.restype = ctypes.c_int32
        return lib
    except Exception:
        return None


def _audio_get_devices(lib: ctypes.CDLL) -> list[int]:
    addr = _PropertyAddress(
        mSelector=_kAudioHardwarePropertyDevices,
        mScope=_kAudioObjectPropertyScopeGlobal,
        mElement=_kAudioObjectPropertyElementMain,
    )
    size = ctypes.c_uint32(0)
    err = lib.AudioObjectGetPropertyDataSize(
        ctypes.c_uint32(_kAudioObjectSystemObject),
        ctypes.byref(addr),
        ctypes.c_uint32(0),
        None,
        ctypes.byref(size),
    )
    if err != 0 or size.value == 0:
        return []
    count = size.value // ctypes.sizeof(ctypes.c_uint32)
    devices = (ctypes.c_uint32 * count)()
    err = lib.AudioObjectGetPropertyData(
        ctypes.c_uint32(_kAudioObjectSystemObject),
        ctypes.byref(addr),
        ctypes.c_uint32(0),
        None,
        ctypes.byref(size),
        devices,
    )
    return list(devices) if err == 0 else []


def _audio_device_has_input_streams(lib: ctypes.CDLL, device_id: int) -> bool:
    """Return True if the device has at least one input buffer (it is mic-capable)."""
    addr = _PropertyAddress(
        mSelector=_kAudioDevicePropertyStreamConfiguration,
        mScope=_kAudioObjectPropertyScopeInput,
        mElement=_kAudioObjectPropertyElementMain,
    )
    size = ctypes.c_uint32(0)
    err = lib.AudioObjectGetPropertyDataSize(
        ctypes.c_uint32(device_id),
        ctypes.byref(addr),
        ctypes.c_uint32(0),
        None,
        ctypes.byref(size),
    )
    if err != 0 or size.value < 4:
        return False
    buf = ctypes.create_string_buffer(size.value)
    err = lib.AudioObjectGetPropertyData(
        ctypes.c_uint32(device_id),
        ctypes.byref(addr),
        ctypes.c_uint32(0),
        None,
        ctypes.byref(size),
        buf,
    )
    if err != 0:
        return False
    # AudioBufferList.mNumberBuffers is the first uint32 (little-endian on macOS)
    (n_buffers,) = struct.unpack_from("<I", buf.raw)
    return n_buffers > 0


def _audio_device_is_running(lib: ctypes.CDLL, device_id: int) -> bool:
    """Return True if any process is currently using this audio device."""
    addr = _PropertyAddress(
        mSelector=_kAudioDevicePropertyDeviceIsRunningSomewhere,
        mScope=_kAudioObjectPropertyScopeGlobal,
        mElement=_kAudioObjectPropertyElementMain,
    )
    size = ctypes.c_uint32(ctypes.sizeof(ctypes.c_uint32))
    value = ctypes.c_uint32(0)
    err = lib.AudioObjectGetPropertyData(
        ctypes.c_uint32(device_id),
        ctypes.byref(addr),
        ctypes.c_uint32(0),
        None,
        ctypes.byref(size),
        ctypes.byref(value),
    )
    return err == 0 and value.value != 0


def _poll_microphone() -> bool:
    """Return True if any audio input device is currently in use (blocking)."""
    lib = _load_core_audio()
    if lib is None:
        logger.warning("CoreAudio not available; mic detection disabled")
        return False
    try:
        for device_id in _audio_get_devices(lib):
            if _audio_device_has_input_streams(lib, device_id) and _audio_device_is_running(lib, device_id):
                return True
    except Exception:
        logger.exception("CoreAudio mic check raised an unexpected exception")
    return False


def _poll_camera() -> bool:
    """Return True if the camera is currently in use (blocking).

    Primary path: query the AppleH13CamIn IOKit entry present on Apple Silicon Macs.
    FrontCameraActive becomes Yes as soon as any process opens the camera.

    Fallback: IOVideoDeviceStream entries are created by the CMIO layer when a
    capture session starts (covers USB cameras and Intel Macs).
    """
    # Apple Silicon built-in camera
    try:
        result = subprocess.run(
            ["ioreg", "-r", "-c", "AppleH13CamIn", "-d", "2"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if result.returncode == 0 and result.stdout:
            stdout = result.stdout
            if '"FrontCameraActive" = Yes' in stdout or '"FrontCameraStreaming" = Yes' in stdout:
                return True
    except Exception as exc:
        logger.debug("AppleH13CamIn camera check failed: %s", exc)

    # CMIO fallback (USB cameras / Intel Macs)
    try:
        result = subprocess.run(
            ["ioreg", "-r", "-c", "IOVideoDeviceStream", "-d", "1"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if result.returncode == 0 and result.stdout.strip():
            return True
    except Exception as exc:
        logger.debug("IOVideoDeviceStream camera check failed: %s", exc)

    return False


class MacOSHardwareDetector(HardwareDetector):
    """Poll CoreAudio and IOKit for camera/microphone activity on macOS.

    Runs both checks in a thread-pool executor to avoid blocking the event loop.
    Stops cleanly when :meth:`stop` is called.
    """

    def __init__(self, poll_interval: float = 2.0) -> None:
        self._poll_interval = poll_interval
        self._stop_event: asyncio.Event | None = None

    async def start(self, callback: DetectionCallback) -> None:
        self._stop_event = asyncio.Event()
        loop = asyncio.get_running_loop()
        while not self._stop_event.is_set():
            snapshot = await loop.run_in_executor(None, _take_snapshot)
            result = callback(snapshot)
            if asyncio.iscoroutine(result):
                await result
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._poll_interval)
                break  # stop was requested; exit cleanly
            except asyncio.TimeoutError:
                pass  # normal poll interval elapsed; continue

    async def stop(self) -> None:
        if self._stop_event is not None:
            self._stop_event.set()


def _take_snapshot() -> HardwareSnapshot:
    return HardwareSnapshot(
        camera_in_use=_poll_camera(),
        microphone_in_use=_poll_microphone(),
        source="macos:poll",
    )
