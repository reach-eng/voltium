#!/bin/bash
# integration_test/e2e_individual/run_phased_tests.sh
#
# Runs all E2E tests in 17 phases for parallel-friendly execution.
# Usage: ./run_phased_tests.sh [device_id] [--shard-index N] [--shard-count M]
#
# Prerequisites:
#   - Emulator running (default: emulator-5554)
#   - Backend running at http://localhost:8081
#   - adb on PATH (or ANDROID_HOME set). The script auto-detects common
#     SDK install locations on macOS, Linux, and Windows.

DEVICE="${1:-emulator-5554}"
DRIVER="test_driver/integration_test.dart"
API_URL="http://localhost:8081"
TEST_DIR="integration_test/e2e_individual"

# Locate the adb binary cross-platform. On macOS dev boxes the path is
# hard-coded under /Users/...; elsewhere we fall back to the local
# Android SDK install or whatever `adb` resolves to on the PATH (CI,
# Linux, Windows Git-Bash).
if [ -x "/Users/amreenfarooq/Library/Android/sdk/platform-tools/adb" ]; then
  ADB="/Users/amreenfarooq/Library/Android/sdk/platform-tools/adb"
elif command -v adb >/dev/null 2>&1; then
  ADB="$(command -v adb)"
elif [ -x "$HOME/Library/Android/sdk/platform-tools/adb" ]; then
  ADB="$HOME/Library/Android/sdk/platform-tools/adb"
elif [ -x "/opt/android-sdk/platform-tools/adb" ]; then
  ADB="/opt/android-sdk/platform-tools/adb"
elif [ -x "$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" ]; then
  ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
else
  echo "adb not found. Set ANDROID_HOME or add platform-tools to PATH."
  exit 1
fi

SHARD_INDEX=0
SHARD_COUNT=1

for arg in "$@"; do
  case $arg in
    --shard-index=*)
      SHARD_INDEX="${arg#*=}"
      ;;
    --shard-count=*)
      SHARD_COUNT="${arg#*=}"
      ;;
  esac
done

PASSED=0
FAILED=0
TOTAL=0
SKIPPED=0
TEST_NUM=0

ALL_TESTS=(
  "$TEST_DIR/00_diagnostic_test.dart"
  "$TEST_DIR/01_splash_screen_test.dart"
  "$TEST_DIR/02_legal_screen_test.dart"
  "$TEST_DIR/03_permissions_screen_test.dart"
  "$TEST_DIR/04_login_screen_test.dart"
  "$TEST_DIR/05_otp_verification_test.dart"
  "$TEST_DIR/06_full_auth_login_test.dart"
  "$TEST_DIR/07_dashboard_elements_test.dart"
  "$TEST_DIR/08_dashboard_navigation_test.dart"
  "$TEST_DIR/09_notifications_test.dart"
  "$TEST_DIR/10_referral_widget_test.dart"
  "$TEST_DIR/11_wallet_balance_test.dart"
  "$TEST_DIR/12_wallet_topup_test.dart"
  "$TEST_DIR/13_wallet_filters_test.dart"
  "$TEST_DIR/14_profile_display_test.dart"
  "$TEST_DIR/15_profile_edit_test.dart"
  "$TEST_DIR/16_profile_kyc_status_test.dart"
  "$TEST_DIR/17_otp_resend_test.dart"
  "$TEST_DIR/18_otp_back_button_test.dart"
  "$TEST_DIR/19_logout_test.dart"
  "$TEST_DIR/20_support_screen_test.dart"
  "$TEST_DIR/21_support_faq_test.dart"
  "$TEST_DIR/22_support_chat_test.dart"
  "$TEST_DIR/23_support_ticket_test.dart"
  "$TEST_DIR/24_settings_screen_test.dart"
  "$TEST_DIR/25_settings_theme_toggle_test.dart"
  "$TEST_DIR/26_settings_biometric_toggle_test.dart"
  "$TEST_DIR/27_missing_vehicle_state_test.dart"
  "$TEST_DIR/28_offline_indicator_test.dart"
  "$TEST_DIR/29_empty_referral_test.dart"
  "$TEST_DIR/30_full_journey_test.dart"
  "$TEST_DIR/31_error_recovery_test.dart"
  "$TEST_DIR/32_rental_end_test.dart"
  "$TEST_DIR/33_onboarding_referral_logout_test.dart"
  "$TEST_DIR/34_guarantor_flow_test.dart"
  "$TEST_DIR/35_kyc_notification_test.dart"
  "$TEST_DIR/36_offline_edge_cases_test.dart"
  "$TEST_DIR/37_wallet_topup_balance_test.dart"
  "$TEST_DIR/38_kyc_notification_flow_test.dart"
  "$TEST_DIR/39_vehicle_return_workflow_test.dart"
  "$TEST_DIR/40_exhaustive_ui_traversal_test.dart"
  "$TEST_DIR/41_realtime_onboarding_to_active_dashboard_test.dart"
  "$TEST_DIR/42_adversarial_error_paths_test.dart"
  "$TEST_DIR/43_debug_login_test.dart"
  "$TEST_DIR/44_full_onboarding_to_dashboard_test.dart"
  "$TEST_DIR/45_guarantor_form_test.dart"
  "$TEST_DIR/46_pickup_screen_test.dart"
  "$TEST_DIR/47_admin_approval_wait_test.dart"
  "$TEST_DIR/48_emergency_sos_test.dart"
)

run_test() {
  local test_file="$1"
  local test_name=$(basename "$test_file" .dart)
  ((TEST_NUM++))

  local shard_target=$(( TEST_NUM % SHARD_COUNT ))
  if [ "$SHARD_COUNT" -gt 1 ] && [ "$shard_target" -ne "$SHARD_INDEX" ]; then
    ((SKIPPED++))
    return
  fi

  ((TOTAL++))

  echo "  Running: $test_name"
  local output
  output=$(flutter drive \
    --driver="$DRIVER" \
    --target="$test_file" \
    -d "$DEVICE" \
    --dart-define=API_URL="$API_URL" \
    --dart-define=TEST_MODE=true 2>&1)

  if echo "$output" | grep -q "All tests passed"; then
    echo "  ✅ PASSED"
    ((PASSED++))
  else
    echo "  ❌ FAILED"
    ((FAILED++))
    echo "$output" | grep -E "Widget not found|Expected:" | head -1 | sed 's/^/    /'
  fi
  echo ""
}

echo "========================================"
echo "Voltium E2E Test Suite"
echo "Device: $DEVICE"
echo "API: $API_URL"
if [ "$SHARD_COUNT" -gt 1 ]; then
  echo "Shard: $((SHARD_INDEX + 1))/$SHARD_COUNT"
fi
echo "========================================"
echo ""

# Ensure the device can reach this host's dev server (cross-platform via $ADB).
"$ADB" reverse tcp:8081 tcp:8081

for test_file in "${ALL_TESTS[@]}"; do
  if [ -f "$test_file" ]; then
    run_test "$test_file"
  fi
done

echo "========================================"
echo "Test Run Complete"
echo "========================================"
echo "Passed:  $PASSED"
echo "Failed:  $FAILED"
echo "Skipped: $SKIPPED"
echo "Total:   $TOTAL"
echo "========================================"

if [ $FAILED -gt 0 ]; then
  exit 1
fi
