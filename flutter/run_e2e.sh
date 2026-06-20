#!/bin/bash

# run_e2e.sh
# Script to run Voltium Comprehensive E2E tests on a connected Android device/emulator.

# Default values
API_URL=${API_URL:-"http://10.0.2.2:8081"}
DEVICE_ID=""

# Function to display help
show_help() {
  echo "Usage: ./run_e2e.sh [options]"
  echo ""
  echo "Options:"
  echo "  -d, --device ID    Specify the device/emulator ID (run 'flutter devices' to see IDs)"
  echo "  -u, --url URL      Specify the API URL (default: http://10.0.2.2:8081)"
  echo "  -h, --help         Show this help message"
}

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    -d|--device) DEVICE_ID="$2"; shift ;;
    -u|--url) API_URL="$2"; shift ;;
    -h|--help) show_help; exit 0 ;;
    *) echo "Unknown parameter: $1"; show_help; exit 1 ;;
  esac
  shift
done

echo "🚀 Starting Voltium Comprehensive E2E Tests..."
echo "📍 API URL: $API_URL"

if [ -n "$DEVICE_ID" ]; then
  echo "📱 Target Device: $DEVICE_ID"
  
  echo "📦 Building and Installing App..."
  flutter build apk --debug
  adb -s $DEVICE_ID install -r build/app/outputs/flutter-apk/app-debug.apk

  # Grant Permissions via ADB to avoid hanging on system dialogs
  echo "🔐 Granting Android permissions..."
  PKG="com.voltiumelectric.voltium"
  adb -s $DEVICE_ID shell pm grant $PKG android.permission.ACCESS_FINE_LOCATION
  adb -s $DEVICE_ID shell pm grant $PKG android.permission.ACCESS_COARSE_LOCATION
  adb -s $DEVICE_ID shell pm grant $PKG android.permission.READ_CONTACTS
  adb -s $DEVICE_ID shell pm grant $PKG android.permission.CAMERA
  adb -s $DEVICE_ID shell pm grant $PKG android.permission.RECORD_AUDIO
  adb -s $DEVICE_ID shell pm grant $PKG android.permission.READ_PHONE_STATE
  
  # Battery optimization whitelist (prevents system dialog)
  adb -s $DEVICE_ID shell dumpsys deviceidle whitelist +$PKG

  echo "🏃 Running E2E Test..."
  flutter test integration_test/comprehensive_e2e_test.dart \
    --dart-define=API_URL=$API_URL \
    -d $DEVICE_ID
else
  echo "📱 No device specified, using default..."
  flutter test integration_test/comprehensive_e2e_test.dart \
    --dart-define=API_URL=$API_URL
fi

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Tests passed!"
else
  echo "❌ Tests failed with exit code $EXIT_CODE"
fi

exit $EXIT_CODE
