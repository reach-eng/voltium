#!/usr/bin/env bash
# =============================================================================
# PR-128 (DS-DM-1) — Colors.white/black ratchet
# =============================================================================
#
# Fails the build if the count of `Colors.white` and `Colors.black`
# uses outside `flutter/lib/theme/` grows beyond the recorded
# baseline.
#
# Why:
#   588 Colors.white / Colors.black uses across 123 files bypass
#   the brightness-aware ThemeColors tokens. Dark-mode contrast
#   breaks every time someone uses a raw Colors.white in a card
#   that should pick up the brightness ladder.
#
# Permitted:
#   - `flutter/lib/theme/**` — the canonical ThemeColors definitions
#   - `flutter/lib/gen/**` — generated files
#   - `// allow: Colors` comment on the same line — explicit opt-out
#
# Usage:
#   $ bash flutter/scripts/check-colors-ratchet.sh
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLUTTER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BASELINE_FILE="$SCRIPT_DIR/.colors-ratchet-baseline"

if [ ! -d "$FLUTTER_DIR" ]; then
  echo "X FLUTTER_DIR not found: $FLUTTER_DIR"
  exit 1
fi

cd "$FLUTTER_DIR"

# Find all .dart files in lib/ EXCEPT theme/ and gen/, then grep for
# Colors.white or Colors.black uses.
OFFENDING=$(find lib -name "*.dart" \
  -not -path "lib/theme/*" \
  -not -path "lib/gen/*" \
  -not -name "*.g.dart" \
  2>/dev/null \
  | xargs grep -nE "Colors\.(white|black)" 2>/dev/null \
  | grep -v "// allow: Colors" \
  | grep -v "^[ ]*\*" \
  | grep -v "^[ ]*//" \
  || true)

CURRENT_COUNT=0
if [ -n "$OFFENDING" ]; then
  CURRENT_COUNT=$(echo "$OFFENDING" | wc -l | tr -d '[:space:]')
fi

if [ ! -f "$BASELINE_FILE" ]; then
  printf "%s" "$CURRENT_COUNT" > "$BASELINE_FILE"
  echo "OK Bootstrapped PR-128 baseline: $CURRENT_COUNT current offenders recorded"
  echo "   Re-running will now check against this baseline."
  exit 0
fi

BASELINE_COUNT=$(cat "$BASELINE_FILE" | tr -d '[:space:]' || echo 0)
if [ -z "$BASELINE_COUNT" ]; then BASELINE_COUNT=0; fi

if [ "$CURRENT_COUNT" -le "$BASELINE_COUNT" ] 2>/dev/null; then
  echo "OK PR-128 ratchet: $CURRENT_COUNT / $BASELINE_COUNT offenders (no growth)"
  if [ "$CURRENT_COUNT" -lt "$BASELINE_COUNT" ]; then
    printf "%s" "$CURRENT_COUNT" > "$BASELINE_FILE"
    echo "   Baseline updated to $CURRENT_COUNT (was $BASELINE_COUNT)"
  fi
  exit 0
fi

echo "X PR-128 ratchet tripped: $CURRENT_COUNT offenders (was $BASELINE_COUNT)"
echo ""
echo "NEW offenders (delta from baseline):"
echo "$OFFENDING" | head -20
echo ""
echo "Use ThemeColors.of(context).onSurface (brightness-aware) instead of"
echo "Colors.white/Colors.black. For specific use cases (e.g. contrast"
echo "icon on a colored badge), use ThemeColors.<surface|primary|...> tokens."
echo "If a non-token value is intentional, add a trailing"
echo "'// allow: Colors' comment on the same line."
exit 1
