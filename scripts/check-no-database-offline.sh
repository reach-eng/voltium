#!/usr/bin/env bash
# =============================================================================
# PR-98 (DB-CL-1) — CI guard: no DATABASE_OFFLINE references in production code
# =============================================================================
#
# Fails the build if `process.env.DATABASE_OFFLINE` is read anywhere in
# `web/src/`. The offline mock fallback was removed in PR-98 because it
# created a production risk (misconfigured env var → silent mock data).
#
# Usage:
#   $ bash scripts/check-no-database-offline.sh
#   (called by .github/workflows/ci-cd.yml unit-test job)
#
# Acceptance:
#   - Exits 0 if no `DATABASE_OFFLINE` references in web/src/
#   - Exits 1 with offending file:line list otherwise
# =============================================================================

set -euo pipefail

# Resolve script directory (works on Git Bash and macOS/Linux)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$WORKSPACE_ROOT"

# Search for DATABASE_OFFLINE in web/src/ — exclude docs and tests
# (tests may reference the env var in their old setup, which we'll
# migrate in a follow-up; the guard is for production source only).
# Skip comment lines (// ... and /* ... */) so the audit-trail comments
# at the top of db.ts don't trip the guard.
MATCHES=$(grep -RIn --include="*.ts" --include="*.tsx" \
  "DATABASE_OFFLINE" web/src/ 2>/dev/null \
  | grep -vE '^[^:]+:[0-9]+:\s*(\*|//|/\*)' \
  | grep -vE '^\s*\*' \
  || true)

if [ -n "$MATCHES" ]; then
  echo "✗ Found DATABASE_OFFLINE references in web/src/ — must be removed:"
  echo "$MATCHES"
  echo ""
  echo "These references are forbidden by PR-98 (DB-CL-1). The DATABASE_OFFLINE"
  echo "mock fallback was a development convenience that created a real"
  echo "production risk (misconfigured env var → silent mock data)."
  echo ""
  echo "If you need a test mock, use vitest's vi.mock() helpers in"
  echo "tests/_setup/ instead."
  exit 1
fi

echo "✓ No DATABASE_OFFLINE references in web/src/"
exit 0
