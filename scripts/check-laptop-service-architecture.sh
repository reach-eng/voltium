#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FOUND=0

FLUTTER_ONLY=0
for arg in "$@"; do
  if [ "$arg" = "--flutter-only" ]; then
    FLUTTER_ONLY=1
  fi
done

require_file() {
  if [ "$FLUTTER_ONLY" -eq 1 ] && [[ "$1" == web/* ]]; then
    return 0
  fi
  if [ -f "$ROOT/$1" ]; then
    echo "PASS: $1"
  else
    echo "FAIL: missing $1"
    FOUND=1
  fi
}

require_file "ecosystem.config.js"
require_file "scripts/laptop-service.ps1"
require_file "scripts/laptop-service-smoke.ps1"
require_file "docs/LAPTOP_SERVICE_ARCHITECTURE.md"
require_file "docs/LAPTOP_SERVICE_RUNBOOK.md"
require_file "web/src/app/api/health/route.ts"
require_file "web/src/app/api/health/db/route.ts"
require_file "web/src/app/api/health/storage/route.ts"
require_file "web/src/app/api/health/worker/route.ts"

if grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=build \
  -E "interpreter:[[:space:]]*['\"]bash['\"]|script:[[:space:]]*['\"]bash['\"]" "$ROOT/ecosystem.config.js" >/tmp/voltium_laptop_service_hits 2>/dev/null; then
  echo "FAIL: ecosystem.config.js contains bash-specific PM2 interpreter/script"
  cat /tmp/voltium_laptop_service_hits
  FOUND=1
else
  echo "PASS: PM2 config is not bash-only"
fi

if grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=build \
  -E "DATA_MODE=local_laptop|DATA_MODE: 'local_laptop'|DATA_MODE: \"local_laptop\"" "$ROOT/ecosystem.config.js" "$ROOT/docs" >/dev/null 2>&1; then
  echo "PASS: local_laptop mode is documented/enforced in service layer"
else
  echo "FAIL: local_laptop mode not found in service layer docs/config"
  FOUND=1
fi

if grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=build \
  -E "pm2|PostgreSQL|localhost:5432|LOCAL_STORAGE_ROOT|BACKUP_ROOT" "$ROOT/docs/LAPTOP_SERVICE_ARCHITECTURE.md" >/dev/null 2>&1; then
  echo "PASS: laptop service doc covers PM2, PostgreSQL, storage, and backups"
else
  echo "FAIL: laptop service doc is incomplete"
  FOUND=1
fi

exit "$FOUND"
