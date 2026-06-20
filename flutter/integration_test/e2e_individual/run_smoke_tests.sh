#!/bin/bash
# flutter/integration_test/e2e_individual/run_smoke_tests.sh
#
# Runs a subset of critical E2E tests for daily smoke validation.

DEVICE="${1:-emulator-5554}"
DRIVER="test_driver/integration_test.dart"
API_URL="http://localhost:8081"
TEST_DIR="integration_test/e2e_individual"

SMOKE_TESTS=(
  "$TEST_DIR/06_full_auth_login_test.dart"
  "$TEST_DIR/30_full_journey_test.dart"
  "$TEST_DIR/37_wallet_topup_balance_test.dart"
  "$TEST_DIR/33_onboarding_referral_logout_test.dart"
  "$TEST_DIR/39_vehicle_return_workflow_test.dart"
)

PASSED=0
FAILED=0
TOTAL=0

echo "========================================"
echo "Voltium Daily Smoke Test Suite"
echo "Device: $DEVICE"
echo "API: $API_URL"
echo "========================================"
echo ""

adb reverse tcp:8081 tcp:8081

for test_file in "${SMOKE_TESTS[@]}"; do
  if [ -f "$test_file" ]; then
    ((TOTAL++))
    test_name=$(basename "$test_file" .dart)
    echo "  Running: $test_name"
    
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
  fi
done

echo "========================================"
echo "Smoke Run Complete"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "Total:  $TOTAL"
echo "========================================"

if [ $FAILED -gt 0 ]; then
  exit 1
fi
