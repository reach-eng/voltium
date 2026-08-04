#!/usr/bin/env bash
# =============================================================================
# PR-112 (SEC PR-5) — CI guard: no raw NODE_ENV in security-sensitive code
# =============================================================================
#
# Fails the build if `process.env.NODE_ENV` is read as the ONLY env signal
# in security gates under `web/src/lib/` and `web/src/middleware.ts`. These
# files implement auth, rate limiting, cookie policy, PII encryption, and
# CSP — all of which must read the canonical APP_ENV first.
#
# Why:
#   A misconfigured prod with `APP_ENV=staging` + `NODE_ENV=production`
#   would silently get dev/staging security posture if any of these gates
#   reads NODE_ENV only. APP_ENV is the canonical env identifier.
#
# Permitted patterns:
#   - Fallback usage: an expression that contains BOTH `APP_ENV` and
#     `NODE_ENV` (e.g. `process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production'`)
#     is allowed — that's the defense-in-depth pattern documented in
#     `pii-crypto.ts:16` and `rider-auth.ts:22`. The script uses a 12-line
#     window to accept the common multi-line `||` pattern.
#   - Comment lines (`//`, `*`, `/*`) are skipped.
#   - Test files (`*.test.ts`, `*.test.tsx`) are skipped — tests intentionally
#     cover both env vars to lock in the spec.
#
# Usage:
#   $ bash scripts/check-no-node-env-security.sh
#   (called by .github/workflows/ci-cd.yml unit-test job)
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WORKSPACE_ROOT"

# Collect every `process.env.NODE_ENV` reference in security-sensitive code,
# excluding test files and comment-only lines.
MATCHES=$(grep -RIn --include="*.ts" --include="*.tsx" \
  --exclude="*.test.ts" --exclude="*.test.tsx" \
  "process\.env\.NODE_ENV" \
  web/src/lib/ web/src/middleware.ts 2>/dev/null \
  | grep -vE '^[^:]+:[0-9]+:\s*(\*|//|/\*)' \
  | grep -vE '^\s*\*' \
  || true)

if [ -z "$MATCHES" ]; then
  echo "OK No raw process.env.NODE_ENV in security-sensitive code (PR-112 compliant)"
  exit 0
fi

# For each match, build a 12-line window and keep the match only if
# APP_ENV is NOT present in the window (i.e. NODE_ENV is read without
# an APP_ENV fallback in the same logical expression).
OFFENDING=""
while IFS= read -r MATCH_LINE; do
  [ -z "$MATCH_LINE" ] && continue
  FILE=$(echo "$MATCH_LINE" | cut -d: -f1)
  MYLINE=$(echo "$MATCH_LINE" | cut -d: -f2)
  # Test-runner convention: `NODE_ENV === 'test'` is how vitest/mocha/etc.
  # identify the test process. Not a production gate. Whitelist.
  if echo "$MATCH_LINE" | grep -qE "NODE_ENV\s*===?\s*'test'"; then
    continue
  fi
  START=$((MYLINE - 200))
  if [ "$START" -lt 1 ]; then START=1; fi
  END=$((MYLINE + 6))
  WINDOW=$(awk -v s="$START" -v e="$END" 'NR>=s && NR<=e' "$FILE" 2>/dev/null || true)
  if echo "$WINDOW" | grep -qE 'APP_ENV|env\.APP_ENV'; then
    continue
  fi
  OFFENDING="${OFFENDING}${MATCH_LINE}"$'\n'
done <<< "$MATCHES"

if [ -n "$OFFENDING" ]; then
  echo "X Found raw process.env.NODE_ENV (without APP_ENV fallback) in security-sensitive code:"
  echo "$OFFENDING"
  echo ""
  echo "These references are forbidden by PR-112 (SEC PR-5). The canonical"
  echo "env identifier for security gates is APP_ENV. A misconfigured prod"
  echo "with APP_ENV=staging + NODE_ENV=production would otherwise get the"
  echo "wrong security posture (dev OTP, in-memory rate limiter, non-secure"
  echo "cookies, etc.)."
  echo ""
  echo "If NODE_ENV is intentionally used as a fallback AFTER APP_ENV (a"
  echo "defense-in-depth pattern), keep both on the same logical expression"
  echo "(multi-line || is fine) so this guard accepts it. See"
  echo "pii-crypto.ts:16 and rider-auth.ts:22 for the canonical pattern."
  exit 1
fi

echo "OK No raw process.env.NODE_ENV in security-sensitive code (PR-112 compliant)"
exit 0
