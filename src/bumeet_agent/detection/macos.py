"""macOS hardware detector using CoreAudio (mic) and IOKit subprocess (camera)."""

from __future__ import annotations

import asyncio
import ctypes
import ctypes.util
import struct
import subprocess
from concurrent.futures import ThreadPoolExecutor

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
_kAudioDevicePropertyDeviceUID = _fourcc("uid ")
_kAudioDevicePropertyNominalSampleRate = _fourcc("nsrt")
_kCFStringEncodingUTF8 = 0x08000100
# Bluetooth switches from A2DP (44.1/48 kHz) to HFP/HSP (8–16 kHz) only for
# active calls. Non-BT mics (built-in, USB) never drop below 44.1 kHz.
_BT_HFP_MAX_SAMPLE_RATE = 16_000

# Virtual audio device UID fragments created by meeting apps.
# Present (and running) even when the user's mic is muted — the device plays
# remote participant audio, so is_running=True reliably signals an active call.
_MEETING_APP_UID_FRAGMENTS = (
    "Teams",  # Microsoft Teams Audio Device
    "ZoomAudio",  # Zoom
    "WebexAudio",  # Cisco Webex
    "Cisco_Spark",  # older Webex
)


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


def _load_core_foundation() -> ctypes.CDLL | None:
    try:
        lib = ctypes.CDLL("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation")
        lib.CFStringGetCString.restype = ctypes.c_bool
        lib.CFStringGetCString.argtypes = [
            ctypes.c_void_p,
            ctypes.c_char_p,
            ctypes.c_long,
            ctypes.c_uint32,
        ]
        lib.CFRelease.argtypes = [ctypes.c_void_p]
        return lib
    except Exception:
        return None


def _get_device_uid(
    core_audio: ctypes.CDLL, core_foundation: ctypes.CDLL, device_id: int
) -> str | None:
    """Return the UID string for a CoreAudio device, or None on failure."""
    addr = _PropertyAddress(
        mSelector=_kAudioDevicePropertyDeviceUID,
        mScope=_kAudioObjectPropertyScopeGlobal,
        mElement=_kAudioObjectPropertyElementMain,
    )
    cf_string = ctypes.c_void_p(0)
    size = ctypes.c_uint32(ctypes.sizeof(ctypes.c_void_p))
    err = core_audio.AudioObjectGetPropertyData(
        ctypes.c_uint32(device_id),
        ctypes.byref(addr),
        ctypes.c_uint32(0),
        None,
        ctypes.byref(size),
        ctypes.byref(cf_string),
    )
    if err != 0 or not cf_string.value:
        return None
    buf = ctypes.create_string_buffer(256)
    ok = core_foundation.CFStringGetCString(cf_string, buf, 256, _kCFStringEncodingUTF8)
    core_foundation.CFRelease(cf_string)
    return buf.value.decode("utf-8", errors="replace") if ok else None


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
    return bool(n_buffers > 0)


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
            if _audio_device_has_input_streams(lib, device_id) and _audio_device_is_running(
                lib, device_id
            ):
                return True
    except Exception:
        logger.exception("CoreAudio mic check raised an unexpected exception")
    return False


def _get_device_sample_rate(lib: ctypes.CDLL, device_id: int) -> float | None:
    """Return the nominal sample rate of an audio device, or None on error."""
    addr = _PropertyAddress(
        mSelector=_kAudioDevicePropertyNominalSampleRate,
        mScope=_kAudioObjectPropertyScopeGlobal,
        mElement=_kAudioObjectPropertyElementMain,
    )
    value = ctypes.c_double(0.0)
    size = ctypes.c_uint32(ctypes.sizeof(ctypes.c_double))
    err = lib.AudioObjectGetPropertyData(
        ctypes.c_uint32(device_id),
        ctypes.byref(addr),
        ctypes.c_uint32(0),
        None,
        ctypes.byref(size),
        ctypes.byref(value),
    )
    return float(value.value) if err == 0 else None


def _poll_bt_hfp_call() -> bool:
    """Return True if a Bluetooth headset is in an active HFP/HSP call.

    macOS switches a BT headset from A2DP (44.1/48 kHz) to HFP/HSP (8–16 kHz)
    when a call starts. However, after the call ends the INPUT side can stay at
    16 kHz for a while before switching back (residual HFP state). To avoid this
    false positive we require BOTH the input AND output counterpart of the same
    BT device to be at ≤ 16 kHz — the output reverts to 44.1 kHz as soon as the
    call ends, so this pair-check is much more precise.

    BT device UIDs follow the pattern '<MAC>:input' / '<MAC>:output'.
    """
    lib = _load_core_audio()
    cf = _load_core_foundation()
    if lib is None or cf is None:
        return False
    try:
        # Build a map of uid_prefix → sample_rate for all devices
        rates: dict[str, float] = {}
        for device_id in _audio_get_devices(lib):
            uid = _get_device_uid(lib, cf, device_id)
            rate = _get_device_sample_rate(lib, device_id)
            if uid and rate is not None:
                rates[uid] = rate

        for uid, rate in rates.items():
            if not uid.endswith(":input"):
                continue
            if not (0 < rate <= _BT_HFP_MAX_SAMPLE_RATE):
                continue
            # Check the output peer of the same BT device
            output_uid = uid[: -len(":input")] + ":output"
            output_rate = rates.get(output_uid)
            if output_rate is not None and 0 < output_rate <= _BT_HFP_MAX_SAMPLE_RATE:
                logger.debug(
                    "BT HFP call: input=%s %.0fHz, output=%s %.0fHz",
                    uid,
                    rate,
                    output_uid,
                    output_rate,
                )
                return True
    except Exception:
        logger.debug("BT HFP call check failed", exc_info=True)
    return False


