# Payment Failure & Wallet Reconciliation Runbook

This runbook provides step-by-step diagnostic and remediation instructions for wallet reconciliation drift, failed top-ups, and auto-debit discrepancies.

---

## 1. Overview & Triggers

### Trigger Conditions
- **Cron Alert**: `wallet-reconciliation` job detects `drift != 0` during 02:00 IST daily sweep.
- **Audit Alert**: Event `wallet.reconciliation_mismatch` logged in `/admin/audit-logs`.
- **Rider Escalation**: Rider reports payment debited from bank/UPI but missing from Voltium wallet.

---

## 2. Diagnostic Workflow

### Step 1: Locate Mismatched Rider Account
1. Open **Admin Console → Background Jobs → Report Inspector** (`http://localhost:8081/admin/background-jobs#reconciliation`).
2. Identify riders listed in the **Mismatched Accounts** list.
3. Note down:
   - `Rider ID`
   - `Current Wallet Balance (paise)`
   - `Ledger Sum (paise)`
   - `Drift Amount (paise)`

### Step 2: Run Detailed Drift Inspection Script
From the laptop terminal:
```bash
cd d:/voltium/web
npx tsx scripts/inspect-rider-drift.ts --riderId <RIDER_ID>
```

Sample output:
```
--- RIDER DRIFT REPORT ---
Rider ID: rdr_987654321
Stored Wallet Balance : ₹ 1,500.00 (150000 paise)
Calculated Ledger Sum : ₹ 1,498.50 (149850 paise)
Drift                 : +₹ 1.50 (+150 paise)
Last 5 Ledger Entries:
  1. 2026-08-04 14:00 - TOP_UP: +₹ 1,000.00
  2. 2026-08-04 18:30 - RENTAL_DEBIT: -₹ 250.00
  3. 2026-08-04 22:15 - ADMIN_ADJUSTMENT: -₹ 250.00
```

---

## 3. Remediation Actions

### Option A: Small Rounding Drift (< ₹1 / 100 paise)
For small micro-rounding discrepancies caused by tax calculations or legacy interest rates:

1. In **Report Inspector**, click **Apply Adjustment** next to the rider.
2. Select **Auto-Balance** (system will compute exact delta and post category `ADMIN_ADJUSTMENT`).
3. Alternatively, click **Auto-Resolve All < ₹1** for batch resolution across all affected accounts.

### Option B: Payment Gateway Discrepancy (Missing Top-Up Credit)
When gateway shows `SUCCESS` but ledger entry is missing:

1. Confirm transaction ID in payment gateway dashboard.
2. Open **Admin → Background Jobs → Manual Adjustment Dialog** (`AdjustmentDialog`).
3. Fill details:
   - **Rider ID**: `rdr_xxx`
   - **Adjustment Amount (paise)**: `+100000` (for ₹1,000)
   - **Category**: `TOP_UP_MANUAL_RECOVERY`
   - **Reason / Reference**: `Gateway Txn ID: pay_Gk98x12345`
4. Click **Submit Adjustment**.
5. System executes database transaction:
   - Creates `WalletLedger` record
   - Atomically updates `rider.walletBalance`
   - Emits audit log `ADMIN_WALLET_ADJUSTMENT_EXECUTED`

### Option C: Duplicate Debit Recovery
When auto-debit executed twice for a single rental period:

1. Calculate duplicate debit amount.
2. Execute refund adjustment:
   ```bash
   curl -X POST http://localhost:8081/api/admin/wallet/adjust \
     -H "Content-Type: application/json" \
     -H "Cookie: admin_session=<SESSION_TOKEN>" \
     -d '{
       "riderId": "rdr_xxx",
       "adjustmentPaise": 25000,
       "reason": "Duplicate auto-debit reversal for rental rnt_123"
     }'
   ```

---

## 4. Verification & Sign-off

After performing any adjustment:

1. Re-run drift inspection:
   ```bash
   npx tsx scripts/inspect-rider-drift.ts --riderId <RIDER_ID>
   ```
2. Verify:
   - `Drift = ₹ 0.00`
   - `Stored Wallet Balance == Calculated Ledger Sum`
3. Check `/admin/audit-logs` to confirm audit trail event is recorded.
4. Notify rider via in-app notification if applicable.
