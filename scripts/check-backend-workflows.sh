#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REQUIRED=(
  "web/src/app/api/admin/kyc/route.ts"
  "web/src/app/api/admin/guarantors/route.ts"
  "web/src/app/api/admin/rentals/route.ts"
  "web/src/app/api/admin/vehicles/[id]/history/route.ts"
  "web/src/app/api/rider/rental/return/route.ts"
  "web/src/app/api/rider/notifications/route.ts"
  "web/src/app/api/files/local-upload/[fileRecordId]/route.ts"
  "web/prisma/migrations/20260616000002_add_local_auth_rate_limit/migration.sql"
  "docs/BACKEND_WORKFLOW_READY.md"
)
for file in "${REQUIRED[@]}"; do
  if [ ! -f "$ROOT/$file" ]; then
    echo "FAIL: missing $file"
    exit 1
  fi
  echo "PASS: $file"
done
if grep -RIn "throw new Error('Not implemented')" "$ROOT/web/src/server/modules" "$ROOT/web/src/lib" >/dev/null 2>&1; then
  echo "FAIL: backend still contains throw new Error('Not implemented')"
  grep -RIn "throw new Error('Not implemented')" "$ROOT/web/src/server/modules" "$ROOT/web/src/lib" || true
  exit 1
fi
echo "PASS: backend workflow static gate passed"
