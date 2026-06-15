#!/bin/bash
# run_suites.sh

DEVICE="emulator-5554"
API_URL="http://10.0.2.2:8081"
FAILED=0
PASSED=0

echo "Setting up adb reverse..."
adb reverse tcp:8081 tcp:8081

# Get all test files
TESTS=$(find integration_test -name "*_test.dart")

for TEST in $TESTS; do
  echo "----------------------------------------"
  echo "Running: $TEST"
  echo "----------------------------------------"

  flutter test "$TEST" \
    --dart-define=API_URL="$API_URL" \
    --dart-define=TEST_MODE=true \
    -d "$DEVICE"

  if [ $? -eq 0 ]; then
    echo "✅ PASSED: $TEST"
    ((PASSED++))
  else
    echo "❌ FAILED: $TEST"
    ((FAILED++))
  fi
done

echo "========================================"
echo "Final Summary"
echo "========================================"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "Total:  $(($PASSED + $FAILED))"
echo "========================================"
