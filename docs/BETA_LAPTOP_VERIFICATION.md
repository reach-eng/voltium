# Beta Laptop Verification (REL-004, REL-006)

This is the runbook for the **public-beta entry** (REL-004) and **public-beta
exit** (REL-006) gates. Run it on the physical beta laptop before the public
beta opens, and again before the public beta closes.

The laptop is the runtime. The team that runs this checklist is the
operator team. The PM/CTO sign off the final go/no-go based on this
checklist's output.

---

## 0. Pre-flight (5 min)

```bash
# Confirm the laptop is the public-beta laptop
hostname
# Should be: voltium-beta-laptop-NN

# Confirm the build
cd /d/voltium
git rev-parse HEAD
git status
# HEAD should be on a tagged release, working tree clean

# Confirm the dev portal is closed
echo "ALLOW_DEV_PII_KEY=${ALLOW_DEV_PII_KEY}"
echo "DATA_MODE=${DATA_MODE}"
echo "STORAGE_PROVIDER=${STORAGE_PROVIDER}"
# All three should be empty/false/local
```

**Pass criteria:** all 3 vars are safe. **Fail = STOP, do not proceed.**

---

## 1. Entry gates (REL-004)

These 6 checks gate the public-beta **entry**. All 6 must pass.

### 1.1 Health check (30 sec)

```bash
curl -fsS http://127.0.0.1:8081/api/health | jq .
curl -fsS http://127.0.0.1:8081/api/health/db | jq .
curl -fsS http://127.0.0.1:8081/api/health/storage | jq .
curl -fsS http://127.0.0.1:8081/api/health/worker | jq .
```

**Pass:** all 4 return `{"status": "healthy"}` (or `{"status": "ok"}` for the
worker one — check the actual contract). **Fail = STOP.**

### 1.2 PM2 status (30 sec)

```bash
pm2 status
pm2 logs --lines 200 --nostream --raw | grep -iE "error|exception" | head -50
```

**Pass:** `voltium-web` and `voltium-worker` both `online`, no recent errors
in the last 200 lines. **Fail = STOP.**

### 1.3 Test coverage (1 min)

```bash
cd web
npm run test:coverage:combined
```

**Pass:** line coverage >= 85% (the same gate CI enforces). **Fail = STOP
or document a waiver in `docs/RELEASE_READINESS_*.md`.**

### 1.4 Backup round-trip (1 min)

```bash
bash scripts/db-backup.sh --test-encrypt
```

**Pass:** script exits 0, prints `[OK] Encryption round-trip test passed.`
**Fail = STOP** — backups are the only off-laptop recovery path.

### 1.5 Rider happy-path E2E (15 min)

Walk through the rider app on a fresh device with a fresh phone number:

- [ ] Splash → legal → permissions (test mode skips, see TEST_MODE dart-define)
- [ ] Phone entry → OTP (use a real phone, not `111111`)
- [ ] KYC flow: upload Aadhaar + selfie, submit
- [ ] Plan selection: pick a plan, complete top-up (use a real ₹100 UPI)
- [ ] Pickup: select a hub, see vehicles, start pickup
- [ ] Active rental: verify dashboard shows live state
- [ ] End rental: complete, verify wallet/ledger entry

**Pass:** all 7 steps complete without manual intervention. **Fail = log
the step that failed, file a P1 ticket, do not proceed.**

### 1.6 Admin happy-path E2E (10 min)

- [ ] Admin login: 2FA, not dev bypass
- [ ] Dashboard: real Prisma counts, not mocks
- [ ] Approve a KYC submission: verify the rider-side state changes to APPROVED
- [ ] Approve a top-up: verify wallet balance reflects immediately
- [ ] Send an announcement: verify the FCM push lands (per batch 4 P0-1 fix)

**Pass:** all 5 steps complete. **Fail = STOP.**

---

## 2. Exit gates (REL-006)

These 6 checks gate the public-beta **exit** (the gate to general
availability). All 6 must pass.

### 2.1 Soak duration (1 min to verify, 1+ week of uptime)

```bash
uptime
```

**Pass:** laptop has been up for at least 7 days without a restart.
**Fail = extend the soak.**

### 2.2 Outbox orphan check (1 min)

