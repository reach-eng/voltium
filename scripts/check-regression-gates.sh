#!/usr/bin/env bash
# =============================================================================
# Voltium — CI Regression-Prevention Gates
# =============================================================================
# Enforces CI safety checks to prevent regressions of past bugs.
#
# Usage:
#   bash scripts/check-regression-gates.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Running Voltium CI Regression-Prevention Gates..."
echo ""

FAILED=0

# 1. No String.fromEnvironment for secrets in flutter/lib/
echo "Checking Gate 1: No String.fromEnvironment for secrets in flutter/lib/..."
SECRET_ENV_REFS=$(grep -RIn "String.fromEnvironment" "$PROJECT_DIR/flutter/lib/" 2>/dev/null | grep -Ei "secret|password|key|auth|token|hmac" || true)
if [ -n "$SECRET_ENV_REFS" ]; then
  echo "FAIL: Found String.fromEnvironment for secrets:"
  echo "$SECRET_ENV_REFS"
  FAILED=1
else
  echo "PASS: No String.fromEnvironment for secrets in flutter/lib/"
fi
echo ""

# 2. Every TEST_MODE ref guarded by !kReleaseMode
echo "Checking Gate 2: Every TEST_MODE ref guarded by !kReleaseMode..."
UNGUARDED_TEST_MODE=""
# Find all dart files in flutter/lib/ containing TEST_MODE
while IFS= read -r file; do
  # Check lines with TEST_MODE in the file
  while IFS= read -r line; do
    if [[ "$line" == *"TEST_MODE"* ]]; then
      if [[ "$line" != *"!kReleaseMode"* && "$line" != *"kReleaseMode"* ]]; then
        UNGUARDED_TEST_MODE="${UNGUARDED_TEST_MODE}${file}: ${line}\n"
      fi
    fi
  done < "$file"
done < <(find "$PROJECT_DIR/flutter/lib" -name "*.dart" -type f)

if [ -n "$UNGUARDED_TEST_MODE" ]; then
  echo "FAIL: Found unguarded TEST_MODE references in flutter/lib/:"
  printf "$UNGUARDED_TEST_MODE"
  FAILED=1
else
  echo "PASS: All TEST_MODE references in flutter/lib/ are guarded"
fi
echo ""

# 3. No import '.*main.dart' in flutter/lib/core/
echo "Checking Gate 3: No import of main.dart in flutter/lib/core/..."
MAIN_IMPORTS=$(grep -RIn "import.*main\.dart" "$PROJECT_DIR/flutter/lib/core/" 2>/dev/null || true)
if [ -n "$MAIN_IMPORTS" ]; then
  echo "FAIL: Found imports of main.dart in flutter/lib/core/:"
  echo "$MAIN_IMPORTS"
  FAILED=1
else
  echo "PASS: No main.dart imports in flutter/lib/core/"
fi
echo ""

# 4. No process.env.ADMIN_PASSWORD || 'admin123' in web/src/
echo "Checking Gate 4: No process.env.ADMIN_PASSWORD fallback to admin123 in web/src/..."
ADMIN_FALLBACKS=$(grep -RIn "ADMIN_PASSWORD.*||.*admin123" "$PROJECT_DIR/web/src/" 2>/dev/null || true)
if [ -n "$ADMIN_FALLBACKS" ]; then
  echo "FAIL: Found hardcoded fallback for ADMIN_PASSWORD in web/src/:"
  echo "$ADMIN_FALLBACKS"
  FAILED=1
else
  echo "PASS: No ADMIN_PASSWORD fallback to admin123 in web/src/"
fi
echo ""

# 5. Assert CRON_SECRET + WORKER_SECRET set in prod builds
echo "Checking Gate 5: Confirm environment checks for CRON_SECRET and WORKER_SECRET exist..."
PROD_ENV_CHECKS=$(grep -rn "CRON_SECRET" "$PROJECT_DIR/web/src/lib/env.ts" 2>/dev/null || true)
PROD_WORKER_CHECKS=$(grep -rn "WORKER_SECRET" "$PROJECT_DIR/web/src/lib/env.ts" 2>/dev/null || true)
if [ -z "$PROD_ENV_CHECKS" ] || [ -z "$PROD_WORKER_CHECKS" ]; then
  echo "FAIL: env.ts does not assert CRON_SECRET and WORKER_SECRET in prod environment"
  FAILED=1
else
  echo "PASS: env.ts asserts CRON_SECRET and WORKER_SECRET"
fi
echo ""

if [ "$FAILED" -eq 1 ]; then
  echo "CI regression check FAILED. Please fix the issues above."
  exit 1
else
  echo "CI regression check PASSED. Guardrails are active."
  exit 0
fi
