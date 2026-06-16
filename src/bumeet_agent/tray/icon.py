"""System tray icon reflecting BUMEET agent status."""

from __future__ import annotations

import webbrowser
from collections.abc import Callable

import pystray
from PIL import Image, ImageDraw, ImageFont

DASHBOARD_URL = "https://app.bumeet.es"

# Status keyword → RGB fill color
_COLOR: dict[str, tuple[int, int, int]] = {
    "FREE": (34, 197, 94),  # green-500
    "BUSY": (239, 68, 68),  # red-500
    "UPCOMING": (245, 158, 11),  # amber-500
    "OFFLINE": (156, 163, 175),  # gray-400
}


def _make_icon(status: str) -> Image.Image:
    """Render a 64×64 colored circle with a white 'B' centred on it."""
    rgb = _COLOR.get(status, _COLOR["OFFLINE"])
    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([0, 0, size - 1, size - 1], fill=(*rgb, 255))
    try:
        font: ImageFont.ImageFont | ImageFont.FreeTypeFont = ImageFont.load_default(size=40)
    except TypeError:
        # Pillow < 10.1 — load_default() takes no arguments
        font = ImageFont.load_default()
    text = "B"
    bbox = draw.textbbox((0, 0), text, font=font)
    x = (size - (bbox[2] - bbox[0])) // 2 - bbox[0]
    y = (size - (bbox[3] - bbox[1])) // 2 - bbox[1]
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)
    return img


class TrayIcon:
    """System tray icon for the BUMEET agent.

    Lifecycle:
        tray = TrayIcon()
        tray.start(setup_fn)   # blocks the calling thread; setup_fn runs in a background thread
        tray.stop()            # call from any thread to dismiss the icon
    """

    def __init__(self) -> None:
        self._payload = "BUMEET · Starting…"
        self._status = "OFFLINE"
        self._icon: pystray.Icon | None = None
        self._quit_fn: Callable[[], None] | None = None

    def register_quit(self, fn: Callable[[], None]) -> None:
        """Register a callback to invoke when the user clicks Quit.

        Called from the tray/AppKit thread — fn must be thread-safe (e.g. call
        loop.call_soon_threadsafe internally).
        """
        self._quit_fn = fn

    def set_payload(self, payload: str) -> None:
        """Update the icon colour and tooltip. Safe to call from any thread."""
        self._payload = payload
        word = payload.split(" · ")[0].strip()
        self._status = word if word in _COLOR else ("BUSY" if word else "OFFLINE")
        if self._icon is not None:
            self._icon.icon = _make_icon(self._status)
            self._icon.title = payload
            self._icon.update_menu()

    # ── pystray menu ──────────────────────────────────────────────────────────

    def _build_menu(self) -> pystray.Menu:
        return pystray.Menu(
            # Dynamic title — re-evaluated on every update_menu() call
            pystray.MenuItem(lambda i, item: self._payload, None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                "Open Dashboard",
                lambda i, item: webbrowser.open(DASHBOARD_URL),
                default=True,
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit", self._on_quit),
        )

    def _on_quit(self, icon: pystray.Icon, item: pystray.MenuItem) -> None:
        if self._quit_fn is not None:
            self._quit_fn()
        icon.stop()

    # ── lifecycle ─────────────────────────────────────────────────────────────

    def start(self, setup: Callable[[pystray.Icon], None]) -> None:
        """Start the tray icon. Blocks the calling thread until stop() is called.

        pystray calls *setup* in a background thread on all platforms, so the
        asyncio event loop can live there while AppKit/Win32 owns this thread.
        """
        self._icon = pystray.Icon(
            name="BUMEET",
            icon=_make_icon("OFFLINE"),
            title="BUMEET · Starting…",
            menu=self._build_menu(),
        )
        self._icon.run(setup=setup)

    def stop(self) -> None:
        """Stop the tray icon. Safe to call from any thread (no-op if not started)."""
        if self._icon is not None:
            self._icon.stop()
