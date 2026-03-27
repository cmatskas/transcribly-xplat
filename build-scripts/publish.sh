#!/bin/bash
# publish.sh — Build and publish Transcribely to S3 for auto-updates
# 
# Prerequisites:
#   - AWS credentials with s3:PutObject on the bucket
#   - For macOS signing: set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
#
# Usage:
#   ./build-scripts/publish.sh [mac|win|all]

set -e

PLATFORM=${1:-all}
BUCKET="transcribely-releases"
REGION="us-east-1"

echo "Building and publishing Transcribely to s3://$BUCKET/releases/"

if [ "$PLATFORM" = "mac" ] || [ "$PLATFORM" = "all" ]; then
  echo "Building macOS..."
  npx electron-builder --mac --publish always
fi

if [ "$PLATFORM" = "win" ] || [ "$PLATFORM" = "all" ]; then
  echo "Building Windows x64..."
  npx electron-builder --win --x64 --publish always
  echo "Building Windows arm64..."
  npx electron-builder --win --arm64 --publish always
fi

echo "Done. Artifacts published to s3://$BUCKET/releases/"
echo "Users will receive the update notification within 4 hours."
