#!/usr/bin/env bash
# =============================================================================
# Voltium Flutter — Design System Lint
# =============================================================================
# Fails CI on:
#   1. Raw Color(0xFF...) outside flutter/lib/theme/        (Ticket #32)
#   2. Off-grid EdgeInsets.all(N) / BorderRadius.circular(N) (Ticket #32)
#   3. Stray debugPrint(...) outside lib/theme/             (Ticket #3 sub-A)
#
# Tickets: #32 (design-system enforcement), #3 sub-A (appDebug migration)
#
# Usage:
#   bash flutter/scripts/lint-design-system.sh                  # lint
#   ALLOW_DESIGN_LINT=1 bash flutter/scripts/lint-design-system.sh  # emergency bypass
#
# Exit codes:
#   0 — clean (no violations)
#   1 — violations found
#   2 — environment error (flutter dir not found)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLUTTER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Allowed areas: the theme module is the canonical home for raw colors and
# the logger file is the canonical home for the debugPrint→appDebug hint.
ALLOWED_PATTERN='lib/theme/'
LOGGER_PATTERN='lib/utils/app_logger.dart'

# Patterns we want to catch.
# 1. Raw Color(0xFF...) in non-theme code
RAW_COLOR_PATTERN='Color\(0xFF[A-Fa-f0-9]{6,8}\)'

# 2. Off-grid spacing/radius values.
# The design system uses 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 /
# 32 / 48 (canonical 4px grid + sub-grid). Anything ODD is off-grid (1, 3, 5,
# 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, ...).
# We catch literal `EdgeInsets.all(N)` and `BorderRadius.circular(N)` where N
# is an odd positive integer. Even values are on-grid; 0 is a special case
# (used by `circular(0)` for fully-rectangular corners).
# Match the call sites; the awk filter narrows to odd values.
EDGE_INSETS_PATTERN='EdgeInsets\.all\([-]?[0-9]+\)'
BORDER_RADIUS_PATTERN='BorderRadius\.circular\([-]?[0-9]+\)'

# 3. Stray debugPrint(...) outside lib/utils/app_logger.dart.
# The logger file intentionally references `debugPrint` in doc comments as
# the canonical example; everywhere else must use `appDebug(...)`.
DEBUG_PRINT_PATTERN='\bdebugPrint\s*\('

VIOLATIONS=0

if [ "${ALLOW_DESIGN_LINT:-0}" = "1" ]; then
  echo "[lint-design-system] ALLOW_DESIGN_LINT=1 — emergency bypass, skipping checks."
  exit 0
fi

if [ ! -d "$FLUTTER_DIR/lib" ]; then
  echo "[lint-design-system] ERROR: flutter/lib not found at $FLUTTER_DIR/lib" >&2
  exit 2
fi

cd "$FLUTTER_DIR"

# ── Check 1: Raw Color(0xFF...) outside lib/theme/ ─────────────────────────
echo "[lint-design-system] Checking for raw Color(0xFF...) outside lib/theme/..."

# Grep for raw colors, exclude lib/theme/, exclude build artifacts.
RAW_COLOR_HITS=$(grep -rEn "$RAW_COLOR_PATTERN" lib \
  --include='*.dart' \
  --exclude-dir=build \
  --exclude-dir=.dart_tool \
  --exclude-dir=gen \
  --exclude='*.g.dart' 2>/dev/null \
  | grep -v "$ALLOWED_PATTERN" || true)

if [ -n "$RAW_COLOR_HITS" ]; then
  RAW_COUNT=$(echo "$RAW_COLOR_HITS" | wc -l | tr -d ' ')
  echo "  ❌ Found $RAW_COUNT raw Color(0xFF...) occurrences outside lib/theme/:"
  echo "$RAW_COLOR_HITS" | sed 's/^/      /'
  VIOLATIONS=$((VIOLATIONS + RAW_COUNT))
fi

