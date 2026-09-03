#!/bin/bash
set -euo pipefail

ENV_NAME="staging"
# P0 fix: PM2 app names must match ecosystem.config.js (voltium-web / voltium-worker, not staging-suffixed). The old names made every `pm2 reload` miss and fall to `pm2 start npm` (wrong cwd/model).
PM2_APP_NAME="voltium-web"
PM2_WORKER_NAME="voltium-worker"
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-http://localhost:8082/api/health}"
NO_ROLLBACK="${NO_ROLLBACK:-false}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"

notify() {
  local message="$1"
  if [ -n "$ALERT_WEBHOOK_URL" ]; then
    curl -sS -X POST "$ALERT_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"$message\"}" >/dev/null 2>&1 || true
  fi
}

echo "Deploying to $ENV_NAME..."

# Tag the commit for rollback reference
DEPLOY_TAG="deploy-${ENV_NAME}-$(date +%Y-%m-%d-%H%M%S)"
git tag "$DEPLOY_TAG"
echo "Tagged commit for rollback reference: $DEPLOY_TAG"

# Step 0: Security audit
# ━ Ticket #43 hardening ━ fail the deploy on high-severity audit findings.
echo "Running npm audit..."
if ! npm audit --audit-level=high 2>/dev/null; then
  echo "::error:: npm audit found high-severity vulnerabilities. Aborting deploy." >&2
  notify "❌ Deploy to $ENV_NAME ABORTED: npm audit found high-severity vulnerabilities"
  exit 1
fi

# Step 1: Install dependencies and build (parallel, fail-fast per-task — bare `wait` masks job failures)
npm ci
if ! npm run build:all 2>&1 | sed 's/^/[build:all] /'; then
  echo "FATAL: build failed" >&2
  exit 1
fi

# Step 2: Database Migration Gate
echo "Running database migrations..."
npx prisma migrate deploy

# Step 3: Deploy (Zero Downtime Reload — uses ecosystem.config.js app names).
# The old PM2 names (voltium-staging-web) did not exist; pm2 reload missed and fell to `pm2 start npm` (wrong cwd/model).
echo "Reloading PM2 processes..."
if ! pm2 reload ecosystem.config.js --only "$PM2_APP_NAME"; then
  echo "WARN: pm2 reload failed, attempting pm2 start"
  if ! pm2 start ecosystem.config.js --only "$PM2_APP_NAME"; then
    echo "FATAL: pm2 reload AND pm2 start both failed" >&2
    notify "❌ Deploy to $ENV_NAME FAILED: pm2 reload and start both failed"
    exit 1
  fi
fi
if ! pm2 reload ecosystem.config.js --only "$PM2_WORKER_NAME"; then
  echo "WARN: worker pm2 reload failed, attempting pm2 start"
  if ! pm2 start ecosystem.config.js --only "$PM2_WORKER_NAME"; then
    echo "FATAL: worker reload AND start both failed" >&2
    notify "❌ Deploy to $ENV_NAME FAILED: worker reload and start both failed"
    exit 1
  fi
fi

# Step 4: Multi-endpoint Smoke Test Check post-deploy
echo "Performing post-deploy smoke check suite..."
SMOKE_ENDPOINTS=(
  "$HEALTH_ENDPOINT"
  "http://localhost:8082/api/support/faqs"
  "http://localhost:8082/api/system/settings"
)

for i in $(seq 1 30); do
  ALL_PASSED=true
  for endpoint in "${SMOKE_ENDPOINTS[@]}"; do
    if ! curl -sf "$endpoint" > /dev/null; then
      ALL_PASSED=false
      break
    fi
  done

  if [ "$ALL_PASSED" = true ]; then
    echo "Staging post-deploy smoke test suite passed!"
    notify "✅ Deploy to $ENV_NAME succeeded ($DEPLOY_TAG)"
    exit 0
  fi
  echo "Waiting for smoke tests... (Attempt $i/30)"
  sleep 5
done

# Step 5: Rollback on health check failure.
# P0: schema rollback is NOT attempted — MIGRATION_POLICY.md mandates
# roll-forward-only. Code is reverted; schema rolls forward with a fix.
# `prisma migrate status` is logged for triage, not a rollback gate.
notify "❌ Deploy to $ENV_NAME FAILED: smoke test timeout"

if [ "$NO_ROLLBACK" = "true" ]; then
  echo "Smoke tests failed and NO_ROLLBACK=true. Manual intervention required." >&2
  npx prisma migrate status || true
  exit 1
fi

echo "Smoke tests failed! Rolling back CODE only (schema rolls forward — see MIGRATION_POLICY.md)..."
PREVIOUS_TAG=$(git tag --sort=-creatordate | grep -E "^deploy-${ENV_NAME}-" | head -2 | tail -1)
if [ -z "$PREVIOUS_TAG" ]; then
  echo "FATAL: no previous deploy tag found for rollback" >&2
  npx prisma migrate status || true
  exit 1
fi

npx prisma migrate status || true
echo "NOTE: no down-migration will be attempted. If this deploy included a schema change, roll forward with a fix (MIGRATION_POLICY.md:65-72)."

git checkout "$PREVIOUS_TAG"
npm ci
if ! npm run build:all 2>&1 | sed 's/^/[build:all] /'; then
  echo "FATAL: rollback build failed" >&2
  exit 1
fi
pm2 reload ecosystem.config.js --only "$PM2_APP_NAME" || pm2 start ecosystem.config.js --only "$PM2_APP_NAME"
pm2 reload ecosystem.config.js --only "$PM2_WORKER_NAME" || pm2 start ecosystem.config.js --only "$PM2_WORKER_NAME"
echo "Rollback to $PREVIOUS_TAG complete (code only — schema was not rewound). Please investigate and roll forward."
notify "⚠️ Deploy to $ENV_NAME ROLLED BACK (code only) to $PREVIOUS_TAG — schema was NOT rewound (roll-forward required)"
exit 1
