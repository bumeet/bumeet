"""
Scan for nearby BLE devices and print their address and name.
Run this with the CoreInk powered on to find its MAC address.

Usage:
    PYTHONPATH=src python scripts/scan_ble.py

The CoreInk will appear as "BUMEET".  Copy its address into your agent config:

    ~/.config/bumeet-agent/config.json
    {
      "ble": {
        "device_address": "XX:XX:XX:XX:XX:XX",
        "characteristic_uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567892"
      }
    }
"""

import asyncio
from bleak import BleakScanner


async def main() -> None:
    print("Scanning for BLE devices (5 seconds)…\n")
    devices = await BleakScanner.discover(timeout=5.0)

    if not devices:
        print("No devices found. Make sure Bluetooth is enabled.")
        return

    # Sort: BUMEET first, then the rest alphabetically
    devices.sort(key=lambda d: (0 if (d.name or "").startswith("BUMEET") else 1, d.name or ""))

    print(f"{'Address':<20}  {'Name'}")
    print("-" * 50)
    for d in devices:
        marker = " ← CoreInk" if (d.name or "").startswith("BUMEET") else ""
        print(f"{d.address:<20}  {d.name or '(unknown)'}{marker}")


if __name__ == "__main__":
    asyncio.run(main())
