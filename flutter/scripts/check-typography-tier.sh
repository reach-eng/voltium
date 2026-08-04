#!/usr/bin/env bash
# =============================================================================
# PR-126 (DS-TY-1+2) — CI guard: typography tier ratchet
# =============================================================================
#
# Fails the build if the count of `fontSize:` and `GoogleFonts.` uses
# outside `flutter/lib/theme/` grows beyond the recorded baseline.
#
# Why:
#   298 `fontSize:` and 325 `GoogleFonts.` calls scattered across
#   100+ files make it impossible to maintain a consistent design
#   system. The R2.1 alias-removal project only covered the easy
#   20% of the migration. This ratchet prevents NEW uses from being
#   added while the existing offenders are migrated in batches.
#
# The baseline is recorded in
#   flutter/scripts/.typography-tier-baseline
# and updated as part of the migration batches (PR-126, 127, 128
# are the first 3 batches).
#
# Permitted:
#   - `flutter/lib/theme/**` — the canonical tier definitions
#   - `flutter/lib/gen/**` — generated files
#   - `// allow: fontSize` comment on the same line — explicit opt-out
#   - `// allow: GoogleFonts` comment on the same line — explicit opt-out
#
# Usage:
#   $ bash flutter/scripts/check-typography-tier.sh
#   (called by .github/workflows/flutter-ci-cd.yml unit-test job)
#
# Acceptance:
#   - Current count <= baseline count
#   - Exit 1 with the NEW (off-baseline) offenders listed
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# SCRIPT_DIR = flutter/scripts, so parent (flutter) IS the FLUTTER_DIR
FLUTTER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_ROOT="$(cd "$FLUTTER_DIR/.." && pwd)"
BASELINE_FILE="$SCRIPT_DIR/.typography-tier-baseline"

if [ ! -d "$FLUTTER_DIR" ]; then
  echo "X FLUTTER_DIR not found: $FLUTTER_DIR"
  echo "   The script must be at flutter/scripts/check-typography-tier.sh"
  exit 1
fi

cd "$FLUTTER_DIR"

# Find all .dart files in lib/ EXCEPT theme/ and gen/, then grep for
# the offending patterns. Lines with `// allow: fontSize` or
# `// allow: GoogleFonts` are excluded (explicit opt-out).
OFFENDING=$(find lib -name "*.dart" \
  -not -path "lib/theme/*" \
  -not -path "lib/gen/*" \
  -not -name "*.g.dart" \
  2>/dev/null \
  | xargs grep -nE "(fontSize:|GoogleFonts\.)" 2>/dev/null \
  | grep -v "// allow: fontSize" \
  | grep -v "// allow: GoogleFonts" \
  | grep -v "^[ ]*\*" \
  | grep -v "^[ ]*//" \
  || true)

CURRENT_COUNT=0
if [ -n "$OFFENDING" ]; then
  CURRENT_COUNT=$(echo "$OFFENDING" | wc -l | tr -d '[:space:]')
fi

# Bootstrap: if baseline file doesn't exist, create it with the
# current count. This is the "lock in the current state" step.
if [ ! -f "$BASELINE_FILE" ]; then
  printf "%s" "$CURRENT_COUNT" > "$BASELINE_FILE"
  echo "OK Bootstrapped PR-126 baseline: $CURRENT_COUNT current offenders recorded"
  echo "   Re-running will now check against this baseline."
  exit 0
fi

BASELINE_COUNT=$(cat "$BASELINE_FILE" | tr -d '[:space:]' || echo 0)
if [ -z "$BASELINE_COUNT" ]; then BASELINE_COUNT=0; fi

if [ "$CURRENT_COUNT" -le "$BASELINE_COUNT" ] 2>/dev/null; then
  echo "OK PR-126 ratchet: $CURRENT_COUNT / $BASELINE_COUNT offenders (no growth)"
  # Update the baseline if we made progress
  if [ "$CURRENT_COUNT" -lt "$BASELINE_COUNT" ]; then
    printf "%s" "$CURRENT_COUNT" > "$BASELINE_FILE"
    echo "   Baseline updated to $CURRENT_COUNT (was $BASELINE_COUNT)"
  fi
  exit 0
fi

echo "X PR-126 ratchet tripped: $CURRENT_COUNT offenders (was $BASELINE_COUNT)"
echo ""
echo "NEW offenders (delta from baseline):"
echo "$OFFENDING" | head -20
echo ""
TOTAL=$CURRENT_COUNT
echo "Total: $TOTAL offending line(s) across lib/features/ + lib/widgets/ + lib/main.dart"
echo ""
echo "PR-126 ratchet: these bypass the canonical 19-style typography tier"
echo "in app_typography.dart. Use AppTypography.<style> (with .copyWith for"
echo "weight/color) instead. If a non-tier value is intentional, add a"
echo "trailing '// allow: fontSize' or '// allow: GoogleFonts' comment on"
echo "the same line as an explicit opt-out."
exit 1
