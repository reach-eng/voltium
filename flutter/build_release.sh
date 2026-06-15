#!/usr/bin/env bash
# flutter/build_release.sh
# Builds an unsigned release APK with obfuscation.
# Usage: bash flutter/build_release.sh [API_URL]
# Example: bash flutter/build_release.sh https://api.voltium.com
set -euo pipefail

API_URL="${1:-https://api.voltium.com}"

echo "==> Cleaning previous build..."
flutter clean

echo "==> Getting dependencies..."
flutter pub get

echo "==> Building release APK (unsigned, obfuscated)..."
echo "    API_URL = $API_URL"
flutter build apk \
  --release \
  --obfuscate \
  --split-debug-info=build/debug-info \
  --dart-define=API_URL="$API_URL"

echo ""
echo "✅ Build complete."
echo "   APK: build/app/outputs/flutter-apk/app-release.apk"
echo "   Debug symbols: build/debug-info/"
echo ""
echo "To install on a connected device:"
echo "   flutter install --release"
