# Incident Response Decision Tree

This runbook provides structured decision trees for diagnosing and remediating operational incidents across Voltium services.

---

## 1. Reconciliation Drifted (`wallet.reconciliation_mismatch`)

```
               [ALERT: Reconciliation Drifted]
                              │
              Check Background Worker Queue Lag
                              │
              ┌───────────────┴───────────────┐
         [Lag > 100]                    [Lag Normal]
              │                               │
     Wait for worker sweep            Inspect Rider Drift
   (Re-check in 10 mins)              npm run drift:inspect <riderId>
                                              │
                              ┌───────────────┴───────────────┐
                         [Drift < ₹1]                    [Drift ≥ ₹1]
                              │                               │
                      Auto-Resolve via                Page Finance /
                      Report Inspector              Manual Investigation
                (POST /api/admin/wallet/adjust)     (See RUNBOOK_PAYMENT_FAILURE)
```

### Action Steps
1. **Worker Lag Check**: Check `/admin/background-jobs` to verify if `wallet-reconciliation` job is lagging or outbox worker is backed up.
2. **Drift Inspection**: Run script or inspect rider ledger:
   ```bash
   cd d:/voltium/web
   npx tsx scripts/inspect-rider-drift.ts --riderId <riderId>
   ```
3. **Remediation**:
   - If drift is micro-rounding (< ₹1 / 100 paise), click **Auto-Resolve** in Report Inspector or send adjustment payload:
     `POST /api/admin/wallet/adjust` with `{ riderId, adjustmentPaise: <diff>, reason: "Auto-rounding reconciliation fix" }`
   - If drift ≥ ₹1, follow [`RUNBOOK_PAYMENT_FAILURE.md`](./RUNBOOK_PAYMENT_FAILURE.md).

---

## 2. KYC Verification Stuck

```
                  [ALERT: KYC Processing Delayed]
                                 │
                   Check Document Upload Status
                                 │
                 ┌───────────────┴───────────────┐
         [Upload Failed]                  [Upload OK]
                 │                               │
       Prompt Rider Re-upload            Verify OCR / Selfie Match
                                                 │
                                 ┌───────────────┴───────────────┐
                             [Score ≥ 80%]              [Score < 80%]
                                 │                               │
                         Manual Approval               Reject & Request
                       in KYC Management              Clear Document Photo
```

### Action Steps
1. Go to **Admin Console → KYC Management** (`/admin/kyc-management`).
2. Search rider by ID or phone number.
3. Review document uploads (Aadhaar, PAN, Selfie).
4. If OCR or facial verification is stuck:
   - Click **Approve** if visually clear and matching (audit log event `KYC_MANUALLY_APPROVED` recorded).
   - Click **Reject with Reason** if blurry/unreadable to prompt rider in app.

---

## 3. Rider Cannot See Top-up Balance

```
            [ALERT: Rider Top-up Not Reflected]
                            │
            Check Gateway Webhook Status & Logs
                            │
            ┌───────────────┴───────────────┐
     [Webhook Failed]                [Webhook Succeeded]
            │                               │
   Re-trigger Webhook               Check Wallet Ledger
   / Gateway Sync                   Sync Status
            │                               │
    Verify Ledger Entry             Force Ledger Recalculation
    Created & Balance               POST /api/admin/wallet/recalculate
    Updated
```

### Action Steps
1. Navigate to **Admin → Financials → Transactions**.
2. Lookup gateway transaction ID or rider phone number.
3. Verify if payment gateway status is `SUCCESS` but ledger category `TOP_UP` is missing.
4. If webhook dropped, execute manual ledger credit via `AdjustmentDialog` or re-process gateway webhook event.

---

## 4. Outbox Queue Backed Up

```
             [ALERT: Outbox Queue Lag > 500]
                            │
            Check Worker Process & DB Lock
                            │
            ┌───────────────┴───────────────┐
    [Worker Dead / Crashed]           [Worker Running / High Load]
            │                               │
      Restart Worker                  Increase Batch Processing
    pm2 restart worker                / Scale Worker Processes
            │                               │
   Verify Lag Decreasing             Monitor Queue Processing Rate
```

