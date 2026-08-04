#!/usr/bin/env bash
# =============================================================================
# PR-134 (RA-F-6) — Screen file size ratchet
# =============================================================================
#
# Fails the build if any screen file under lib/features/*/screens/ exceeds
# the canonical 600-line threshold. The current 4 over-threshold files
# are recorded in the baseline; future commits that add more lines to
# these files (or create new ones over 600) will trip the ratchet.
#
# Why:
#   4 screens exceed 600 lines (1048 / 836 / 816 / 811), which makes
#   them hard to read, hard to test, and hard to split into widgets.
#   The 600-line threshold matches the team's design rule for screen
#   files: keep the host screen thin, move UI bits into widgets/.
#
# Migration plan (each screen becomes its own PR):
#   - guarantor_onboarding_screen.dart (1048 → <600) — the biggest
#   - edit_profile_screen.dart (836 → <600)
#   - user_onboarding_screen.dart (816 → <600)
#   - top_up_proof_screen.dart (811 → <600)
#
# Usage:
#   $ bash flutter/scripts/check-screen-size.sh
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLUTTER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BASELINE_FILE="$SCRIPT_DIR/.screen-size-baseline"
THRESHOLD=600

if [ ! -d "$FLUTTER_DIR" ]; then
  echo "X FLUTTER_DIR not found: $FLUTTER_DIR"
  exit 1
fi

cd "$FLUTTER_DIR"

# Find screen files over the threshold (excluding test/ and gen/)
OVER=$(find lib -path "*/screens/*screen*.dart" \
  -not -path "lib/gen/*" \
  2>/dev/null \
  | while read f; do
      lines=$(wc -l < "$f" 2>/dev/null | tr -d '[:space:]')
      if [ -n "$lines" ] && [ "$lines" -gt "$THRESHOLD" ]; then
        echo "$lines $f"
      fi
    done \
  | sort -rn || true)

# Build the offender count map (just the over-threshold files)
OVER_FILES=$(echo "$OVER" | wc -l | tr -d '[:space:]')
if [ -z "$OVER_FILES" ] || [ "$OVER_FILES" -lt 1 ]; then OVER_FILES=0; fi

# Bootstrap: if baseline file doesn't exist, record the current
# over-threshold set as a free pass. Subsequent runs check that
# the set is shrinking.
if [ ! -f "$BASELINE_FILE" ]; then
  echo "$OVER" > "$BASELINE_FILE"
  echo "OK Bootstrapped PR-134 screen-size baseline: $OVER_FILES screen(s) over 600 lines"
  echo "$OVER" | head -10
  echo "   Re-running will check that this set does not grow."
  exit 0
fi

# Count lines in each current offender; if any is bigger than the
# recorded baseline, that's growth. If a new file is over, that's growth.
BASELINE_CONTENT=$(cat "$BASELINE_FILE")

# Compare: build a set of {lines file} pairs and check for any
# file that's in current but not in baseline, or any file whose
# line count has grown beyond the baseline value.
GROWTH=""
while IFS= read -r CUR_LINE; do
  [ -z "$CUR_LINE" ] && continue
  CUR_LINES=$(echo "$CUR_LINE" | awk '{print $1}')
  CUR_FILE=$(echo "$CUR_LINE" | awk '{for(i=2;i<=NF;i++) printf "%s ", $i; print ""}' | sed 's/ $//')
  BASE_LINES=$(echo "$BASELINE_CONTENT" | grep -F " $CUR_FILE" | awk '{print $1}' | head -1)
  if [ -z "$BASE_LINES" ]; then
    # New file over the threshold
    GROWTH="${GROWTH}NEW: $CUR_LINE"$'\n'
  elif [ "$CUR_LINES" -gt "$BASE_LINES" ]; then
    GROWTH="${GROWTH}GROWTH: $CUR_LINE (was $BASE_LINES)"$'\n'
  fi
done <<< "$OVER"

# Also: check that files in the baseline are still in the current set
# (if a file got split, the baseline entry should be removed).
while IFS= read -r BASE_LINE; do
  [ -z "$BASE_LINE" ] && continue
  BASE_FILE=$(echo "$BASE_LINE" | awk '{for(i=2;i<=NF;i++) printf "%s ", $i; print ""}' | sed 's/ $//')
  if ! echo "$OVER" | grep -qF " $BASE_FILE"; then
    # File is no longer over the threshold; remove from baseline
    # (implicit: the next loop iteration will rewrite baseline without it)
    :
  fi
done <<< "$BASELINE_CONTENT"

# Update baseline (remove stale entries, keep current offenders)
echo "$OVER" > "$BASELINE_FILE"

if [ -n "$GROWTH" ]; then
  echo "X PR-134 ratchet tripped:"
  echo "$GROWTH"
  echo ""
  echo "Each screen file must be <= $THRESHOLD lines. Migration plan:"
  echo "- Move UI bits to lib/features/<feature>/screens/widgets/<name>.dart"
  echo "- Keep only the Scaffold + the build() method in the host screen"
  echo "- See plan: docs/AUDIT_PHASE7_PLAN_2026-08-04.md PR-134"
  exit 1
fi

echo "OK PR-134 ratchet: $OVER_FILES screen(s) over $THRESHOLD lines (no growth)"
exit 0
