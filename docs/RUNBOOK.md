# Voltium Operations Runbook

This document provides operational guidelines, deployment procedures, and troubleshooting steps for the Voltium platform.

## Deployment Procedure

### Pre-Deployment
1. Verify the CI pipeline is green on the `main` branch.
2. Review the `docs/RELEASE_CHECKLIST.md`.
3. Check `npx prisma migrate status` for any pending database migrations.
4. Notify stakeholders in the `#engineering-releases` Slack channel.

### Deployment (Automated)
We use PM2 for zero-downtime reloads.
- **Staging**: `npm run deploy:staging` (from the `web` directory)
- **Production**: `npm run deploy:prod` (from the `web` directory)

The deployment script will automatically:
1. Fetch latest changes and install dependencies (`npm ci --production`).
2. Run Prisma migrations (`npx prisma migrate deploy`).
3. Build the Next.js app and Worker bundles.
4. Restart PM2 processes.
5. Poll the `/api/health` endpoint. If it fails, an automatic rollback is triggered.

### Post-Deployment
1. Monitor Sentry for any new unhandled exceptions.
2. Check Grafana/Datadog dashboards for latency spikes (p95 > 500ms).
3. Validate core flows: Mobile App Login, Vehicle Listing.

## Rollback Procedure
If a critical issue is discovered post-deployment:
1. Revert the commit in Git: `git revert <commit_hash>`
2. Push to `main`.
3. CI will build and you can execute the deployment script again.
4. **Database Rollbacks**: Prisma does not natively support down migrations. If a schema change caused the issue, you must write a new forward migration (`npx prisma migrate dev --name revert_x`) to undo the changes.

## Common Incidents & Mitigation

### 1. DB Connection Pool Exhausted
**Symptoms**: `PrismaClientInitializationError: P2024` or latency spikes > 2000ms.
**Mitigation**:
- Check if a specific query is missing an index using `EXPLAIN ANALYZE`.
- Temporarily increase the PM2 instance count or PgBouncer connection limits.
- Check for runaway background jobs consuming the pool.

### 2. Worker Queue Backed Up
**Symptoms**: High `outbox_pending_count` or delayed emails/SMS.
**Mitigation**:
- Check the worker logs: `pm2 logs voltium-worker`.
- Scale the worker instances: `pm2 scale voltium-worker +2`.
- Identify poison pill jobs and mark them as `FAILED` manually in the database to unblock the queue.

### 3. Rate Limit Storm
**Symptoms**: Users reporting 429 Too Many Requests on login/OTP.
**Mitigation**:
- Determine if the traffic is legitimate or a volumetric attack.
- If an attack, block the offending IPs via Caddy/Cloudflare.
- If legitimate, temporarily increase the rate limit threshold in Redis or `src/lib/rate-limit.ts`.

### 4. Webhook Delivery Failures (5xx)
**Symptoms**: Payment completions not reflecting in Voltium.
**Mitigation**:
- Check the `Transaction` table for missing `idempotencyKey` entries.
- Verify the webhook provider's dashboard for the raw payload.
- Manually trigger the missing updates using the admin dashboard or via CLI.

### 5. Outbox Reaper Stuck
**Symptoms**: Outbox events remain in `PROCESSING` state indefinitely.
**Mitigation**:
- The Reaper cron job might have crashed. Restart the worker: `pm2 restart voltium-worker`.
- Manually reset stuck events: `UPDATE "OutboxEvent" SET status = 'PENDING' WHERE status = 'PROCESSING' AND "updatedAt" < NOW() - INTERVAL '1 hour';`

## Escalation & On-Call

### Primary On-Call
- **Name**: [Insert Name]
- **Phone**: [Insert Phone]
- **Responsibilities**: Acknowledge PagerDuty alerts within 5 minutes, triage, and execute runbook mitigations.

### Escalation Contacts
- **Engineering Manager**: [Insert Name]
- **Infrastructure Lead**: [Insert Name]

## SLO Definitions & Targets
- **Vehicle Listing Latency**: p95 < 200ms
- **Booking Flow Latency**: p95 < 500ms
- **System Uptime**: 99.9%
- **Error Rate**: < 1% on `/api/*` endpoints.
