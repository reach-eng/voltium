#!/usr/bin/env bash
# =============================================================================
# Voltium — Public Beta Readiness Gate
# =============================================================================
# Static gate for the laptop-only public beta source package. This does not
# replace live laptop tests, but it blocks the common regressions that make a
# public beta unsafe: missing Data Management APIs, leaked env files, Docker,
# cloud data services, and incomplete service architecture.
# =============================================================================

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FOUND=0

FLUTTER_ONLY=0
for arg in "$@"; do
  if [ "$arg" = "--flutter-only" ]; then
    FLUTTER_ONLY=1
  fi
done

fail() {
  echo "FAIL: $1"
  FOUND=1
}

pass() {
  echo "PASS: $1"
}

require_file() {
  if [ "$FLUTTER_ONLY" -eq 1 ] && [[ "$1" == web/* ]]; then
    return 0
  fi
  if [ -f "$ROOT/$1" ]; then
    pass "$1"
  else
    fail "missing $1"
  fi
}

echo "Checking Voltium public beta readiness in: $ROOT (flutter-only: $FLUTTER_ONLY)"
echo ""

# Core guardrail checks
bash "$ROOT/scripts/check-no-docker.sh" >/tmp/voltium_beta_no_docker.log || { cat /tmp/voltium_beta_no_docker.log; FOUND=1; }
bash "$ROOT/scripts/check-no-cloud-data.sh" >/tmp/voltium_beta_no_cloud.log || { cat /tmp/voltium_beta_no_cloud.log; FOUND=1; }
if [ "$FLUTTER_ONLY" -eq 1 ]; then
  bash "$ROOT/scripts/check-laptop-service-architecture.sh" --flutter-only >/tmp/voltium_beta_laptop.log || { cat /tmp/voltium_beta_laptop.log; FOUND=1; }
else
  bash "$ROOT/scripts/check-laptop-service-architecture.sh" >/tmp/voltium_beta_laptop.log || { cat /tmp/voltium_beta_laptop.log; FOUND=1; }
fi

# No real env files in source package
ENV_HITS=$(find "$ROOT" \
  \( -name ".git" -o -name "node_modules" -o -name ".next" -o -name "build" -o -name ".dart_tool" \) -prune \
  -o \( -name ".env" -o -name ".env.local" -o -name ".env.production" -o -name ".env.production.local" -o -name "web/.env" -o -name "web/.env.production.local" \) \
  -print 2>/dev/null || true)
if [ -n "$ENV_HITS" ]; then
  fail "real env files found: $ENV_HITS"
else
  pass "no real env files found"
fi

# Required Data Management backup APIs
require_file "web/src/app/api/admin/data-management/backups/route.ts"
require_file "web/src/app/api/admin/data-management/backups/[id]/route.ts"
require_file "web/src/app/api/admin/data-management/backups/[id]/verify/route.ts"
require_file "web/src/app/api/admin/data-management/backups/[id]/download/route.ts"
require_file "web/src/app/api/admin/data-management/restore/validate/route.ts"
require_file "web/src/app/api/admin/data-management/restore/start/route.ts"
require_file "web/src/app/api/admin/data-management/schedule/route.ts"

# Required laptop/admin service docs
require_file "docs/PUBLIC_BETA_READINESS.md"
require_file "docs/PUBLIC_BETA_RUNBOOK.md"
require_file "docs/PUBLIC_BETA_TEST_PLAN.md"
require_file "docs/LAPTOP_SERVICE_ARCHITECTURE.md"
require_file "docs/DATA_MANAGEMENT.md"

# Required safety files/routes
require_file "web/src/app/api/files/local-upload/[fileRecordId]/route.ts"
require_file "web/src/app/api/admin/maintenance-mode/route.ts"
require_file "web/src/app/api/health/db/route.ts"
require_file "web/src/app/api/health/storage/route.ts"
require_file "web/src/app/api/health/worker/route.ts"

# Check for obvious exported artifacts that should not be in a beta source package
ARTIFACT_HITS=$(find "$ROOT" \
  \( -path "$ROOT/.git" -o -path "$ROOT/node_modules" -o -path "$ROOT/web/node_modules" \) -prune \
  -o \( -path "*/.kilo/*" -o -path "*/.opencode/*" -o -path "*/playwright-report/*" -o -path "*/test-results/*" -o -path "*/flutter/screenshots/*" -o -path "*/data/uploads/*" -o -path "*/data/backups/*" \) \
  -print 2>/dev/null | head -20 || true)
if [ -n "$ARTIFACT_HITS" ]; then
  fail "debug/test/data artifacts found (first 20): $ARTIFACT_HITS"
else
  pass "no beta-blocking artifacts found"
fi

# Public beta must not keep prisma db push as the production path.
if [ "$FLUTTER_ONLY" -eq 0 ]; then
  if grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next -E 'prisma db push|"db:push"' "$ROOT/web/package.json" "$ROOT/.github" >/tmp/voltium_beta_dbpush.log 2>/dev/null; then
    fail "prisma db push production/CI references found"
    cat /tmp/voltium_beta_dbpush.log
  else
    pass "no prisma db push production/CI path found"
  fi
else
  pass "skipping db push check for --flutter-only"
fi

if [ "$FOUND" -eq 0 ]; then
  echo ""
  echo "PASS: static public beta readiness gate passed."
else
  echo ""
  echo "FAIL: static public beta readiness gate failed."
fi

exit "$FOUND"
