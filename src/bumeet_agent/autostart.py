"""Self-install as a startup service on first run (frozen binary only).

When the user downloads and double-clicks the binary directly (bypassing the
DMG/pkg installer), this module registers the agent to start automatically at
login — no terminal required.

On macOS: creates ~/Library/LaunchAgents/es.bumeet.agent.plist.
On Windows: registers a Task Scheduler task.

This is a no-op when:
  - Running from Python source (development / CI).
  - The service is already registered (subsequent starts).
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

from bumeet_agent.logging import get_logger

logger = get_logger(__name__)

_PLIST_LABEL = "es.bumeet.agent"
_TASK_NAME = "BUMEET Agent"


# ── path helpers ──────────────────────────────────────────────────────────────


def _install_dir() -> Path:
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "BUMEET"
    if sys.platform == "win32":
        localappdata = os.environ.get("LOCALAPPDATA", str(Path.home()))
        return Path(localappdata) / "BUMEET"
    return Path.home() / ".local" / "share" / "bumeet"


def _log_dir() -> Path:
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Logs" / "BUMEET"
    return _install_dir() / "Logs"


def _installed_binary() -> Path:
    name = "bumeet-agent.exe" if sys.platform == "win32" else "bumeet-agent"
    return _install_dir() / name


def _plist_path() -> Path:
    return Path.home() / "Library" / "LaunchAgents" / f"{_PLIST_LABEL}.plist"


# ── public API ────────────────────────────────────────────────────────────────


def is_registered() -> bool:
    """Return True if already registered as a startup service."""
    if sys.platform == "darwin":
        return _plist_path().exists()
    if sys.platform == "win32":
        try:
            r = subprocess.run(
                ["schtasks", "/Query", "/TN", _TASK_NAME],
                capture_output=True,
                timeout=5,
            )
            return r.returncode == 0
        except Exception:
            return False
    return True  # unknown platform: assume external management


def ensure_autostart() -> None:
    """If not already a startup service, register silently. No-op from source."""
    if not getattr(sys, "frozen", False):
        return  # running from Python source — skip
    if is_registered():
        return  # already installed

    logger.info("First run — registering as startup service…")
    try:
        if sys.platform == "darwin":
            _install_macos()
        elif sys.platform == "win32":
            _install_windows()
    except Exception:
        logger.exception("Autostart registration failed — continuing without it")


# ── platform implementations ──────────────────────────────────────────────────


def _copy_binary() -> Path:
    """Copy this executable to the permanent install directory."""
    src = Path(sys.executable)
    dst = _installed_binary()
    if src.resolve() == dst.resolve():
        return dst  # already running from the install location
    _install_dir().mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    if sys.platform != "win32":
        dst.chmod(0o755)
    logger.info("Copied binary to %s", dst)
    return dst


def _install_macos() -> None:
    binary = _copy_binary()
    log_dir = _log_dir()
    log_dir.mkdir(parents=True, exist_ok=True)

    plist = _plist_path()
    plist.parent.mkdir(parents=True, exist_ok=True)
    # RunAtLoad=false — the current process is already running; launchd will
    # start it automatically on the next login.
    plist.write_text(
        f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>{_PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>{binary}</string></array>
  <key>RunAtLoad</key><false/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>{log_dir}/agent.log</string>
  <key>StandardErrorPath</key><string>{log_dir}/agent-error.log</string>
  <key>ThrottleInterval</key><integer>30</integer>
</dict>
</plist>
"""
    )
    subprocess.run(["launchctl", "unload", str(plist)], capture_output=True)
    subprocess.run(["launchctl", "load", "-w", str(plist)], capture_output=True, timeout=10)
    logger.info("Installed LaunchAgent — agent will start automatically at login")


def _install_windows() -> None:
    binary = _copy_binary()
    _log_dir().mkdir(parents=True, exist_ok=True)

    # Remove stale task before creating a new one
    subprocess.run(
        ["schtasks", "/Delete", "/TN", _TASK_NAME, "/F"],
        capture_output=True,
    )
    result = subprocess.run(
        [
            "schtasks",
            "/Create",
            "/TN",
            _TASK_NAME,
            "/TR",
            str(binary),
            "/SC",
            "ONLOGON",
            "/RL",
            "LIMITED",
            "/F",
        ],
        capture_output=True,
        timeout=10,
    )
    if result.returncode != 0:
        logger.warning(
            "Task Scheduler registration failed: %s",
            result.stderr.decode(errors="replace"),
        )
        return
    logger.info("Installed Task Scheduler task — agent will start automatically at login")
