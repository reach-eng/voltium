# Voltium Operations Runbook

> [!WARNING]
> **DEPRECATED TOPOLOGY — DO NOT FOLLOW**
> This runbook references legacy procedures and an outdated server topology (Caddy, Bun bundles, mini-services, and `.zscripts/`) that has been decommissioned.
> As of 2026-09-03:
> - There is NO `.zscripts/`, NO `mini-services/`, NO Bun bundles, and NO Caddy in this repository.
> - Background work runs in-process via `web/src/server/workers/` (PostgreSQL `OutboxEvent` + `lib/job-queue.ts`).
> - `infra/` holds only `grafana/`.
> - For current host orchestration and service management, see `scripts/laptop-service.ps1` and `AGENTS.md`.

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

## PM2 Cluster Mode Flip Procedure

The production PM2 config (`ecosystem.config.js`) has cluster mode + extended timeouts already in place. The flip from single-instance to cluster mode is a **deliberate ops step** that requires staging soak to complete first.

**Prerequisites:**
- 24-48h staging soak with cluster mode enabled has completed without restarts, SIGKILLs, or unhandled rejections
- All staging e2e tests pass with cluster mode
- The production deploy is scheduled during a low-traffic window

**Procedure:**
1. **Verify staging health:**
   ```sh
   ssh staging "pm2 jlist | jq '.[] | {name, pm2_env.exec_mode, pm2_env.instances, restart_time, unstable_restarts}'"
   # All 3 should show: exec_mode=cluster_mode, instances>1, restart_time<5
   ```
2. **Snapshot current production PM2 state:**
   ```sh
   ssh prod "pm2 save && pm2 jlist > ~/pre-flip-state.json"
   ```
3. **Update production config to cluster mode:**
   ```sh
   # ecosystem.config.js already has instances: 'max' + exec_mode: 'cluster'
   # No edit needed; just reload
   ssh prod "pm2 reload ecosystem.config.js"
   ```
4. **Watch the reload (1 min):**
   ```sh
   ssh prod "pm2 monit"
   # Verify: each cluster instance boots in <5s, no restart loops
   ```
5. **Smoke test:**
   ```sh
   curl -fsS https://voltium.example.com/api/health
   curl -fsS -X POST https://voltium.example.com/api/auth/refresh -H "Cookie: voltium_session=..."
   ```
6. **If anything looks wrong, roll back:**
   ```sh
   # Force-revert to single instance
   ssh prod "pm2 scale voltium-prod-web 1"
   # OR roll back the deploy tag
   ./scripts/deploy-prod.sh --rollback
   ```
7. **Mark Tickets #39 + #42 SHIPPED** in `docs/FOLLOWUP_TICKETS.md` once the flip is verified clean in production for 24h.

