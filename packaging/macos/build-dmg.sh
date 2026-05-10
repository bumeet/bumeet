#!/usr/bin/env bash
# Build bumeet-agent.pkg + bumeet-agent.dmg from a pre-built binary.
# Usage: bash packaging/macos/build-dmg.sh <binary-path> <version>
# Example: bash packaging/macos/build-dmg.sh dist/bumeet-agent-macos v0.1.2
set -euo pipefail

BINARY="${1:?Usage: build-dmg.sh <binary-path> <version>}"
VERSION="${2:?Usage: build-dmg.sh <binary-path> <version>}"
VERSION_CLEAN="${VERSION#v}"  # strip leading 'v'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "→ Building BUMEET Agent installer $VERSION"

# ── 1. Prepare payload root ───────────────────────────────────────────────────
PAYLOAD="$WORK_DIR/payload"
mkdir -p "$PAYLOAD/usr/local/bin"
cp "$BINARY" "$PAYLOAD/usr/local/bin/bumeet-agent"
chmod +x "$PAYLOAD/usr/local/bin/bumeet-agent"

# ── 2. Make scripts executable ────────────────────────────────────────────────
chmod +x "$SCRIPT_DIR/scripts/preinstall" "$SCRIPT_DIR/scripts/postinstall"

# ── 3. Build component pkg ───────────────────────────────────────────────────
COMPONENT_PKG="$WORK_DIR/bumeet-agent-component.pkg"
pkgbuild \
    --root "$PAYLOAD" \
    --identifier "es.bumeet.agent" \
    --version "$VERSION_CLEAN" \
    --scripts "$SCRIPT_DIR/scripts" \
    --install-location "/" \
    "$COMPONENT_PKG"

# ── 4. Inject version into distribution.xml ──────────────────────────────────
DIST_XML="$WORK_DIR/distribution.xml"
sed "s/VERSION_PLACEHOLDER/$VERSION_CLEAN/" "$SCRIPT_DIR/distribution.xml" > "$DIST_XML"

# ── 5. Build product pkg ─────────────────────────────────────────────────────
PRODUCT_PKG="$WORK_DIR/bumeet-agent.pkg"
productbuild \
    --distribution "$DIST_XML" \
    --resources "$SCRIPT_DIR/assets" \
    --package-path "$WORK_DIR" \
    "$PRODUCT_PKG"

# ── 6. Create DMG ────────────────────────────────────────────────────────────
DMG_STAGING="$WORK_DIR/dmg-staging"
mkdir -p "$DMG_STAGING"
cp "$PRODUCT_PKG" "$DMG_STAGING/Install BUMEET Agent.pkg"

hdiutil create \
    -volname "BUMEET Agent $VERSION_CLEAN" \
    -srcfolder "$DMG_STAGING" \
    -ov \
    -format UDZO \
    "bumeet-agent.dmg"

echo "✓ bumeet-agent.dmg created"