```bash
cd web
npx tsx scripts/check-outbox-orphans.ts --days 7 --json | jq .
```

**Pass:** `total < 25` (matches the audit's "10-20 per day" claim from
T-70). **Fail = review orphan-event-consumer.job.ts + worker health.**

### 2.3 PII redaction audit (5 min)

```bash
cd web
npx vitest run tests/unit/audit-log-aadhaar-redaction.test.ts
npx vitest run tests/unit/audit-logs-pii-redaction.test.ts
npx vitest run tests/unit/credentials-roundtrip.test.ts
npx vitest run tests/unit/pii-crypto.test.ts
```

**Pass:** all 4 test files green. **Fail = STOP — PII in audit logs or
credential storage is a DPDP §8(4) violation.**

### 2.4 KYC expiry worker (1 min)

```bash
psql -h 127.0.0.1 -U voltium -d voltium -c "
  SELECT status, COUNT(*) FROM \"kyc_profiles\" GROUP BY status;
"
```

**Pass:** `EXPIRED` count is 0 for the current week (or matches the
expected rolling window of recently-expired profiles). If a profile is
EXPIRED, verify it was expired because `expiresAt < now()`, not because
of a bug. The KYC expiry worker (kyc-expiry.job.ts, batch 20) runs daily
at IST midnight.

**Fail = investigate:** did the worker run? See RUNBOOK_OPERATOR_DAY1.md
for the worker-dispatch health check.

### 2.5 Wallet reconciliation (1 min)

```bash
cd web
npx tsx -e "
import { checkReconciliationToday } from './src/server/workers/jobs/wallet-reconciliation.job';
import { istDateKey } from './src/lib/date-keys';
const today = istDateKey(new Date());
const report = await checkReconciliationToday(today);
console.log(JSON.stringify(report, null, 2));
"
```

**Pass:** today's report exists, has `driftedRiders: 0` (or a small
rounding-only drift). **Fail = follow `RUNBOOK_INCIDENT_RESPONSE.md §1`
(Reconciliation Drifted tree) — the 4-hour resolution SLA from the
SLA doc (RUNBOOK_INCIDENT_RESPONSE.md §5) applies.**

### 2.6 Manual criteria (3 items, no script)

These are the 3 items no script can verify. Run them on the physical
laptop and tick the box.

- [ ] **Laptop-only architecture confirmed** — disconnect from any
      network (airplane mode + unplug Ethernet), confirm all rider
      flows still work end-to-end. This is the laptop-only architecture
      guarantee from `docs/NO_CLOUD_DATA.md`.
- [ ] **PM2 process restarts cleanly** — `pm2 kill voltium-web`, then
      `pm2 start ecosystem.config.js`, then run §1.1 again. The cluster
      mode (`instances: 'max'`) should bring it back in < 30s with no
      manual intervention.
- [ ] **Operator can read the runbooks cold** — have a team member who
      has never run Voltium open `docs/RUNBOOK_INCIDENT_RESPONSE.md`,
      `docs/RUNBOOK_DPDP_BREACH.md`, and `docs/RUNBOOK_OPERATOR_DAY1.md`.
      They should be able to: (a) explain what each runbook covers,
      (b) identify which runbook applies to a wallet-drift alert,
      (c) name the on-call escalation contact. This is the human-readiness
      check.

---

## 3. Sign-off

When all 6 entry gates pass, the public beta can open.

When all 6 exit gates pass, the public beta can close and we can ship
the v1.0 build.

If any gate fails, **do not proceed**. File the failure as a P1 ticket,
fix it, then re-run this checklist.

---

## 4. Where the audit findings are closed

This runbook closes 2 audit items the 24-batch run could not verify
without the beta laptop:

- **REL-004 (P0, public beta entry gates)**: the 6 entry gates in §1
  above are the actual verification surface. Run them on the laptop,
  sign off, and the gate is closed.
- **REL-006 (P0, public beta exit criteria)**: the 6 exit gates in §2
  above are the actual verification surface. Run them, sign off, and
  the gate is closed.

This runbook is the **ops procedure** the audit pre-verification
column ("out of scope — needs beta laptop") was waiting for. The
audit didn't have the laptop; the team running this checklist does.
