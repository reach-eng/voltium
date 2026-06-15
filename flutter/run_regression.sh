#!/bin/bash
set -e

DEVICE_ID="emulator-5554"
API_URL="http://localhost:8081"

run_test() {
  local test_file=$1
  echo "Running $test_file..."
  flutter drive \
    --driver=test_driver/integration_test.dart \
    --target=integration_test/e2e_individual/$test_file \
    -d $DEVICE_ID \
    --dart-define=API_URL=$API_URL \
    --dart-define=TEST_MODE=true
}

run_test "36_offline_edge_cases_test.dart"
run_test "37_wallet_topup_balance_test.dart"
run_test "38_kyc_notification_flow_test.dart"
run_test "40_exhaustive_ui_traversal_test.dart"

echo "Regression suite complete!"
