#!/bin/bash
set -euo pipefail

ENV_NAME="staging"
PM2_APP_NAME="voltium-staging-web"
PM2_WORKER_NAME="voltium-staging-worker"
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

# Step 1: Install dependencies and build (parallel)
npm ci
npm run build:all

# Step 2: Database Migration Gate
echo "Running database migrations..."
npx prisma migrate deploy

# Step 3: Deploy (Zero Downtime Reload)
echo "Reloading PM2 processes..."
if ! pm2 reload "$PM2_APP_NAME"; then
  echo "WARN: pm2 reload failed, attempting pm2 start"
  if ! pm2 start npm --name "$PM2_APP_NAME" -- run start; then
    echo "FATAL: pm2 reload AND pm2 start both failed" >&2
    notify "❌ Deploy to $ENV_NAME FAILED: pm2 reload and start both failed"
    exit 1
  fi
fi
if ! pm2 reload "$PM2_WORKER_NAME"; then
  echo "WARN: worker pm2 reload failed, attempting pm2 start"
  if ! pm2 start npm --name "$PM2_WORKER_NAME" -- run worker:start; then
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

# Step 5: Rollback on health check failure
notify "❌ Deploy to $ENV_NAME FAILED: smoke test timeout"

if [ "$NO_ROLLBACK" = "true" ]; then
  echo "Smoke tests failed and NO_ROLLBACK=true. Manual intervention required." >&2
  exit 1
fi

echo "Smoke tests failed! Initiating rollback..."
PREVIOUS_TAG=$(git tag --sort=-creatordate | grep -E "^deploy-${ENV_NAME}-" | head -2 | tail -1)
if [ -z "$PREVIOUS_TAG" ]; then
  echo "FATAL: no previous deploy tag found for rollback" >&2
  exit 1
fi

# Migration status check
if ! npx prisma migrate status; then
  echo "WARN: Prisma migrations in unexpected state. Aborting auto-rollback." >&2
  exit 1
fi

git checkout "$PREVIOUS_TAG"
npm ci
npm run build:all
pm2 reload "$PM2_APP_NAME" || pm2 start npm --name "$PM2_APP_NAME" -- run start
pm2 reload "$PM2_WORKER_NAME" || pm2 start npm --name "$PM2_WORKER_NAME" -- run worker:start
echo "Rollback to $PREVIOUS_TAG complete. Please investigate."
notify "⚠️ Deploy to $ENV_NAME ROLLED BACK to $PREVIOUS_TAG"
exit 1
