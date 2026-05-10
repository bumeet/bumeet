#!/usr/bin/env bash
# BUMEET agent — macOS installer
# Usage: curl -fsSL https://raw.githubusercontent.com/bumeet/bumeet/main/scripts/install-macos.sh | bash
#        or:  bash scripts/install-macos.sh [--token YOUR_API_TOKEN]
set -euo pipefail

REPO="bumeet/bumeet"
BINARY_NAME="bumeet-agent"
INSTALL_DIR="/usr/local/bin"
PLIST_LABEL="es.bumeet.agent"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
LOG_DIR="$HOME/Library/Logs/BUMEET"
CONFIG_DIR="$HOME/Library/Application Support/bumeet-agent"
CONFIG_FILE="$CONFIG_DIR/config.json"

API_TOKEN=""

# ── Parse args ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --token) API_TOKEN="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

echo "→ Installing BUMEET agent for macOS"

# ── Download latest release binary ───────────────────────────────────────────
LATEST=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | python3 -c "import sys,json; r=json.load(sys.stdin); print(r['tag_name'])")

echo "→ Latest release: $LATEST"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

curl -fsSL \
  "https://github.com/${REPO}/releases/download/${LATEST}/bumeet-agent-macos.zip" \
  -o "$TMP/agent.zip"

unzip -q "$TMP/agent.zip" -d "$TMP"
chmod +x "$TMP/$BINARY_NAME"

# ── Install binary ────────────────────────────────────────────────────────────
echo "→ Installing binary to $INSTALL_DIR/$BINARY_NAME"
if [[ -w "$INSTALL_DIR" ]]; then
  cp "$TMP/$BINARY_NAME" "$INSTALL_DIR/$BINARY_NAME"
else
  sudo cp "$TMP/$BINARY_NAME" "$INSTALL_DIR/$BINARY_NAME"
fi

# ── Create log and config directories ────────────────────────────────────────
mkdir -p "$LOG_DIR" "$CONFIG_DIR"

# ── Write initial config if token provided ────────────────────────────────────
if [[ -n "$API_TOKEN" && ! -f "$CONFIG_FILE" ]]; then
  python3 - <<PYEOF
import json, os
path = os.path.expanduser("$CONFIG_FILE")
config = {
  "api": {"url": "https://api.bumeet.es/api/v1", "token": "$API_TOKEN", "poll_interval_seconds": 5},
  "ble": {},
  "runtime": {"auto_connect_on_start": False, "poll_interval_seconds": 2},
  "telemetry": {"enabled": False}
}
with open(path, "w") as f:
    json.dump(config, f, indent=2)
print(f"  Config written to {path}")
PYEOF
fi

# ── Install and load launchd plist ────────────────────────────────────────────
echo "→ Installing launch agent to $PLIST_PATH"
cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${INSTALL_DIR}/${BINARY_NAME}</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${LOG_DIR}/agent.log</string>
  <key>StandardErrorPath</key><string>${LOG_DIR}/agent-error.log</string>
  <key>ThrottleInterval</key><integer>30</integer>
</dict>
</plist>
PLIST

# Unload previous version if running
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load -w "$PLIST_PATH"

echo ""
echo "✓ BUMEET agent installed and started."
echo "  Binary:  $INSTALL_DIR/$BINARY_NAME"
echo "  Logs:    $LOG_DIR/agent.log"
echo "  Config:  $CONFIG_FILE"
if [[ -z "$API_TOKEN" ]]; then
  echo ""
  echo "  Next step: open the BUMEET portal, go to Device settings,"
  echo "  copy your API token, then run:"
  echo "    bumeet-agent --token <your-token>"
fi
