#!/bin/bash
# wait-notarize.sh — Poll Apple for notarization result, then staple and upload to S3
# Usage: ./build-scripts/wait-notarize.sh <submission-id>

set -e

SUBMISSION_ID=${1:?Usage: $0 <submission-id>}
BUCKET="transcribely-releases"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

source "$SCRIPT_DIR/.apple-env"

# Load AWS credentials
AWS_CREDS="$HOME/.aws/credentials"
export AWS_ACCESS_KEY_ID=$(grep -A5 '^\[default\]' "$AWS_CREDS" | grep 'AWS_ACCESS_KEY_ID' | head -1 | cut -d= -f2- | tr -d ' ')
export AWS_SECRET_ACCESS_KEY=$(grep -A5 '^\[default\]' "$AWS_CREDS" | grep 'AWS_SECRET_ACCESS_KEY' | head -1 | cut -d= -f2- | tr -d ' ')
SESSION_TOKEN=$(grep -A5 '^\[default\]' "$AWS_CREDS" | grep 'AWS_SESSION_TOKEN' | head -1 | cut -d= -f2- | tr -d ' ')
[ -n "$SESSION_TOKEN" ] && export AWS_SESSION_TOKEN="$SESSION_TOKEN"

echo "Waiting for notarization: $SUBMISSION_ID"
echo "Polling every 60 seconds..."
echo ""

while true; do
  STATUS=$(xcrun notarytool info "$SUBMISSION_ID" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" 2>&1 | grep 'status:' | awk '{print $2}')

  echo "$(date '+%H:%M:%S') — $STATUS"

  if [ "$STATUS" = "Accepted" ]; then
    echo ""
    echo "✓ Notarization accepted!"

    DMG=$(ls dist/temp/*.dmg 2>/dev/null | head -1)
    if [ -z "$DMG" ]; then
      echo "✗ No DMG found in dist/temp/ — staple and upload manually"
      exit 1
    fi

    echo "▸ Stapling ticket to $DMG..."
    xcrun stapler staple "$DMG"

    echo "▸ Uploading to S3..."
    aws s3 cp "$DMG" "s3://$BUCKET/releases/$(basename $DMG)"
    YML=$(ls dist/temp/latest-mac.yml 2>/dev/null)
    [ -n "$YML" ] && aws s3 cp "$YML" "s3://$BUCKET/releases/latest-mac.yml"

    echo ""
    echo "✓ Done. $(basename $DMG) published to s3://$BUCKET/releases/"
    exit 0

  elif [ "$STATUS" = "Invalid" ]; then
    echo ""
    echo "✗ Notarization rejected. Fetching log..."
    xcrun notarytool log "$SUBMISSION_ID" \
      --apple-id "$APPLE_ID" \
      --password "$APPLE_APP_SPECIFIC_PASSWORD" \
      --team-id "$APPLE_TEAM_ID"
    exit 1
  fi

  sleep 60
done
