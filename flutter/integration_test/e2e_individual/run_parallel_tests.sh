#!/bin/bash
# integration_test/e2e_individual/run_parallel_tests.sh
#
# Runs E2E tests in parallel across multiple shards.
# Usage: ./run_parallel_tests.sh [num_shards] [device_id]
#
# Prerequisites:
#   - Emulator running (default: emulator-5554)
#   - Backend running at http://localhost:8081
#   - adb reverse tcp:8081 tcp:8081

NUM_SHARDS="${1:-4}"
DEVICE="${2:-emulator-5554}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PHASED_SCRIPT="$SCRIPT_DIR/run_phased_tests.sh"
RESULTS_DIR=$(mktemp -d)

TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_SKIPPED=0
TOTAL_TESTS=0

echo "========================================"
echo "Voltium E2E Parallel Test Runner"
echo "Shards: $NUM_SHARDS"
echo "Device: $DEVICE"
echo "========================================"
echo ""

adb reverse tcp:8081 tcp:8081

declare -a PIDS

for ((i = 0; i < NUM_SHARDS; i++)); do
  echo "Starting shard $((i + 1))/$NUM_SHARDS..."
  (
    "$PHASED_SCRIPT" "$DEVICE" --shard-index="$i" --shard-count="$NUM_SHARDS" 2>&1 | tee "$RESULTS_DIR/shard_$i.log"
    echo "${PIPESTATUS[0]}" > "$RESULTS_DIR/shard_${i}_exit"
  ) &
  PIDS+=($!)
done

echo ""
echo "Waiting for all shards to complete..."
echo ""

declare -a EXIT_CODES

for ((i = 0; i < NUM_SHARDS; i++)); do
  wait ${PIDS[$i]}
  EXIT_CODES[$i]=$(cat "$RESULTS_DIR/shard_${i}_exit" 2>/dev/null || echo "1")
done

echo "========================================"
echo "Per-Shard Results"
echo "========================================"

for ((i = 0; i < NUM_SHARDS; i++)); do
  log_file="$RESULTS_DIR/shard_$i.log"
  if [ -f "$log_file" ]; then
    shard_passed=$(grep -oP 'Passed:\s+\K\d+' "$log_file" 2>/dev/null || echo "0")
    shard_failed=$(grep -oP 'Failed:\s+\K\d+' "$log_file" 2>/dev/null || echo "0")
    shard_skipped=$(grep -oP 'Skipped:\s+\K\d+' "$log_file" 2>/dev/null || echo "0")
    shard_total=$(grep -oP 'Total:\s+\K\d+' "$log_file" 2>/dev/null || echo "0")

    printf "  Shard %d/%d: " $((i + 1)) "$NUM_SHARDS"
    if [ "${EXIT_CODES[$i]}" = "0" ]; then
      printf "✅ PASSED"
    else
      printf "❌ FAILED"
    fi
    printf " (passed: %d, failed: %d, skipped: %d, total: %d)\n" \
      "$shard_passed" "$shard_failed" "$shard_skipped" "$shard_total"

    TOTAL_PASSED=$((TOTAL_PASSED + shard_passed))
    TOTAL_FAILED=$((TOTAL_FAILED + shard_failed))
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + shard_skipped))
    TOTAL_TESTS=$((TOTAL_TESTS + shard_total))
  else
    printf "  Shard %d/%d: ❌ NO LOG FOUND\n" $((i + 1)) "$NUM_SHARDS"
  fi
done

echo ""
echo "========================================"
echo "Aggregated Results"
echo "========================================"
echo "Passed:  $TOTAL_PASSED"
echo "Failed:  $TOTAL_FAILED"
echo "Skipped: $TOTAL_SKIPPED"
echo "Total:   $TOTAL_TESTS"
echo "========================================"

if [ $TOTAL_FAILED -gt 0 ]; then
  echo ""
  echo "Failed shard logs:"
  for ((i = 0; i < NUM_SHARDS; i++)); do
    if [ "${EXIT_CODES[$i]}" != "0" ] && [ -f "$RESULTS_DIR/shard_$i.log" ]; then
      echo ""
      echo "--- Shard $((i + 1)) failures ---"
      grep -A2 "FAILED" "$RESULTS_DIR/shard_$i.log" 2>/dev/null || true
    fi
  done
  rm -rf "$RESULTS_DIR"
  exit 1
fi

rm -rf "$RESULTS_DIR"
exit 0
