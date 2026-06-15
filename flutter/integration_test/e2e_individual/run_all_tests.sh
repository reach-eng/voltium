#!/bin/bash
# integration_test/e2e_individual/run_all_tests.sh
#
# Convenience script to run all individual E2E tests sequentially.
# Usage: ./run_all_tests.sh [device_id]
#
# Prerequisites:
#   - Emulator running (default: emulator-5554)
#   - Backend running at http://localhost:8081
#   - /Users/amreenfarooq/Library/Android/sdk/platform-tools/adb reverse tcp:8081 tcp:8081

DEVICE="${1:-emulator-5554}"
DRIVER="test_driver/integration_test.dart"
API_URL="http://localhost:8081"
FAILED=0
PASSED=0

# Ensure adb reverse is set up
echo "Setting up adb reverse for backend..."
/Users/amreenfarooq/Library/Android/sdk/platform-tools/adb reverse tcp:8081 tcp:8081

echo ""
echo "========================================"
echo "Running Voltium Individual E2E Tests"
echo "Device: $DEVICE"
echo "API: $API_URL"
echo "========================================"
echo ""

# Array of all test targets
TESTS=(
  "integration_test/e2e_individual/01_splash_screen_test.dart"
  "integration_test/e2e_individual/02_legal_screen_test.dart"
  "integration_test/e2e_individual/03_permissions_screen_test.dart"
  "integration_test/e2e_individual/04_login_screen_test.dart"
  "integration_test/e2e_individual/05_otp_verification_test.dart"
  "integration_test/e2e_individual/06_full_auth_login_test.dart"
  "integration_test/e2e_individual/07_dashboard_elements_test.dart"
  "integration_test/e2e_individual/08_dashboard_navigation_test.dart"
  "integration_test/e2e_individual/09_notifications_test.dart"
  "integration_test/e2e_individual/10_referral_widget_test.dart"
  "integration_test/e2e_individual/11_wallet_balance_test.dart"
  "integration_test/e2e_individual/12_wallet_topup_test.dart"
  "integration_test/e2e_individual/13_wallet_filters_test.dart"
  "integration_test/e2e_individual/14_profile_display_test.dart"
  "integration_test/e2e_individual/15_profile_edit_test.dart"
  "integration_test/e2e_individual/16_profile_kyc_status_test.dart"
  "integration_test/e2e_individual/17_otp_resend_test.dart"
  "integration_test/e2e_individual/18_otp_back_button_test.dart"
  "integration_test/e2e_individual/19_logout_test.dart"
  "integration_test/e2e_individual/20_support_screen_test.dart"
  "integration_test/e2e_individual/21_support_faq_test.dart"
  "integration_test/e2e_individual/22_support_chat_test.dart"
  "integration_test/e2e_individual/23_support_ticket_test.dart"
  "integration_test/e2e_individual/24_settings_screen_test.dart"
  "integration_test/e2e_individual/25_settings_theme_toggle_test.dart"
  "integration_test/e2e_individual/26_settings_biometric_toggle_test.dart"
  "integration_test/e2e_individual/27_missing_vehicle_state_test.dart"
  "integration_test/e2e_individual/28_offline_indicator_test.dart"
  "integration_test/e2e_individual/29_empty_referral_test.dart"
  "integration_test/e2e_individual/30_full_journey_test.dart"
  "integration_test/e2e_individual/31_error_recovery_test.dart"
  "integration_test/e2e_individual/32_rental_end_test.dart"
  "integration_test/e2e_individual/33_onboarding_referral_logout_test.dart"
)

for TEST in "${TESTS[@]}"; do
  TEST_NAME=$(basename "$TEST" .dart)
  echo "----------------------------------------"
  echo "Running: $TEST_NAME"
  echo "----------------------------------------"

  flutter drive \
    --driver="$DRIVER" \
    --target="$TEST" \
    -d "$DEVICE" \
    --dart-define=API_URL="$API_URL"

  if [ $? -eq 0 ]; then
    echo "✅ PASSED: $TEST_NAME"
    ((PASSED++))
  else
    echo "❌ FAILED: $TEST_NAME"
    ((FAILED++))
  fi
  echo ""
done

echo "========================================"
echo "Test Run Complete"
echo "========================================"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "Total:  $(($PASSED + $FAILED))"
echo "========================================"

if [ $FAILED -gt 0 ]; then
  exit 1
fi
