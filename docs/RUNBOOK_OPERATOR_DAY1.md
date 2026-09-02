# Operator Day-1 Onboarding Runbook

This runbook outlines the required environment setup, health checks, required open dashboards, and operational guidelines for a new Voltium platform operator on Day 1.

---

## 1. Laptop Setup & Provisioning

When a new operator's laptop arrives:

### Prerequisites & Dependencies
- **Node.js**: v20+ / Bun runtime installed
- **Git & Bash / PowerShell environment**
- **SQLite3 / PostgreSQL CLI tools** (as per target database environment)
- **Local repository clone**: `d:/voltium`

### Step-by-step Execution

```bash
# 1. Navigate to project root
cd d:/voltium

# 2. Check secret rotation status & environment security constraints
bash scripts/check-secret-rotation.sh

# 3. Apply database migrations
cd web
npm run db:deploy

# 4. Verify database schema & seed dev/admin credentials if needed
npm run db:seed-dev-admin

# 5. Start dev server and background services
npm run dev
```

Verify local health:
```bash
curl http://localhost:8081/api/health
curl http://localhost:8081/api/health/storage
```

### Post-Migration Verification Checklist
After executing `npm run db:deploy`, perform the following 5 verification steps:
1. **Pre-flight Snapshot**: Ensure a pre-migration snapshot exists (`bash scripts/db-backup.sh backup`).
2. **Database Connectivity**: Verify `curl http://localhost:8081/api/health/db` returns status `200 OK` with `{ status: "ok" }`.
3. **Wallet Balance Recompute Trigger & State Machine Constraints**: Verify `WalletLedger` insertions automatically recompute `walletBalance` and `lifecycleStage` transitions are strictly checked.
4. **Un-migrated Field Backfill Check**: Verify zero records have NULL lifecycle stages:
   ```sql
   SELECT COUNT(*) FROM "Rider" WHERE "lifecycleStage" IS NULL;
   ```
5. **Reconciliation Job Manual Test**: Run wallet reconciliation job via `/admin/background-jobs` -> "Run Now" to verify zero new drift introduced.

---

## 2. Essential Operator Dashboards

Every active operator MUST keep the following 3 admin console views open during their shift:

1. **Background Jobs Console** (`http://localhost:8081/admin/background-jobs`)
   - Monitors status of 11 system worker types (Wallet Reconciliation, Auto-Debit, Device Compliance, Telemetry Cleanup, Notification Dispatch, Daily Engagement, Rent Due Check, Referral Reward, SMS, Audit Log Cleanup, Notification Cleanup). See `RUNBOOK.md` §Background Workers for the full table with cron schedules and concurrency.
   - Visualizes `lastError` callouts for failed jobs and estimated `nextRun` schedules.

2. **Wallet Reconciliation & Report Inspector** (`http://localhost:8081/admin/background-jobs#reconciliation`)
   - Monitors ledger sum vs wallet balance drift across all active riders.
   - Highlights mismatched accounts and allows one-click adjustment or bulk auto-resolution for drifts < ₹1.

3. **Audit Log & Security Feed** (`http://localhost:8081/admin/audit-logs`)
   - Real-time audit trail for administrative actions, auth failures, rate-limit triggers, and manual financial adjustments.

---

## 3. On-Call Rotation & Responsibilities

Voltium operates a primary/secondary on-call rotation:

### Primary Operator
- Responsible for real-time monitoring of webhook events, wallet reconciliation job completion (02:00 IST), and incoming support tickets.
- Must acknowledge Pager/Slack alerts within 15 minutes.

### Secondary On-Call
- Escalation target if Primary fails to acknowledge within 15 minutes.
- Responsible for emergency backup restores and hardware/tunnel diagnostics.

### Shift Handoff Procedure
At shift end:
1. Verify no unresolved `wallet.reconciliation_mismatch` alerts are pending.
2. Confirm the outbox-queue-lag alerter is firing cleanly. The
   automated alerter (workers/jobs/outbox-queue-lag.job.ts) posts
   to the configured Slack/Discord webhook every 5 minutes when
   the unprocessed outbox count (PENDING + PROCESSING) crosses
   `OUTBOX_QUEUE_LAG_ALERT_THRESHOLD` (default 50) or when any
   PROCESSING event is older than 5 minutes (a worker crash
   signal). The alerter replaces the previous manual "confirm
   queue lag is < 50" step; the shift-end check is to confirm
   no alerts are in flight, not to manually count rows.
3. Post shift summary in `#ops-handoff`.

---

## 4. Emergency Contacts & Quick Reference

- **Infra Lead**: On-call Pager / Phone
- **Security Lead**: Security Incident Slack (`#sec-incidents`)
- **Key Runbooks**:
  - Incident Decision Tree: [`RUNBOOK_INCIDENT_RESPONSE.md`](./RUNBOOK_INCIDENT_RESPONSE.md)
  - Wallet & Reconciliation Failures: [`RUNBOOK_PAYMENT_FAILURE.md`](./RUNBOOK_PAYMENT_FAILURE.md)
  - Disaster Recovery: [`DISASTER_RECOVERY.md`](./DISASTER_RECOVERY.md)
  - Cloudflare Tunnel: [`CLOUDFLARE_TUNNEL_HEALTH.md`](./CLOUDFLARE_TUNNEL_HEALTH.md)
