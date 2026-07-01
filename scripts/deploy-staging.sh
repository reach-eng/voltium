#!/bin/bash
set -e

ENV_NAME="staging"
PM2_APP_NAME="voltium-staging-web"
PM2_WORKER_NAME="voltium-staging-worker"
HEALTH_ENDPOINT="http://localhost:8082/api/health"

echo "Deploying to $ENV_NAME..."

# Step 1: Install dependencies and build
npm ci --production
npm run build
npm run worker:build

# Step 2: Database Migration Gate
echo "Running database migrations..."
npx prisma migrate deploy

# Step 3: Deploy (Zero Downtime Reload)
echo "Reloading PM2 processes..."
pm2 reload $PM2_APP_NAME || pm2 start npm --name "$PM2_APP_NAME" -- run start
pm2 reload $PM2_WORKER_NAME || pm2 start npm --name "$PM2_WORKER_NAME" -- run worker:start

# Step 4: Health Check post-deploy
echo "Performing health check on $HEALTH_ENDPOINT..."
for i in {1..5}; do
  if curl -sf $HEALTH_ENDPOINT > /dev/null; then
    echo "Health check passed!"
    exit 0
  fi
  echo "Waiting for health check... (Attempt $i/5)"
  sleep 5
done

# Step 5: Rollback on health check failure
echo "Health check failed! Initiating rollback..."
git revert HEAD --no-edit
# Depending on strategy, we would just rebuild the old code
npm ci --production
npm run build
pm2 reload $PM2_APP_NAME
pm2 reload $PM2_WORKER_NAME
echo "Rollback complete. Please investigate."
exit 1
