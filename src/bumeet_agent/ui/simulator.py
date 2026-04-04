"""Tkinter-based simulation viewer for the local agent."""

from __future__ import annotations

import asyncio
import queue
import threading
import tkinter as tk
from dataclasses import dataclass
from tkinter import ttk
from typing import Any

from bumeet_agent.events.models import AgentEvent
from bumeet_agent.simulation import run_simulation_session


@dataclass(slots=True)
class UiEventRecord:
    topic: str
    payload: dict[str, Any]


class SimulationViewer:
    """Small desktop window to visualize simulation flow and BLE writes."""

    def __init__(self) -> None:
        self._root = tk.Tk()
        self._root.title("BUMEET Simulation")
        self._root.geometry("980x680")
        self._queue: queue.Queue[tuple[str, Any]] = queue.Queue()
        self._simulation_thread: threading.Thread | None = None

        self._scenario_var = tk.StringVar(value="default")
        self._delay_scale_var = tk.StringVar(value="1.0")
        self._status_var = tk.StringVar(value="Idle")
        self._occupancy_var = tk.StringVar(value="free")
        self._ble_var = tk.StringVar(value="disconnected")
        self._payload_var = tk.StringVar(value="-")
        self._resource_var = tk.StringVar(value="-")
        self._event_count_var = tk.StringVar(value="0")

        self._event_log: list[UiEventRecord] = []

        self._build_layout()
        self._root.after(100, self._drain_queue)

    def run(self) -> None:
        self._root.mainloop()

    def _build_layout(self) -> None:
        container = ttk.Frame(self._root, padding=16)
        container.pack(fill=tk.BOTH, expand=True)
        container.columnconfigure(0, weight=1)
        container.rowconfigure(2, weight=1)

        header = ttk.Frame(container)
        header.grid(row=0, column=0, sticky="ew")
        header.columnconfigure(6, weight=1)

        ttk.Label(header, text="Scenario").grid(row=0, column=0, sticky="w", padx=(0, 8))
        ttk.Combobox(
            header,
            textvariable=self._scenario_var,
            state="readonly",
            values=("default", "bounce", "camera-only"),
            width=16,
        ).grid(row=0, column=1, sticky="w")

        ttk.Label(header, text="Delay scale").grid(row=0, column=2, sticky="w", padx=(16, 8))
        ttk.Entry(header, textvariable=self._delay_scale_var, width=8).grid(row=0, column=3, sticky="w")

        ttk.Button(header, text="Run simulation", command=self._start_simulation).grid(row=0, column=4, padx=(16, 8))
        ttk.Button(header, text="Clear log", command=self._clear_log).grid(row=0, column=5)

        status_frame = ttk.LabelFrame(container, text="Current state", padding=12)
        status_frame.grid(row=1, column=0, sticky="ew", pady=(16, 16))

        items = [
            ("App", self._status_var),
            ("Occupancy", self._occupancy_var),
            ("BLE", self._ble_var),
            ("Last payload", self._payload_var),
            ("Resources", self._resource_var),
            ("Events", self._event_count_var),
        ]
        for index, (label, value) in enumerate(items):
            ttk.Label(status_frame, text=label).grid(row=0, column=index * 2, sticky="w", padx=(0, 8))
            ttk.Label(status_frame, textvariable=value).grid(row=0, column=index * 2 + 1, sticky="w", padx=(0, 18))

        body = ttk.Panedwindow(container, orient=tk.HORIZONTAL)
        body.grid(row=2, column=0, sticky="nsew")

        left = ttk.Frame(body, padding=4)
        right = ttk.Frame(body, padding=4)
        body.add(left, weight=3)
        body.add(right, weight=2)

        left.rowconfigure(0, weight=1)
        left.columnconfigure(0, weight=1)
        right.rowconfigure(1, weight=1)
        right.columnconfigure(0, weight=1)

        self._log_widget = tk.Text(left, wrap="none", state="disabled", font=("Menlo", 11))
        self._log_widget.grid(row=0, column=0, sticky="nsew")

        log_scroll = ttk.Scrollbar(left, orient="vertical", command=self._log_widget.yview)
        log_scroll.grid(row=0, column=1, sticky="ns")
        self._log_widget.configure(yscrollcommand=log_scroll.set)

        ttk.Label(right, text="Legend", font=("Helvetica", 12, "bold")).grid(row=0, column=0, sticky="w", pady=(0, 8))
        legend = ttk.Label(
            right,
            text=(
                "detection.updated: snapshot del detector\n"
                "occupancy.changed: free/busy\n"
                "ble.payload_sent: bytes escritos al periferico fake\n"
                "simulation.completed: fin del escenario"
            ),
            justify=tk.LEFT,
        )
        legend.grid(row=1, column=0, sticky="nw")

    def _start_simulation(self) -> None:
        if self._simulation_thread and self._simulation_thread.is_alive():
            return

        scenario = self._scenario_var.get()
        try:
            delay_scale = float(self._delay_scale_var.get())
        except ValueError:
            delay_scale = 1.0
            self._delay_scale_var.set("1.0")

        self._status_var.set("Running")
        self._append_log(f"Starting scenario={scenario} delay_scale={delay_scale}")

        def runner() -> None:
            async def consume(event: AgentEvent) -> None:
                self._queue.put(("event", event))

            async def execute() -> None:
                try:
                    await run_simulation_session(
                        scenario=scenario,
                        delay_scale=delay_scale,
                        event_consumer=consume,
                    )
                except Exception as exc:
                    self._queue.put(("error", str(exc)))
                else:
                    self._queue.put(("done", None))

            asyncio.run(execute())

        self._simulation_thread = threading.Thread(target=runner, daemon=True)
        self._simulation_thread.start()

    def _clear_log(self) -> None:
        self._event_log.clear()
        self._event_count_var.set("0")
        self._payload_var.set("-")
        self._resource_var.set("-")
        self._occupancy_var.set("free")
        self._ble_var.set("disconnected")
        self._status_var.set("Idle")
        self._set_log_contents("")

    def _drain_queue(self) -> None:
        while True:
            try:
                kind, payload = self._queue.get_nowait()
            except queue.Empty:
                break

            if kind == "event":
                assert isinstance(payload, AgentEvent)
                self._handle_event(payload)
            elif kind == "error":
                self._status_var.set("Error")
                self._append_log(f"ERROR: {payload}")
            elif kind == "done":
                self._status_var.set("Completed")
                self._append_log("Simulation finished")

        self._root.after(100, self._drain_queue)

    def _handle_event(self, event: AgentEvent) -> None:
        self._event_log.append(UiEventRecord(topic=event.topic, payload=event.payload))
        self._event_count_var.set(str(len(self._event_log)))

        if event.topic == "ble.connected":
            self._ble_var.set("connected")
        elif event.topic == "ble.disconnected":
            self._ble_var.set("disconnected")
        elif event.topic == "ble.payload_sent":
            self._payload_var.set(event.payload.get("payload_hex", "-"))
        elif event.topic == "detection.updated":
            resources = event.payload.get("active_resources", [])
            self._resource_var.set(", ".join(resources) if resources else "none")
        elif event.topic == "occupancy.changed":
            self._occupancy_var.set(event.payload.get("current_status", "unknown"))
        elif event.topic == "simulation.started":
            self._status_var.set("Running")
        elif event.topic == "simulation.completed":
            self._status_var.set("Completed")

        self._append_log(f"{event.topic}: {event.payload}")

    def _append_log(self, line: str) -> None:
        current = self._log_widget.get("1.0", tk.END).strip()
        next_content = f"{current}\n{line}".strip() if current else line
        self._set_log_contents(next_content)

    def _set_log_contents(self, text: str) -> None:
        self._log_widget.configure(state="normal")
        self._log_widget.delete("1.0", tk.END)
        self._log_widget.insert(tk.END, text + ("\n" if text else ""))
        self._log_widget.see(tk.END)
        self._log_widget.configure(state="disabled")


def launch_simulation_viewer() -> None:
    """Launch the desktop simulation window."""

    viewer = SimulationViewer()
    viewer.run()