### Action Steps
1. Check worker logs:
   ```powershell
   pm2 logs voltium-worker --lines 100
   ```
2. If process died, restart worker:
   ```powershell
   pm2 restart voltium-worker
   ```
3. Run outbox health check:
   ```bash
   curl http://localhost:8081/api/health/worker
   ```

---

## 5. Wallet Reconciliation SLA

The reconciliation job
(`web/src/server/workers/jobs/wallet-reconciliation.job.ts`,
PR-148 single-SQL aggregate) is the financial-integrity check
that ensures every wallet's `balanceInPaise` matches the sum
of its `WalletLedger` entries. Drift is a financial bug;
the SLA exists to detect it within an operationally
actionable window.

### 5.1 SLI / SLO

| Metric | Target | Measurement |
| ------ | ------ | ----------- |
| **Daily reconciliation run completion** | Must land within **24h of the prior run's end** (target: 02:00 IST ± 2h window) | `ReconciliationReport.reportDate` vs `clock.now()`. The next day's report must exist by 04:00 IST. |
| **Drift detection** | Any wallet with drift ≥ ₹1 must surface in the next `ReconciliationReport` row | `ReconciliationReport.details.driftedRiders` count + per-rider delta. |
| **Drift resolution** | A drift ≥ ₹1 must be resolved (auto-rounded or manually adjusted) within **4 hours** of detection | `Wallet.adjust` audit-log timestamp vs the report's `createdAt`. The audit log entry's `action: 'WALLET_ADJUST_RECONCILIATION'` is the proof. |
| **Job runtime** | < 15 min for any wallet count up to 100k (PR-148 made it O(1) round-trips) | `ReconciliationReport.durationMs` (if present) or worker log `start - end`. The runtime is informational, not an SLO. |
| **False-negative rate** | 0 — a drift that exists but is not surfaced is a P0 | Any audit-log complaint from finance about a wallet balance not matching the ledger is treated as a missed-detection P0 until proven otherwise. |

### 5.2 Breach response

If the 04:00 IST report is missing:

1. Check the worker's last run via `/admin/background-jobs` (the
   "Wallet reconciliation" row). If it ran but no report was
   written, the job threw — read the worker's stdout for the
   stack trace.
2. If the worker hasn't run, check `pm2 status voltium-worker`
   and the 02:00 IST emitter at
   `web/src/server/workers/index.ts:wallet-reconciliation-emitter`
   (fire-once-per-IST-day guard).
3. If a drift is detected, follow the existing
   §1 tree ("Reconciliation Drifted") above. The
   4-hour resolution clock starts at the report's
   `createdAt`, not at the alert.
4. If the 4-hour resolution SLA is missed, treat as
   SEV-2 (see `RUNBOOK_DPDP_BREACH.md` §7 if the drift
   involves rider-visible balance, otherwise SEV-3
   internal-only).

### 5.3 Why these numbers

- **24h cadence** matches the daily cron + the IST-date
  idempotency key on the job. Anything tighter than 24h
  is double-counting; anything looser leaves rider-balance
  drift visible to support for >1 business day.
- **₹1 threshold** matches the audit's
  `admin-wallet-adjust-caps.test.ts` aggregate checks
  (any non-zero drift is suspicious; paise-only rounding
  is the only acceptable < ₹1 source).
- **4-hour resolution** is the operator's working
  window — short enough that a rider who notices the
  drift gets a same-day answer, long enough that a
  finance team member can verify the ledger before
  authorising the adjustment.

### 5.4 References

- `web/src/server/workers/jobs/wallet-reconciliation.job.ts`
  — the job itself (PR-148 single-SQL aggregate)
- `web/src/server/workers/index.ts:wallet-reconciliation-emitter`
  — the 02:00 IST daily emitter (fire-once-per-IST-day)
- `web/prisma/schema.prisma` — `ReconciliationReport` model
- `docs/RUNBOOK_INCIDENT_RESPONSE.md §1` — the drift
  response tree (unchanged; this section is the SLA
  definition that the tree's action steps imply)
- `docs/RUNBOOK.md:163` — the 15-min runtime estimate
  (informational only; the SLA is on cadence + drift
  detection, not on runtime)
