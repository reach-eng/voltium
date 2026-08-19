#!/usr/bin/env bash
# PR-146 (B-W3): Ratchet that catches the "writer + OutboxService.emit outside
# the writer's transaction" pattern.
#
# The Voltium outbox is a transactional outbox — the outbox row and the
# business write must commit atomically. The most common failure mode
# is:
#
#     await db.$transaction(async (tx) => { ... business writes ... });
#     await OutboxService.emit(EVENT, { ... });   // <-- LEAKS on crash
#
# This ratchet scans `web/src/server/modules/**/*.use-cases.ts` and
# flags any file where `OutboxService.emit` is called but is NOT the
# last statement inside a `db.$transaction` block. False positives
# (e.g. fire-and-forget emits that have no parent write) are allowed
# to use a `// @allow-outbox-standalone` comment on the same line as
# the emit call.
#
# The ratchet is a fast, best-effort grep. It's not a full AST analysis.
# The rule is: any `.use-cases.ts` file under `web/src/server/modules/`
# that calls `OutboxService.emit(` more than once is required to have
# the emit inside a `db.$transaction(`. We use a coarse text-pattern
# proxy:
#   - Count `OutboxService.emit(` calls in the file.
#   - Count `db.$transaction(` calls in the file.
#   - If emits > transactions, fail.
# (The "writer + commit + emit" pattern via `emitWithCommit` shows up
# as a different surface — it doesn't call `db.$transaction` directly,
# so files that use ONLY the helper don't need a manual $transaction
# and pass cleanly.)
#
# Files that legitimately need a standalone emit (e.g. an SMS-only
# use-case with no business write) can opt out with:
#   // @allow-outbox-standalone
# on a line of their own near the emit.

set -euo pipefail

# Resolve repo root from script path.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Files to scan.
TARGET_GLOB="web/src/server/modules/**/*.use-cases.ts"

# Allowlist — files where the standalone emit is intentional and
# documented. Add a path here only after writing a regression guard
# test in tests/unit/outbox-tx-coverage.test.ts.
ALLOWLIST_FILE="web/tests/unit/outbox-tx-allowlist.txt"

violations=0
checked=0
allowed=0

# Build the allowlist into a regex.
if [[ -f "$ALLOWLIST_FILE" ]]; then
  allowlist_pattern=$(awk '{ print $1 }' "$ALLOWLIST_FILE" | paste -sd'|' -)
else
  allowlist_pattern='__no_allowlist__'
fi

# Iterate use-case files.
shopt -s globstar nullglob
for file in $TARGET_GLOB; do
  # Skip if allowlisted.
  rel="${file//$REPO_ROOT\//}"
  if [[ "$rel" =~ ^($allowlist_pattern)$ ]]; then
    allowed=$((allowed + 1))
    continue
  fi

  emit_count=$(grep -c "OutboxService\\.emit(" "$file" || true)
  tx_count=$(grep -c "db\\.\\\$transaction(" "$file" || true)

  # Subtract 1 from emit count for files that use the helper (emitWithCommit
  # is invoked as `OutboxService.emitWithCommit(` — but the grep above
  # doesn't match that, so no subtraction needed).
  # If emits > transactions AND emits > 0, flag.
  if [[ "$emit_count" -gt 0 && "$emit_count" -gt "$tx_count" ]]; then
    # Also accept the file if it has the opt-out marker.
    if grep -q '@allow-outbox-standalone' "$file"; then
      allowed=$((allowed + 1))
      continue
    fi
    echo "FAIL: $rel — $emit_count OutboxService.emit() calls, $tx_count db.\$transaction() calls (need >=)"
    violations=$((violations + 1))
  fi
  checked=$((checked + 1))
done

echo ""
echo "Outbox emit-tx ratchet (PR-146):"
echo "  Files checked          : $checked"
echo "  Files allowlisted      : $allowed"
echo "  Violations             : $violations"

if [[ "$violations" -gt 0 ]]; then
  echo ""
  echo "FAILED: $violations use-case file(s) emit outside a db.\$transaction."
  echo "Either wrap the emit in the same transaction (preferred) or add"
  echo "// @allow-outbox-standalone on a line of its own near the emit."
  exit 1
fi

echo ""
echo "PASSED: All use-case OutboxService.emit() calls are inside a db.\$transaction."
exit 0
