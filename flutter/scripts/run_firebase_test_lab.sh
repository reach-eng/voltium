#!/bin/bash
# ==============================================================================
# Voltium Rider — Firebase Test Lab Automation Runner
#
# Runs automated Android testing (Robo crawler or Instrumentation E2E tests)
# on physical devices in Google Cloud Firebase Test Lab.
#
# Prerequisites:
#   1. Google Cloud SDK (gcloud CLI) installed and on PATH.
#   2. GCP Service Account with roles:
#      - roles/testmanager.editor (Cloud Test Service Admin)
#      - roles/storage.admin (Cloud Storage Admin for test result artifacts)
#   3. Environment variable or secret:
#      - FIREBASE_PROJECT_ID (GCP project with Test Lab enabled)
#      - GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON key)
#
# Usage:
#   ./scripts/run_firebase_test_lab.sh [robo|instrumentation] [dev|staging|prod]
#
# Examples:
#   # Run automated Robo crawler on dev build (fastest, detects crashes/ANRs)
#   ./scripts/run_firebase_test_lab.sh robo dev
#
#   # Run integration tests on real cloud devices
#   ./scripts/run_firebase_test_lab.sh instrumentation dev
# ==============================================================================

set -euo pipefail

MODE="${1:-robo}"
FLAVOR="${2:-dev}"
PROJECT_ID="${FIREBASE_PROJECT_ID:-voltium-mobile-prod}"
RESULTS_BUCKET="${FIREBASE_RESULTS_BUCKET:-gs://${PROJECT_ID}-testlab-results}"
DEVICE_MATRIX=(
  "model=Pixel6,version=33,locale=en,orientation=portrait"
  "model=redfin,version=30,locale=en,orientation=portrait"
  "model=oriole,version=32,locale=en,orientation=portrait"
)

echo "=================================================================="
echo " Voltium Firebase Test Lab Runner"
echo " Mode:     $MODE"
echo " Flavor:   $FLAVOR"
echo " Project:  $PROJECT_ID"
echo "=================================================================="

# Check for gcloud CLI
if ! command -v gcloud &> /dev/null; then
  echo "❌ Error: gcloud CLI is not installed or not in PATH."
  echo "   Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

# Authenticate if service account key is provided
if [[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" && -f "${GOOGLE_APPLICATION_CREDENTIALS}" ]]; then
  echo "🔑 Authenticating gcloud with service account key..."
  gcloud auth activate-service-account --key-file="${GOOGLE_APPLICATION_CREDENTIALS}"
fi

gcloud config set project "$PROJECT_ID" --quiet

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLUTTER_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$FLUTTER_ROOT"

if [[ "$MODE" == "robo" ]]; then
  echo "📦 Building Flutter APK for Robo test ($FLAVOR flavor)..."
  flutter build apk --flavor "$FLAVOR" --debug

  APK_PATH="build/app/outputs/flutter-apk/app-${FLAVOR}-debug.apk"
  if [[ ! -f "$APK_PATH" ]]; then
    # Fallback to standard output path
    APK_PATH="build/app/outputs/apk/${FLAVOR}/debug/app-${FLAVOR}-debug.apk"
  fi

  echo "🚀 Submitting Robo test to Firebase Test Lab..."
  DEVICE_ARGS=()
  for dev in "${DEVICE_MATRIX[@]}"; do
    DEVICE_ARGS+=(--device "$dev")
  done

  gcloud firebase test android run \
    --type robo \
    --app "$APK_PATH" \
    "${DEVICE_ARGS[@]}" \
    --timeout 5m \
    --results-bucket "$RESULTS_BUCKET" \
    --no-record-video false \
    --no-performance-metrics false

elif [[ "$MODE" == "instrumentation" ]]; then
  echo "📦 Building Flutter application APK..."
  flutter build apk --flavor "$FLAVOR" --debug

  echo "📦 Building AndroidTest instrumentation APK..."
  pushd android > /dev/null
  ./gradlew "app:assemble${FLAVOR^}DebugAndroidTest"
  popd > /dev/null

  APP_APK="build/app/outputs/apk/${FLAVOR}/debug/app-${FLAVOR}-debug.apk"
  TEST_APK="build/app/outputs/apk/androidTest/${FLAVOR}/debug/app-${FLAVOR}-debug-androidTest.apk"

  echo "🚀 Submitting Instrumentation test to Firebase Test Lab..."
  DEVICE_ARGS=()
  for dev in "${DEVICE_MATRIX[@]}"; do
    DEVICE_ARGS+=(--device "$dev")
  done

  gcloud firebase test android run \
    --type instrumentation \
    --app "$APP_APK" \
    --test "$TEST_APK" \
    "${DEVICE_ARGS[@]}" \
    --timeout 15m \
    --results-bucket "$RESULTS_BUCKET"

else
  echo "❌ Unknown mode: $MODE (must be 'robo' or 'instrumentation')"
  exit 1
fi

echo "✅ Firebase Test Lab run completed successfully!"