# ── Check 2: Off-grid EdgeInsets ─────────────────────────────────────────────
echo "[lint-design-system] Checking for off-grid EdgeInsets.all(N)..."
EDGE_HITS=$(grep -rEn "$EDGE_INSETS_PATTERN" lib \
  --include='*.dart' \
  --exclude-dir=build \
  --exclude-dir=.dart_tool 2>/dev/null \
  | grep -v "$ALLOWED_PATTERN" \
  | awk '{
      # Find the numeric argument of EdgeInsets.all(...)
      n = match($0, /EdgeInsets\.all\([-]?[0-9]+\)/)
      if (n == 0) next
      s = substr($0, n, RLENGTH)
      gsub(/[^0-9-]/, "", s)
      v = s + 0
      # Off-grid = any odd positive integer (negative is sign-of-direction, even is fine)
      if (v != 0 && v > 0 && int(v) == v && v % 2 != 0) print
    }' || true)

if [ -n "$EDGE_HITS" ]; then
  EDGE_COUNT=$(echo "$EDGE_HITS" | wc -l | tr -d ' ')
  echo "  ❌ Found $EDGE_COUNT off-grid EdgeInsets.all(N) (odd values):"
  echo "$EDGE_HITS" | sed 's/^/      /'
  VIOLATIONS=$((VIOLATIONS + EDGE_COUNT))
fi

# ── Check 3: Off-grid BorderRadius ───────────────────────────────────────────
echo "[lint-design-system] Checking for off-grid BorderRadius.circular(N)..."
RADIUS_HITS=$(grep -rEn "$BORDER_RADIUS_PATTERN" lib \
  --include='*.dart' \
  --exclude-dir=build \
  --exclude-dir=.dart_tool 2>/dev/null \
  | grep -v "$ALLOWED_PATTERN" \
  | awk '{
      n = match($0, /BorderRadius\.circular\([-]?[0-9]+\)/)
      if (n == 0) next
      s = substr($0, n, RLENGTH)
      gsub(/[^0-9-]/, "", s)
      v = s + 0
      if (v != 0 && v > 0 && int(v) == v && v % 2 != 0) print
    }' || true)

if [ -n "$RADIUS_HITS" ]; then
  RADIUS_COUNT=$(echo "$RADIUS_HITS" | wc -l | tr -d ' ')
  echo "  ❌ Found $RADIUS_COUNT off-grid BorderRadius.circular(N) (odd values):"
  echo "$RADIUS_HITS" | sed 's/^/      /'
  VIOLATIONS=$((VIOLATIONS + RADIUS_COUNT))
fi

# ── Check 4: Stray debugPrint(...) outside lib/utils/app_logger.dart ────────
echo "[lint-design-system] Checking for stray debugPrint(...) outside lib/utils/app_logger.dart..."
DEBUG_HITS=$(grep -rEn "$DEBUG_PRINT_PATTERN" lib \
  --include='*.dart' \
  --exclude-dir=build \
  --exclude-dir=.dart_tool 2>/dev/null \
  | grep -v "$LOGGER_PATTERN" \
  | awk -F: '{ line=""; for (i=3; i<=NF; i++) line = (line == "" ? $i : line ":" $i); if (line !~ /^\s*\/\//) print }' \
  || true)

if [ -n "$DEBUG_HITS" ]; then
  DEBUG_COUNT=$(echo "$DEBUG_HITS" | wc -l | tr -d ' ')
  echo "  ❌ Found $DEBUG_COUNT stray debugPrint(...) call(s):"
  echo "$DEBUG_HITS" | sed 's/^/      /'
  echo "    Fix: replace debugPrint(...) with appDebug(...) from utils/app_logger.dart."
  VIOLATIONS=$((VIOLATIONS + DEBUG_COUNT))
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "[lint-design-system] ❌ FAILED: $VIOLATIONS violation(s)."
  echo "    Fix: replace raw Color(0xFF...) with AppColors.* tokens,"
  echo "    use AppSpacing / AppRadius for spacing/radius, and use appDebug()"
  echo "    instead of debugPrint() (with the app_logger.dart import)."
  echo "    Emergency override: ALLOW_DESIGN_LINT=1 (NOT recommended)."
  exit 1
fi

echo "[lint-design-system] ✅ PASS: no design-system violations."
exit 0
