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
