#!/usr/bin/env bash
set -euo pipefail

# P0 gate: verify required secrets are present and long enough before any build/test.
# Called from ci-cd.yml prisma-check job (was unwired). Fails closed if .env missing in CI.
# See web/scripts/verify-env.ts for the canonical Node implementation; this shell wrapper keeps it runnable without npm ci.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Delegate to the Node verifier when available (has full env schema + length checks).
if [ -f "$REPO_ROOT/web/scripts/verify-env.ts" ]; then
  if command -v npx &>/dev/null; then
    npx --prefix "$REPO_ROOT/web" tsx scripts/verify-env.ts
    exit $?
  fi
fi

# Fallback: minimal shell check (works even without npm ci)
missing=0
for var in JWT_SECRET CRON_SECRET WORKER_SECRET FILE_UPLOAD_SECRET VERIFY_RECEIPT_SECRET; do
  val="${!var:-}"
  if [ -z "$val" ] || [ "${#val}" -lt 32 ]; then
    echo "::error:: $var must be set and at least 32 characters (P0 gate)"
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then exit 1; fi
echo "[OK] verify-env passed"
