#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLUTTER_DIR="$ROOT_DIR/flutter"
MIN_COVERAGE=${MIN_COVERAGE:-85.0}

echo "📱 Running Flutter Unit & Widget Test Coverage..."
cd "$FLUTTER_DIR"

flutter test --coverage

LCOV_FILE="$FLUTTER_DIR/coverage/lcov.info"

if [ ! -f "$LCOV_FILE" ]; then
  echo "❌ Error: $LCOV_FILE not found!"
  exit 1
fi

echo "📊 Calculating Flutter line coverage..."

# Parse lcov.info LF (lines found) and LH (lines hit)
TOTAL_LF=$(grep -E '^LF:' "$LCOV_FILE" | awk -F: '{sum += $2} END {print sum}')
TOTAL_LH=$(grep -E '^LH:' "$LCOV_FILE" | awk -F: '{sum += $2} END {print sum}')

if [ "$TOTAL_LF" -eq 0 ]; then
  echo "⚠️ Warning: No instrumented lines found."
  COVERAGE_PCT=0
else
  COVERAGE_PCT=$(awk "BEGIN {printf \"%.2f\", ($TOTAL_LH/$TOTAL_LF)*100}")
fi

echo ""
echo "=========================================="
echo " Flutter Coverage Summary"
echo "=========================================="
echo " Lines Found : $TOTAL_LF"
echo " Lines Hit   : $TOTAL_LH"
echo " Coverage    : ${COVERAGE_PCT}%"
echo " Target Gate : ${MIN_COVERAGE}%"
echo "=========================================="

IS_PASS=$(awk "BEGIN {print ($COVERAGE_PCT >= $MIN_COVERAGE) ? 1 : 0}")

if [ "$IS_PASS" -eq 1 ]; then
  echo "✅ FLUTTER COVERAGE PASSED (${COVERAGE_PCT}% >= ${MIN_COVERAGE}%)"
  exit 0
else
  echo "❌ FLUTTER COVERAGE FAILED (${COVERAGE_PCT}% < ${MIN_COVERAGE}%)"
  exit 1
fi