**Monitoring during the flip (first 24h):**
- `pm2 logs voltium-prod-web --lines 1000` — look for SIGTERM, unhandled rejection
- `/api/health` — should return 200 from each cluster instance (the load balancer will round-robin)
- Worker queue — should not back up (cluster mode doesn't change worker behavior)
- DB pool — should be 1-2x normal load, not 3x+ (cluster instances share the same pool config)

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

---

## Background Workers — Job Types

| Job Type | Source | Trigger | Concurrency | Description |
|----------|--------|---------|-------------|-------------|
| `wallet.reconciliation` | `wallet-reconciliation.job.ts` | Daily cron + worker poll | 10 (batched) | Verifies wallet balances match ledger sums |
| `notification.send` | `notification-dispatch.job.ts` | Worker poll | 3 | Push/in-app notification dispatch |
| `engagement.daily` | `daily-engagement.job.ts` | Scheduled emitter (06:00 IST) | 1 | Daily engagement metrics |
| `rent.due_check` | Scheduled emitter | Every 1 min | 2 | Rent due check & auto-debit |
| `device.violation_scan` | Scheduled emitter | Every 1 min | 2 | Device compliance scanner |
| `referral.reward` | `referral-reward.job.ts` | Worker poll | 3 | Referral reward processing |
| `sms.send` | Worker poll | Enqueued by use-cases | 5 | SMS dispatch |
| `audit-log.cleanup` | Scheduled emitter | Every 5 min | 1 | Purge expired audit logs |
| `telemetry.cleanup` | Scheduled emitter | Every 5 min | 1 | Purge old telemetry data |
| `rent-reminders.send` | Scheduled emitter | Every 5 min | 1 | Upcoming rent reminders |
| `notification.cleanup` | Scheduled emitter | Every 5 min | 1 | Purge read/old notifications |

### Reaper Configuration

The reaper reclaims stuck `PROCESSING` jobs. Threshold is per-job-type:

- **Default:** 5 minutes
- `wallet.reconciliation`: 15 minutes (long-running batch)
- `sms.send`: 2 minutes
- `notification.send`: 2 minutes

**Behavior:** Resets `PROCESSING` → `PENDING`, increments attempts, posts to alerter.

### Alerting

- **When:** Job permanently fails (with `notifyOnFail: true`) or reaper reclaims stuck jobs
- **Channel:** Set `ALERT_WEBHOOK_URL` env var (Slack, Discord, or generic JSON)
- **Level gate:** `ALERT_MIN_LEVEL` env var (default: `error`)

#### Channel setup (Slack — default)

The team's default channel is Slack. The alerter formats payloads using
Slack's incoming-webhook attachment format.

1. Create a Slack incoming webhook for the `#voltium-ops` channel:
   - Go to <https://api.slack.com/messaging/webhooks> → "Create your Slack app"
   - Enable "Incoming Webhooks" → "Add New Webhook to Workspace"
   - Select the `#voltium-ops` channel → "Install"
   - Copy the webhook URL (starts with `https://hooks.slack.com/services/...`)

2. Set the env var on each environment:
   ```bash
   # .env.production
   ALERT_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
   ALERT_WEBHOOK_CHANNEL=slack
   ALERT_MIN_LEVEL=error
   ```

3. Verify the channel is wired:
   ```bash
   curl -X POST "$ALERT_WEBHOOK_URL" \
     -H "Content-Type: application/json" \
     -d '{"text":"[VOLTIUM] Test alert from RUNBOOK §Alerting"}'
   ```
   You should see the message in `#voltium-ops` within a second.

4. On startup, `instrumentation.ts` calls `assertAlerterConfigured()`:
   - If `ALERT_WEBHOOK_URL` is set → logs `[Alerter] Webhook configured` (info)
   - If unset + production → logs `[Alerter] PRODUCTION WARNING: no ALERT_WEBHOOK_URL set` (error)
   - If unset + non-production → logs `[Alerter] No ALERT_WEBHOOK_URL set; running log-only` (warn)

#### Channel setup (Discord — alternative)

For Discord, set `ALERT_WEBHOOK_CHANNEL=discord` and use a Discord
webhook URL (from Server Settings → Integrations → Webhooks). The
alerter formats payloads using Discord's embed format automatically.

#### Channel setup (custom — generic JSON)

For custom integrations (PagerDuty, custom service, etc.), set
`ALERT_WEBHOOK_CHANNEL=generic`. The alerter will POST a flat JSON
payload:

```json
{
  "level": "error",
  "title": "Job failed: wallet.reconciliation",
  "message": "Job evt_abc123 failed after 3 attempts",
  "source": "job-queue:wallet.reconciliation",
  "details": { ... },
  "timestamp": "2026-07-29T10:00:00.000Z"
}
```

#### Alert levels

| Level | Triggers |
|-------|----------|
| `info` | Diagnostic — usually not alerted |
| `warn` | Reaper reclaimed stuck jobs |
| `error` | Job permanently failed (with `notifyOnFail: true`); unhandled route errors |
| `critical` | Reserved for future use; not currently emitted |

Default gate is `error`. To see reaper activity, set `ALERT_MIN_LEVEL=warn`.

### Cron Routes

| Route | Purpose |
|-------|---------|
| `/api/cron/reconciliation` | Wallet reconciliation (idempotent, once/day) |
| `/api/cron/cleanup-telemetry` | Clean telemetry > 30 days |
| `/api/cron/notifications` | Process scheduled notifications |

### Troubleshooting

**Jobs stuck in PROCESSING:** Check worker logs, verify reaper is running (`runReaperLoop`), use `JobQueue.getStuckProcessingCount()`.

**High failure rate:** Check `error` column on OutboxEvent, use `JobQueue.retryFailedJobs(type)`.

**Reconciliation drift:** Query `reconciliationReports` table, check `driftedRiders` in report details.
