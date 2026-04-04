#!/bin/bash
# publish.sh — Build, sign, and publish Transcribely to S3 for auto-updates
#
# Prerequisites:
#   - AWS credentials in ~/.aws/credentials (default profile)
#   - For macOS signing: Apple Developer ID cert in Keychain
#   - Apple env vars in build-scripts/.apple-env (see below)
#
# Apple env file (build-scripts/.apple-env):
#   APPLE_ID=your@email.com
#   APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
#   APPLE_TEAM_ID=XXXXXXXXXX
#
# Usage:
#   ./build-scripts/publish.sh [mac|win|all]

set -e

PLATFORM=${1:-all}
BUCKET="transcribely-releases"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Load AWS credentials from ~/.aws/credentials ──────────
AWS_CREDS="$HOME/.aws/credentials"
if [ -f "$AWS_CREDS" ]; then
  export AWS_ACCESS_KEY_ID=$(grep -A5 '^\[default\]' "$AWS_CREDS" | grep 'AWS_ACCESS_KEY_ID' | head -1 | cut -d= -f2- | tr -d ' ')
  export AWS_SECRET_ACCESS_KEY=$(grep -A5 '^\[default\]' "$AWS_CREDS" | grep 'AWS_SECRET_ACCESS_KEY' | head -1 | cut -d= -f2- | tr -d ' ')
  SESSION_TOKEN=$(grep -A5 '^\[default\]' "$AWS_CREDS" | grep 'AWS_SESSION_TOKEN' | head -1 | cut -d= -f2- | tr -d ' ')
  [ -n "$SESSION_TOKEN" ] && export AWS_SESSION_TOKEN="$SESSION_TOKEN"
  echo "✓ AWS credentials loaded from ~/.aws/credentials"
else
  echo "✗ No ~/.aws/credentials found — S3 publish will fail"
  exit 1
fi

# ── Load Apple signing env vars ───────────────────────────
APPLE_ENV="$SCRIPT_DIR/.apple-env"
if [ -f "$APPLE_ENV" ]; then
  set -a
  source "$APPLE_ENV"
  set +a
  echo "✓ Apple signing config loaded from $APPLE_ENV"
else
  if [ "$PLATFORM" = "mac" ] || [ "$PLATFORM" = "all" ]; then
    echo "⚠ No build-scripts/.apple-env found — macOS build will be ad-hoc signed (not notarized)"
  fi
fi

echo ""
echo "Publishing Transcribely to s3://$BUCKET/releases/"
echo ""

if [ "$PLATFORM" = "mac" ] || [ "$PLATFORM" = "all" ]; then
  echo "▸ Building macOS (universal)..."
  npx electron-builder --mac --universal --publish never

  DMG=$(ls dist/temp/*.dmg 2>/dev/null | head -1)
  if [ -z "$DMG" ]; then
    echo "✗ No DMG found in dist/temp/"
    exit 1
  fi

  if [ -n "$APPLE_ID" ] && [ -n "$APPLE_APP_SPECIFIC_PASSWORD" ] && [ -n "$APPLE_TEAM_ID" ]; then
    echo "▸ Notarizing $DMG..."
    SUBMISSION=$(xcrun notarytool submit "$DMG" \
      --apple-id "$APPLE_ID" \
      --password "$APPLE_APP_SPECIFIC_PASSWORD" \
      --team-id "$APPLE_TEAM_ID" \
      --wait 2>&1)
    echo "$SUBMISSION"

    if echo "$SUBMISSION" | grep -q "status: Accepted"; then
      echo "▸ Stapling notarization ticket..."
      xcrun stapler staple "$DMG"
    else
      echo "✗ Notarization failed — check output above"
      exit 1
    fi
  else
    echo "⚠ Apple env vars not set — skipping notarization"
  fi

  echo "▸ Uploading macOS DMG to S3..."
  aws s3 cp "$DMG" "s3://$BUCKET/releases/$(basename $DMG)"
  # Upload latest-mac.yml for auto-updater
  YML=$(ls dist/temp/latest-mac.yml 2>/dev/null)
  [ -n "$YML" ] && aws s3 cp "$YML" "s3://$BUCKET/releases/latest-mac.yml"
  echo ""
fi

if [ "$PLATFORM" = "win" ] || [ "$PLATFORM" = "all" ]; then
  echo "▸ Building Windows x64..."
  npx electron-builder --win --x64 --publish always
  echo ""
  echo "▸ Building Windows arm64..."
  npx electron-builder --win --arm64 --publish always
  echo ""
fi

echo "✓ Done. Artifacts published to s3://$BUCKET/releases/"
echo "  Users will receive the update notification within 4 hours."