def _poll_meeting_app_audio() -> bool:
    """Return True if a known meeting-app virtual audio device is actively running.

    Covers the case where the user is in a Teams/Zoom/Webex call with the mic
    muted — the virtual device continues playing remote audio, so is_running is
    True even though the physical microphone is not capturing anything.
    """
    core_audio = _load_core_audio()
    core_foundation = _load_core_foundation()
    if core_audio is None or core_foundation is None:
        return False
    try:
        for device_id in _audio_get_devices(core_audio):
            if not _audio_device_is_running(core_audio, device_id):
                continue
            uid = _get_device_uid(core_audio, core_foundation, device_id)
            if uid and any(frag in uid for frag in _MEETING_APP_UID_FRAGMENTS):
                logger.debug("Meeting-app device active: %s (device %d)", uid, device_id)
                return True
    except Exception:
        logger.debug("Meeting-app audio check failed", exc_info=True)
    return False


def _poll_camera() -> bool:
    """Return True if the camera is currently in use (blocking).

    Primary path: query the AppleH13CamIn IOKit entry present on Apple Silicon Macs.
    FrontCameraActive becomes Yes as soon as any process opens the camera.

    Fallback: IOVideoDeviceStream entries are created by the CMIO layer when a
    capture session starts (covers USB cameras and Intel Macs).
    """
    # Apple Silicon built-in camera — authoritative when the class is present.
    primary_conclusive = False
    try:
        result = subprocess.run(
            ["ioreg", "-r", "-c", "AppleH13CamIn", "-d", "2"],
            capture_output=True,
            text=True,
            timeout=2,
        )
        if result.returncode == 0 and result.stdout:
            primary_conclusive = True
            stdout = result.stdout
            if '"FrontCameraActive" = Yes' in stdout or '"FrontCameraStreaming" = Yes' in stdout:
                return True
    except Exception as exc:
        logger.debug("AppleH13CamIn camera check failed: %s", exc)

    # If the Apple Silicon class answered, trust it: the CMIO fallback below keys
    # on mere *existence* of a stream entry and false-positives, so only use it
    # when the primary class is absent (USB cameras / Intel Macs).
    if primary_conclusive:
        return False

    # CMIO fallback (USB cameras / Intel Macs)
    try:
        result = subprocess.run(
            ["ioreg", "-r", "-c", "IOVideoDeviceStream", "-d", "1"],
            capture_output=True,
            text=True,
            timeout=2,
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
        # Dedicated single-thread executor so detection isn't starved by BLE/API
        # work competing for the default thread pool.
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="macos-detect")
        # Camera join/leave is not latency-critical; poll it far less often than
        # the mic to cut ioreg subprocess spawns (~7.5x fewer at 15 s vs 2 s).
        self._camera_interval = 15.0
        self._last_camera = False
        self._last_camera_check = 0.0

    async def start(self, callback: DetectionCallback) -> None:
        self._stop_event = asyncio.Event()
        loop = asyncio.get_running_loop()
        while not self._stop_event.is_set():
            try:
                now = loop.time()
                poll_camera = (now - self._last_camera_check) >= self._camera_interval
                snapshot = await loop.run_in_executor(
                    self._executor, _take_snapshot, poll_camera, self._last_camera
                )
                if poll_camera:
                    self._last_camera = snapshot.camera_in_use
                    self._last_camera_check = now
                result = callback(snapshot)
                if asyncio.iscoroutine(result):
                    await result
            except Exception:
                # One bad iteration (ioreg hiccup, callback error) must not kill
                # the detector — log and keep polling.
                logger.exception("macOS detection iteration failed; continuing")
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._poll_interval)
                break  # stop was requested; exit cleanly
            except TimeoutError:
                pass  # normal poll interval elapsed; continue

    async def stop(self) -> None:
        if self._stop_event is not None:
            self._stop_event.set()
        self._executor.shutdown(wait=False)


def _take_snapshot(poll_camera: bool = True, last_camera: bool = False) -> HardwareSnapshot:
    return HardwareSnapshot(
        camera_in_use=_poll_camera() if poll_camera else last_camera,
        microphone_in_use=_poll_microphone() or _poll_bt_hfp_call() or _poll_meeting_app_audio(),
        source="macos:poll",
    )
