# Voltium — Database Remediation Plan

**Date:** 2026-07-29
**Source:** `docs/AUDIT_DATABASE.md` (60+ findings, ~62 KB)
**Scope:** `web/prisma/**` (schema, migrations, seed scripts, helper scripts) + `web/src/lib/db.ts`
**Total findings:** 67 (37 P0, 27 P1, 8 P2; ~3 already-done in prior remediation)
**Total estimated effort:** ~13 focused days across 10 PRs

> **Read this first.** This plan takes the raw audit findings and turns them into a sequence of review-ready PRs. Each PR is small enough to review in one sitting, with explicit acceptance criteria and a rollback plan.
>
> **Pre-req for this work:** Phase 0–6 of `SCOPE.md` is shipped. Most schema-extraction work (Rider child tables, FK CASCADE, settings registry) is already done in Phase 2. This plan covers the **DB-only P0s** that Phase 1–6 didn't reach.

---

## What's already done (from Phase 0–6)

| Audit ref | Item | Where it was fixed |
|---|---|---|
| 2.1 (partial) | `Rider` decomposition — `RiderPermission` + `RiderAdminLock` + `RiderPickupLocation`/`RiderPickupPhoto` extracted | Phase 2, migrations `20260728000000_extract_rider_permissions` + `20260728000001_extract_rider_admin_lock_and_pickup` |
| 4.1 (partial) | FK `onDelete: Cascade` on 1:1 child tables | Phase 2 |
| 6.1 (env gate) | `pii-crypto.ts` throws in production; `loadKeyVersions` guards `APP_ENV === 'production'` | Phase 1 |
| 6.1 (env gate) | OTP dev short-circuits in `otp-store.ts` tightened | Phase 1 |
| 10.x (env guard) | `seed.ts` `admin123` — confirmed this was already flagged and worked on in earlier remediation | Phase 0/1 |
| 6.x (auth) | `x-rider-id` impersonation env-gated | Phase 1 |

**Net for this plan:** ~37 P0 items still to ship (audit called out 37 P0s; ~6 are already done). The remaining work is mostly **CHECK constraints**, **helper script fixes**, and **schema-cleanup P1s**.

---

## Total scope

| Severity | Audit count | Already done (Phase 0–6) | Remaining in this plan | Total effort |
|---|---|---|---|---|
| P0 | 37 | ~6 | **31** | ~9 days |
| P1 | 27 | 0 | 27 | ~3.5 days |
| P2 | 8 | 0 | 8 | ~0.5 day |
| **Total** | **67** | **6** | **~61** | **~13 days** |

Two months ≈ 18–20 working days per contributor. **All P0s are shippable inside the runway** if started now.

---

## Sequencing principle

Each PR is **independently deployable**. None of them depend on a future PR. The order is by **risk (lowest first) so we can ship the easy wins while the harder ones cook**.

**Highest-risk PRs** (review carefully, soak 1 week in staging):
- PR-3: Schema-drift reconciliation (DB column rename)
- PR-4: `Rider.lockPassword` → `lockPasswordHash` (data migration)
- PR-5: PII encryption verification + any column changes

**Lowest-risk PRs** (script fixes, env guards):
- PR-1: Fix `reset_rahil.ts` (rewrite a broken script)
- PR-2: Fix `seed-audit.ts` (change enum strings)

---

# The plan: 10 PRs

## PR-1 — Fix `reset_rahil.ts` (broken dev script)

**Effort:** 1 hour
**Risk:** zero (script-only, not in CI, not called by app)
**Audit ref:** 9.1
**Blocks:** dev velocity (no one can reset a rider's state right now)

### Problem

`web/prisma/reset_rahil.ts` references 7 ghost fields that don't exist in the current schema:
- `accountStatus` (was renamed to `lifecycleStatus`)
- `state` (was removed; state is in `lifecycleStatus`)
- `registrationDone`, `kycDone`, `depositDone`, `planDone`, `pickupDone` (all were renamed to `*DoneAt` timestamps)
- Plus a non-FK `currentPlan: null` (line 26)

Running the script fails with a Prisma validation error. **A developer trying to reset a rider's state in dev has no working tool.**

### Current state (broken)

```ts
// web/prisma/reset_rahil.ts:14-32
data: {
  accountStatus: 'PRE_ACTIVE',     // ghost
  state: 'PRE_ACTIVE',              // ghost
  registrationDone: true,           // ghost
  kycDone: false,                   // ghost
  depositDone: false,               // ghost
  planDone: false,                  // ghost
  pickupDone: false,                // ghost
  vehicleId: null,
  assignedVehicle: null,
  currentPlan: null,
  pickedUpAt: null,
  depositDoneAt: null,
  kycDoneAt: null,
  planDoneAt: null,
}
```

### Fix

Rewrite the data block to use current schema fields:

```ts
// web/prisma/reset_rahil.ts (rewritten)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Defense-in-depth: refuse to run on production data
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_RESET !== 'true') {
  console.error('Refusing to run reset_rahil.ts in production. Set ALLOW_DEV_RESET=true to override.');
  process.exit(1);
}

async function main() {
  const rahil = await prisma.rider.findUnique({
    where: { phone: '9999999991' },
  });

  if (!rahil) {
    console.error('Rider RAHIL not found');
    return;
  }

  await prisma.rider.update({
    where: { id: rahil.id },
    data: {
      lifecycleStatus: 'PROFILE_SUBMITTED', // single source of truth
      vehicleId: null,
      assignedVehicle: null,
      currentPlan: null,
      pickedUpAt: null,
      depositDoneAt: null,
      kycDoneAt: null,
      planDoneAt: null,
      registrationDoneAt: null,
    },
  });

  console.log('Successfully reset RAHIL to PROFILE_SUBMITTED state!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Acceptance criteria

- [ ] `npx tsx web/prisma/reset_rahil.ts` runs without Prisma validation error
- [ ] Script refuses to run when `NODE_ENV === 'production'` and `ALLOW_DEV_RESET` is not `'true'`
- [ ] `git grep "accountStatus\|state:\|registrationDone\b\|kycDone\b\|depositDone\b\|planDone\b\|pickupDone\b" web/prisma/reset_rahil.ts` returns no results
- [ ] The 7 ghost fields are no longer in the file

### Reviewer focus

- Did the rewrite use the right `lifecycleStatus` enum value? (current is `PROFILE_SUBMITTED`, but check if the dev team's workflow needs a different one — ask if unclear)
- Is the `ALLOW_DEV_RESET` env var the right name? (vs. `RESET_RAHIL_ALLOW_PROD`)

### Rollback

Revert the commit. The file is not used by the app or CI.

---

## PR-2 — Fix `seed-audit.ts` (broken seed script)

**Effort:** 30 min
**Risk:** zero (script-only)
**Audit ref:** 10.5, 10.6, 10.7, 10.8
**Blocks:** dev audit log seeding

### Problem

`web/prisma/seed-audit.ts` has two bugs that will fail at runtime:
1. **Lowercase enum values** (lines 15, 52): `actorType: 'admin'` and `actorType: 'system'` — but the `ActorType` enum is `ADMIN` / `SYSTEM` / `RIDER` (uppercase).
2. **Dot-separated action names** (lines 34, 41, 48, 56): `'rider.suspend'`, `'kyc.approve'`, `'system.rate_limit_reset'`, `'rider.bulk_update_status'` — but `AuditActionType` enum is `LOGIN, LOGOUT, CREATE, UPDATE, DELETE, APPROVE, REJECT, REFUND, VIEW, EXPORT, PERMISSION_CHANGE, ROLE_CHANGE, SYSTEM_CONFIG, SYSTEM_JOB` (no dot, no namespace).
3. **Split seeds** (audit 10.7): the file is separate from `seed.ts` and not in any `package.json` script. Maintenance burden.

### Fix

```ts
// web/prisma/seed-audit.ts (rewritten)
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function createAuditLog(params: {
  actorId: string;
  actorType?: 'ADMIN' | 'SYSTEM' | 'RIDER';  // typed
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'LOGOUT' | 'VIEW' | 'EXPORT' | 'PERMISSION_CHANGE' | 'ROLE_CHANGE' | 'SYSTEM_CONFIG' | 'SYSTEM_JOB' | 'REFUND';
  entity: string;
  entityId?: string;
  details?: string | Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      actorId: params.actorId,
      actorType: params.actorType || 'ADMIN',  // uppercase
      action: params.action,                    // enum, not dot-string
      entity: params.entity,
      entityId: params.entityId || null,
      details:
        typeof params.details === 'string'
          ? params.details
          : params.details
            ? JSON.stringify(params.details)
            : null,
    },
  });
}

async function main() {
  console.log('Seeding audit logs...');

  const logs = [
    {
      action: 'UPDATE',          // was 'rider.suspend' — closest match
      entity: 'rider',
      entityId: 'VF-RD-004',
      actorId: 'admin_001',
      details: { reason: 'Policy violation', op: 'suspend' },
    },
    {
      action: 'APPROVE',         // was 'kyc.approve'
      entity: 'rider',
      entityId: 'VF-RD-006',
      actorId: 'admin_002',
      details: { document: 'Aadhaar' },
    },
    {
      action: 'SYSTEM_JOB',      // was 'system.rate_limit_reset'
      entity: 'security',
      entityId: 'system',
      actorId: 'system',
      actorType: 'SYSTEM',       // uppercase
      details: { ip: '127.0.0.1', op: 'rate_limit_reset' },
    },
    {
      action: 'UPDATE',          // was 'rider.bulk_update_status'
      entity: 'rider',
      entityId: 'multiple',
      actorId: 'admin_001',
      details: { count: 12, status: 'ACTIVE', op: 'bulk_update_status' },
    },
  ];

  for (const log of logs) {
    await createAuditLog(log);
  }

  console.log('Done!');
}

main()
  .catch((e) => console.error(e))
  .finally(() => db.$disconnect());
```

### Optional: move to `scripts/`

Per audit 10.7, `seed-audit.ts` is a one-off seed that doesn't belong in `prisma/`. Recommend moving to `scripts/seed-audit.ts` and adding to `package.json`:
```json
"db:seed:audit": "tsx scripts/seed-audit.ts"
```

### Acceptance criteria

- [ ] `npx tsx web/prisma/seed-audit.ts` (or `npm run db:seed:audit` if moved) runs without enum error
- [ ] No lowercase enum values remain in the file
- [ ] No dot-separated action names remain in the file
- [ ] The 4 audit-log records are created with the closest valid `AuditActionType` enum value

### Reviewer focus

- Is `UPDATE` the right enum for "rider.suspend" and "rider.bulk_update_status"? Or should we propose adding `SUSPEND` and `BULK_UPDATE` to the enum? (defer the new enum values to a follow-up if the team wants them)
- Is the move to `scripts/` worth it for a one-off seed?

### Rollback

Revert the commit.

---

## PR-3 — Reconcile `add_payment_gateways` migration with `schema.prisma` (schema/migration drift)

**Effort:** 2 hours
**Risk:** **medium** (DB column rename; needs staging soak)
**Audit ref:** 8.1, 8.2, 8.3
**Blocks:** any code path that reads/writes `PaymentGateway.keyId`/`keySecret`

### Problem

The `add_payment_gateways` migration (`web/prisma/migrations/20260726000000_add_payment_gateways/migration.sql`) created the table with columns `apiKey` and `apiSecret`. The current `schema.prisma:1540-1541` declares the columns as `keyId` and `keySecret`. **Schema and migration disagree.**

Consequences:
- `prisma migrate dev` would try to add the missing columns or rename them
- Production DB has `apiKey`/`apiSecret`; the generated Prisma client expects `keyId`/`keySecret`
- Any read/write against the `PaymentGateway` model will fail at runtime

Also: the migration is missing the `provider` column (schema line 1469) and the `createdAt` column (schema line 1479).

### Fix

Two options — pick **option A** (preferred, less invasive).

**Option A: Update the migration to match the schema** (rewind + replay)

Since the migration is recent (2026-07-26) and presumably only applied to a few dev environments, the cleanest fix is to **edit the existing migration in place** so the columns match the schema:

```sql
-- web/prisma/migrations/20260726000000_add_payment_gateways/migration.sql (updated)
-- CreateEnum
CREATE TYPE "MdrBearer" AS ENUM ('RIDER', 'MERCHANT');

-- CreateTable
CREATE TABLE "payment_gateways" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,           -- ADDED
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "keyId" TEXT,                        -- RENAMED from apiKey
    "keySecret" TEXT,                    -- RENAMED from apiSecret
    "merchantId" TEXT,
    "webhookSecret" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'TEST',
    "extraFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "mdrBearer" "MdrBearer" NOT NULL DEFAULT 'RIDER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- ADDED
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_gateways_pkey" PRIMARY KEY ("id")
);
```

**For environments that already applied the broken migration**, add a follow-up migration:

```sql
-- web/prisma/migrations/20260729120000_fix_payment_gateway_columns/migration.sql (new)
-- Rename apiKey → keyId
ALTER TABLE "payment_gateways" RENAME COLUMN "apiKey" TO "keyId";
-- Rename apiSecret → keySecret
ALTER TABLE "payment_gateways" RENAME COLUMN "apiSecret" TO "keySecret";
-- Add missing columns
ALTER TABLE "payment_gateways" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'razorpay';
ALTER TABLE "payment_gateways" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
```

**Option B: Update the schema to match the migration**

If the migration is correct and the schema is wrong, flip:
```prisma
// schema.prisma
apiKey       String?
apiSecret    String?
```
…and drop the `provider`/`createdAt` additions. **Not recommended** — the schema is more recent and likely correct.

### Decision

**Option A** (update the migration in place + add a follow-up migration for existing environments). The schema is the source of truth.

### Acceptance criteria

- [ ] `prisma migrate dev` succeeds (no schema/migration drift)
- [ ] `prisma generate` produces a client with `keyId`/`keySecret`/`provider`/`createdAt` fields
- [ ] A test insert/select against `PaymentGateway` works end-to-end
- [ ] The `add_payment_gateways` migration file matches the schema columns
- [ ] The follow-up migration (if needed) is idempotent (safe to re-run)
- [ ] Staging has been soaked for 1 week with the follow-up migration applied

### Reviewer focus

- Are `keyId`/`keySecret` definitely the canonical names? (Check `web/src/lib/env.ts` and any code that reads these columns.)
- Is the default value for `provider` (`'razorpay'`) correct? (vs. NULL with a use-case-level default)
- Is renaming the column safe? (Postgres `ALTER TABLE ... RENAME COLUMN` is metadata-only, no data loss)

### Rollback

If a follow-up migration is needed, rolling back requires a new migration to rename the columns back. **Coordinate with the dev team before rolling back staging.**

---

## PR-4 — `Rider.lockPassword` → `lockPasswordHash` (verify hashing + rename)

**Effort:** 1.5 hours
**Risk:** **medium** (touches auth code path; needs careful migration)
**Audit ref:** 2.2, 11.3

### Problem

`Rider.lockPassword` is `String?` in the schema (line 177). The audit asks: **is the lock password hashed before storage?** If `riderUseCases.setLockPassword` writes the plaintext, a DB leak = every rider's lock screen PIN in plaintext.

**Step 1: verify the use-case.** Read `web/src/server/modules/riders/*.use-cases.ts` and grep for `lockPassword`. If `hashPassword()` is called before the write, we're fine — just rename for clarity. If not, this is a **P0 PII leak** and the fix is larger.

**Step 2: rename for clarity.** Even if the current code is correct, the field name `lockPassword` is ambiguous (could be plaintext or hashed). Rename to `lockPasswordHash` to make the intent obvious.

### Fix (assumes the use-case IS hashing — verify first)

**Migration:**
```sql
-- web/prisma/migrations/20260729130000_rename_lock_password/migration.sql
ALTER TABLE "Rider" RENAME COLUMN "lockPassword" TO "lockPasswordHash";
```

**Schema:**
```prisma
// schema.prisma
lockPasswordHash  String?
```

**Update all read/write paths** — grep for `lockPassword` across the codebase:
- `web/src/server/modules/riders/*.use-cases.ts`
- `web/src/app/api/admin/riders/*/route.ts` (if any)
- `web/src/lib/types/admin.ts` (TypeScript interface)
- `flutter/lib/**` (rider app reads the lock screen — check if `RiderModel` references `lockPassword`)

### Fix (if the use-case is NOT hashing)

If `setLockPassword` writes plaintext, this is a real P0. The fix:

1. Add a `hashPassword()` call in `setLockPassword` (use the same `bcrypt`/`argon2` helper that `seed.ts:11` uses)
2. Add a one-time data migration that hashes any existing plaintext values (use a SQL `CASE WHEN lockPassword NOT LIKE 'pbkdf2$%'` to detect unhashed values; for unhashed values, re-hash via a script)
3. Rename the column as above

**Both fixes are in the same PR.** The PR is "small enough to review in one sitting" if and only if the team is confident the use-case is hashing; otherwise it's 2 PRs.

### Acceptance criteria

- [ ] `grep -r "lockPassword" web/src/ web/prisma/schema.prisma` returns `lockPasswordHash` only
- [ ] `grep -r "lockPassword" flutter/lib/` returns 0 results (or only `lockPasswordHash` if renamed in Dart too)
- [ ] `prisma migrate dev` succeeds
- [ ] A unit test verifies that `setLockPassword('1234')` writes a hash (not `'1234'`) to the DB
- [ ] Staging soak: 1 week minimum before production

### Reviewer focus

- Did the verification step confirm the use-case is hashing? (If uncertain, escalate to the dev team lead.)
- Is the data migration (if needed) safe for a populated DB? (Bcrypt is slow — running it on 100k rows could take hours.)
- Does the Flutter app need a corresponding change?

### Rollback

Revert the migration (rename back to `lockPassword`). **Coordinate with the dev team before rolling back staging.**

---

## PR-5 — PII encryption verification (KYC use-cases)

**Effort:** 0.5–2 days depending on findings
**Risk:** **medium-high** (P0 if KYC writes are plaintext; schema changes may be needed)
**Audit ref:** 2.4, 2.5, 11.1

### Problem

`KycProfile.aadhaarNumber`, `panNumber`, `accountNumber`, `ifscCode` are `String?` (schema lines 273-278). The PII crypto layer exists in `web/src/lib/pii-crypto.ts` (and the Phase 1 hardening added a prod-env guard). **But the audit didn't verify the write path actually calls `pii-crypto.encrypt()` before storing.**

### Step 1: Audit the use-cases

Read these files and check every write to KYC PII fields:
- `web/src/server/modules/riders/kyc/*.use-cases.ts`
- `web/src/server/modules/admin/kyc/*.use-cases.ts` (if it exists)

Look for patterns like:
```ts
db.kycProfile.update({
  data: { aadhaarNumber: input.aadhaarNumber }  // ❌ plaintext
})
```

vs the correct:
```ts
db.kycProfile.update({
  data: { aadhaarNumber: encrypt(input.aadhaarNumber) }  // ✅ encrypted
})
```

### Step 2: Fix any plaintext writes

For each plaintext write found, wrap with `encrypt()`:
```ts
import { piiEncrypt } from '@/lib/pii-crypto';
// ...
data: { aadhaarNumber: piiEncrypt(input.aadhaarNumber) }
```

For each read, wrap with `decrypt()`:
```ts
import { piiDecrypt } from '@/lib/pii-crypto';
// ...
const aadhaar = piiDecrypt(profile.aadhaarNumber);
```

### Step 3: One-time data migration

If the DB has plaintext PII values already, add a migration script that:
1. Reads all `KycProfile` rows
2. Encrypts the PII fields
3. Writes them back

**This is slow** (10k rows × ~5ms each = ~50 seconds). Schedule for a maintenance window.

### Acceptance criteria

- [ ] All KYC write paths encrypt PII fields (verified by grep)
- [ ] All KYC read paths decrypt PII fields
- [ ] A unit test verifies that `setKycProfile` writes encrypted values
- [ ] The data migration script is committed but not yet run in production
- [ ] Staging has been soaked with the migration applied and KYC write/read works end-to-end

### Reviewer focus

- Are we confident the audit found every write path? (Search the entire `web/src` for `aadhaarNumber`, `panNumber`, `accountNumber`, `ifscCode` — any occurrence in a write context is a candidate.)
- Is the PII crypto library's key rotation story understood? (If we re-encrypt with a new key, do we need a multi-version read path?)

### Rollback

Revert the schema changes. **Coordinate with the dev team before rolling back staging** — KYC data will be in a transitional state during the migration.

---

## PR-6 — Remove `DATABASE_OFFLINE` mock fallback from `db.ts` (the big one)

**Effort:** 0.5 day
**Risk:** **medium** (laptop-mode devs depend on it; coordinate before removing)
**Audit ref:** 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8

### Problem

`web/src/lib/db.ts` has a 150-line mock fallback that activates when `DATABASE_OFFLINE=true`. The audit's concern: **if `DATABASE_OFFLINE` is ever set in production, an attacker who knows the hardcoded test phone numbers (lines 38-49: `9999900001`, `9876543210`, etc.) can log in as a mock rider with mock wallet (₹1,000 balance, ₹5,000 deposit) and mock KYC/Guarantor (both auto-approved).**

Even with the env.ts guard, the `db.ts` extension reads `process.env.DATABASE_OFFLINE` directly (not through the validated `env` object) — a misconfigured env file can re-enable the mock in production.

### Fix

Three changes, all in `web/src/lib/db.ts`:

1. **Read `DATABASE_OFFLINE` from `env`, not `process.env`.** This is a one-line change in each check.

2. **Remove the hardcoded mock data.** Delete `EXISTING_PHONES`, the mock `Rider`/`Wallet`/`KycProfile`/`Guarantor` return values, and the mock `create`/`update` shortcuts. Replace with a hard-fail:
   ```ts
   if (isDbOffline) {
     throw new Error(
       '[db] Database is offline (DATABASE_OFFLINE=true). ' +
       'In laptop mode, start the local Postgres. ' +
       'In any other mode, this is a production architecture violation.'
     );
   }
   ```

3. **Add an alert on offline transition.** Per the Phase 7 work, the alerter is now in place. Wire `isDbOffline = true` to fire a Slack alert.

### What stays

- The auto-recovery timer (lines 12-34) — useful for laptop mode where the DB restarts
- The dynamic pool config (lines 159-194) — unrelated, keep
- The soft-delete extension (lines 247-338) — unrelated, keep
- The `isDbOffline` flag itself — keep, but make it read-only and from `env`

### Acceptance criteria

- [ ] `web/src/lib/db.ts` no longer returns mock `Rider`/`Wallet`/`KycProfile`/`Guarantor` for hardcoded phone numbers
- [ ] All `process.env.DATABASE_OFFLINE` references replaced with `env.DATABASE_OFFLINE`
- [ ] When `DATABASE_OFFLINE=true`, every DB operation throws (no mock data)
- [ ] Slack alert fires when the offline transition occurs (verify in staging)
- [ ] Auto-recovery still works for laptop-mode dev
- [ ] A regression test verifies that the mock data is gone: `grep -r "9999900001" web/src/lib/db.ts` returns 0 results

### Reviewer focus

- Is the laptop-mode dev experience preserved? (Laptop mode has the DB on `localhost`; the mock fallback was a "DB is down" recovery, not a "no DB" workaround.)
- Does the alert channel exist in staging? (Per Phase 7 Q3, `ALERT_WEBHOOK_URL` is documented; if staging doesn't have one, the alert will log-only.)

### Rollback

Revert the commit. The mock fallback is dev-only; restoring it does not affect production.

---

## PR-7 — Rename `Int` money columns to `*InPaise` (unit consistency)

**Effort:** 3 hours
**Risk:** **medium** (touches every money-reading code path; needs careful migration)
**Audit ref:** 2.14, 12.2, 12.4, 12.5, 12.6, 12.7, 12.10

### Problem

The wallet uses `balanceInPaise` (Int, paise). The transaction uses `amount` (Int, unit unspecified). The plan uses `price` (Int, unit unspecified). A `db.transaction.create({ data: { amount: 1000 } })` could mean ₹1000 or ₹10. **Massive footgun for money.**

The audit identifies 8 columns to rename:

| Current name | New name | Current unit (assumed) | Confirmed? |
|---|---|---|---|
| `Transaction.amount` | `Transaction.amountInPaise` | paise (matches `Wallet.balanceInPaise`) | verify |
| `TransactionBreakdown.amount` | `TransactionBreakdown.amountInPaise` | paise | verify |
| `RentalLease.basePrice` | `RentalLease.basePriceInPaise` | paise (per code comments) | verify |
| `RentalLease.finalPrice` | `RentalLease.finalPriceInPaise` | paise | verify |
| `RentalPlan.price` | `RentalPlan.priceInPaise` | rupees (per comment) — **PROBLEM** | verify |
| `RentalPlan.securityDeposit` | `RentalPlan.securityDepositInPaise` | paise | verify |
| `Coupon.discountValue` | `Coupon.discountValueInPaise` | paise (only for `FIXED` type) | verify |
| `Wallet.securityDeposit` | `Wallet.securityDepositInPaise` | paise | verify |

### Step 1: Verify units

Before any migration, **read every use-case that writes these columns** and confirm the actual unit. The audit's assumption is "paise everywhere except `RentalPlan.price`" — but this needs validation. The risk of a wrong unit is a 100x money error.

### Step 2: Rename via migrations

For each verified column, add a migration:
```sql
-- web/prisma/migrations/20260729140000_rename_transaction_amount/migration.sql
ALTER TABLE "Transaction" RENAME COLUMN "amount" TO "amountInPaise";
-- (similar for each column)
```

### Step 3: Update all read/write paths

Grep for each old name across the codebase and rename:
- `web/src/server/modules/**/*.ts`
- `web/src/lib/**/*.ts`
- `web/src/app/api/**/route.ts`
- `web/src/lib/types/admin.ts`

This is a mechanical rename. Use `sed` or `ts-morph` if the project supports it.

### Step 4: Add a TS compile-time check

Add a comment in `web/src/lib/money.ts` (new file or existing):
```ts
// Every money field in the Prisma schema MUST end with `InPaise`.
// If you're adding a new money field, name it `xxxInPaise`.
// Use `paiseToRupees()` and `rupeesToPaise()` for unit conversion at the API boundary.
export function paiseToRupees(paise: number): number {
  return paise / 100;
}
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
```

### Acceptance criteria

- [ ] All 8 columns are renamed in the schema
- [ ] All migrations applied successfully in staging
- [ ] `grep -r "\.amount\b\|\.basePrice\b\|\.finalPrice\b\|\.price\b\|\.securityDeposit\b\|\.discountValue\b" web/src/` returns no false positives (e.g. `Rider.assignedVehicle` is fine, `RiderEarning.amount` is a different column)
- [ ] Unit tests verify the conversion helpers
- [ ] Money-path end-to-end test (top-up → wallet balance → transaction) works with the new names
- [ ] Staging soak: 1 week minimum

### Reviewer focus

- **Critical:** did the unit verification step confirm the assumption? (If `RentalPlan.price` is in rupees not paise, the rename is destructive — values would silently become 100x larger or smaller.)
- Is the migration additive? (Add `*InPaise` columns, backfill, then drop old columns. Don't just rename — that's a breaking change for any environment that already has the DB.)
- Is the conversion helper exported from a single place? (Don't sprinkle `* 100` across the codebase.)

### Rollback

Revert the migration (rename back). **Coordinate with the dev team before rolling back staging** — the rename is data-reshaping.

---

## PR-8 — Convert `Float` money columns to `Int` paise

**Effort:** 2 hours
**Risk:** **medium** (same as PR-7, plus float-to-int conversion)
**Audit ref:** 2.32, 2.33, 12.8, 12.9

### Problem

`RiderEarning.amount` and `TrafficFine.amount` are `Float`. Float for money is a footgun: `0.1 + 0.2 !== 0.3`. A use-case that does `amount: riderEarning.amount + trafficFine.amount` will drift.

### Fix

**Migration:**
```sql
-- web/prisma/migrations/20260729150000_float_to_paise/migration.sql
-- RiderEarning
ALTER TABLE "RiderEarning" ADD COLUMN "amountInPaise" INTEGER;
UPDATE "RiderEarning" SET "amountInPaise" = ROUND("amount" * 100)::INTEGER;
ALTER TABLE "RiderEarning" ALTER COLUMN "amountInPaise" SET NOT NULL;
ALTER TABLE "RiderEarning" DROP COLUMN "amount";
ALTER TABLE "RiderEarning" RENAME COLUMN "amountInPaise" TO "amountInPaise";
```

(Same for `TrafficFine`.)

**Schema:**
```prisma
// schema.prisma
model RiderEarning {
  // ...
  amountInPaise  Int  // was Float
  // ...
}

model TrafficFine {
  // ...
  amountInPaise  Int  // was Float
  // ...
}
```

**Update all read/write paths** — same as PR-7.

### Acceptance criteria

- [ ] Both columns renamed and converted
- [ ] All use-cases updated
- [ ] Unit tests verify the conversion
- [ ] Staging soak: 1 week

### Reviewer focus

- Is the conversion `* 100` correct? (Rupees × 100 = paise; confirm by reading the use-cases.)
- Is there any code that relies on `Float` semantics (e.g. `Math.floor` to get integer rupees)?

### Rollback

Revert the migration. **Coordinate with the dev team before rolling back staging.**

---

## PR-9 — `Rider` decomposition (the remaining 4 child tables)

**Effort:** 1 day
**Risk:** **medium** (table extraction; expand-and-contract pattern)
**Audit ref:** 2.1 (residual)

### Problem

Phase 2 extracted `RiderPermission` and `RiderAdminLock`/`RiderPickupLocation`/`RiderPickupPhoto` from the `Rider` model. The audit's full list of 5 child tables includes 4 more:

| Child table | Columns to extract | Status |
|---|---|---|
| `RiderPermission` | 8 permission booleans | ✅ done in Phase 2 |
| `RiderAdminLock` | lock state fields | ✅ done in Phase 2 |
| `RiderPickupLocation` / `RiderPickupPhoto` | pickup photos | ✅ done in Phase 2 |
| `RiderPickupPhotos` | 5 pickup photo URLs | ⏳ partially done — need to verify |
| `RiderDevice` | FCM token, lock password, device admin flags | ⏳ **TODO** |
| `RiderLocation` | lastKnownLat, lastKnownLng, lastLocationAt | ⏳ **TODO** |
| `RiderOnboarding` | pickupHub, currentPlan, planStartDate, planEndDate, advanceRentPaid, preferredShift, teamLeader, emergencyContact | ⏳ **TODO** |

### Step 1: Verify what's left

Read `web/prisma/schema.prisma` (the `Rider` model lines 136-228) and check which of the 5 child tables from the audit are still embedded. Report what's done vs. what remains.

### Step 2: Extract remaining tables

Use the same expand-and-contract pattern from Phase 2:
1. Add new child table with FK to `Rider`
2. Backfill from `Rider` columns
3. Update use-cases to read/write from child table
4. Drop `Rider` columns

### Acceptance criteria

- [ ] `Rider` model has fewer than 50 columns (down from 90+)
- [ ] All 5 child tables exist with proper FK + `onDelete: Cascade`
- [ ] All use-cases updated
- [ ] Migrations are backward-compatible
- [ ] Staging soak: 1 week

### Reviewer focus

- Same as Phase 2 — the expand-and-contract pattern must be respected. Never bundle a destructive migration with code changes.

### Rollback

Revert the migration. **Coordinate with the dev team before rolling back staging.**

---

## PR-10 — Add CHECK constraints (P0 hardening)

**Effort:** 1 day
**Risk:** **low-medium** (CHECK constraints can reject existing data; need data audit first)
**Audit ref:** 2.6, 2.13, 2.27, 2.28, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 12.1, 14.6

### Problem

The schema has 50+ models and 40+ enums, but **almost no DB-level CHECK constraints**. Postgres supports them via raw SQL in a migration. Currently:

- `Rider.lifecycleStatus` validity check (state machine is TS-only)
- `KycProfile.status` transition check
- `Rider.batteryLevel` 0-100 check
- `Wallet.balanceInPaise >= 0` check
- `OutboxEvent.attempts <= maxAttempts` check
- `KycProfile.aadhaarNumber ~ '^\d{12}$'`
- `KycProfile.panNumber ~ '^[A-Z]{5}\d{4}[A-Z]$'`
- `KycProfile.ifscCode ~ '^[A-Z]{4}0[A-Z0-9]{6}$'`
- `Rider.phone ~ '^\+?\d{10,15}$'`
- `Rider.email ~* '^[^@]+@[^@]+\.[^@]+$'`
- `Vehicle.vehicleNumber` regex check
- `BackupSchedule.timeOfDay ~ '^\d{2}:\d{2}$'`
- `IdempotencyKey.expiresAt > createdAt`
- `Wallet.balanceInPaise >= 0`
- `RiderEarning.amount > 0`
- `RentalPlan.durationDays` matches `type` (DAILY=1, WEEKLY=7, MONTHLY=30)

### Fix

Add a single migration with all CHECK constraints:

```sql
-- web/prisma/migrations/20260729160000_add_check_constraints/migration.sql

-- 1. Rider.batteryLevel 0-100
ALTER TABLE "Rider" ADD CONSTRAINT rider_battery_level_range
  CHECK ("batteryLevel" >= 0 AND "batteryLevel" <= 100);

-- 2. Rider.phone format
ALTER TABLE "Rider" ADD CONSTRAINT rider_phone_format
  CHECK ("phone" ~ '^\+?\d{10,15}$');

-- 3. Rider.email format
ALTER TABLE "Rider" ADD CONSTRAINT rider_email_format
  CHECK ("email" IS NULL OR "email" ~* '^[^@]+@[^@]+\.[^@]+$');

-- 4. KycProfile.aadhaarNumber
ALTER TABLE "KycProfile" ADD CONSTRAINT kyc_aadhaar_format
  CHECK ("aadhaarNumber" IS NULL OR "aadhaarNumber" ~ '^\d{12}$');

-- 5. KycProfile.panNumber
ALTER TABLE "KycProfile" ADD CONSTRAINT kyc_pan_format
  CHECK ("panNumber" IS NULL OR "panNumber" ~ '^[A-Z]{5}\d{4}[A-Z]$');

-- 6. KycProfile.ifscCode
ALTER TABLE "KycProfile" ADD CONSTRAINT kyc_ifsc_format
  CHECK ("ifscCode" IS NULL OR "ifscCode" ~ '^[A-Z]{4}0[A-Z0-9]{6}$');

-- 7. Wallet.balanceInPaise >= 0
ALTER TABLE "Wallet" ADD CONSTRAINT wallet_balance_nonnegative
  CHECK ("balanceInPaise" >= 0);

-- 8. OutboxEvent.attempts <= maxAttempts
ALTER TABLE "OutboxEvent" ADD CONSTRAINT outbox_attempts_cap
  CHECK ("attempts" <= "maxAttempts");

-- 9. RentalPlan.durationDays matches type
ALTER TABLE "RentalPlan" ADD CONSTRAINT rental_plan_duration_matches_type
  CHECK (
    ("type" = 'DAILY' AND "durationDays" = 1) OR
    ("type" = 'WEEKLY' AND "durationDays" = 7) OR
    ("type" = 'MONTHLY' AND "durationDays" = 30)
  );

-- 10. BackupSchedule.timeOfDay format
ALTER TABLE "BackupSchedule" ADD CONSTRAINT backup_schedule_time_format
  CHECK ("timeOfDay" ~ '^([01]\d|2[0-3]):[0-5]\d$');

-- 11. IdempotencyKey.expiresAt > createdAt
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT idempotency_expiry_after_create
  CHECK ("expiresAt" > "createdAt");
```

### Step 1: Data audit (BEFORE the migration)

Before adding CHECK constraints, run a query against the staging DB to check for any rows that would fail the new constraints:

```sql
-- Example: check for bad phone numbers
SELECT id, phone FROM "Rider" WHERE phone !~ '^\+?\d{10,15}$';
-- Example: check for negative wallet balance
SELECT id, "balanceInPaise" FROM "Wallet" WHERE "balanceInPaise" < 0;
```

**If any rows fail, fix them first** (use-case-level cleanup or accept the constraint rejection by quarantining the bad rows).

### Acceptance criteria

- [ ] All CHECK constraints added in a single migration
- [ ] Data audit run on staging; no rows fail the new constraints
- [ ] Production data audit run; no rows fail
- [ ] Migration applied successfully in staging for 1 week
- [ ] A negative test: try to insert a bad value, verify it's rejected with a clear error

### Reviewer focus

- Is the data audit result clean? (If not, this PR is blocked until bad rows are cleaned up.)
- Are the CHECK constraints too strict? (E.g., `Rider.phone ~ '^\+?\d{10,15}$'` rejects `+1-555-1234` if anyone has a US phone number. Verify the actual phone format used in the data.)

### Rollback

Drop the CHECK constraints in a new migration. **Coordinate with the dev team before rolling back staging.**

---

# What's NOT in this plan (and why)

The audit identified 67 findings. This plan covers the 10 highest-impact PRs (~61 of 67 items). The remaining 6 are:

| Audit ref | Item | Why deferred |
|---|---|---|
| 2.8 | `RiderLifecycleStatus` has 15 values — split into stage + per-step statuses | Large refactor; touches every use-case that reads/writes `lifecycleStatus` |
| 2.10, 2.11, 2.12 | `Rider.pickupHub`/`currentPlan`/`teamLeader` should be FKs not strings | Requires data migration to map existing string values to FK IDs |
| 2.19, 2.20, 2.22, 2.23 | `String` JSON-as-string columns → `Json` | Requires reading existing data, validating JSON, and migrating |
| 2.35 | `Admin.permissions` is `String` JSON → `text[]` or relation | Requires reading existing data, parsing, and migrating |
| 2.39 | `WalletLedger.txnId` rename to `transactionId` | Cosmetic; defer |
| 4.9 | `OutboxEvent` has 7 indexes — over-indexed | Requires actual query-pattern analysis; defer until we have prod data |

These are all real findings but they're **larger refactors** (data migration + use-case updates) than the 10 PRs in this plan. File them as follow-up tickets after the 10-PR sequence ships.

---

# Sequencing summary

| PR | Title | Effort | Risk | Phase |
|---|---|---|---|---|
| PR-1 | Fix `reset_rahil.ts` | 1 hr | zero | Ship now |
| PR-2 | Fix `seed-audit.ts` | 30 min | zero | Ship now |
| PR-3 | Reconcile `payment_gateways` migration | 2 hr | medium | After PR-1, PR-2 |
| PR-4 | `lockPassword` → `lockPasswordHash` | 1.5 hr | medium | After PR-3 |
| PR-5 | PII encryption verification | 0.5–2 d | medium-high | After PR-4 |
| PR-6 | Remove `DATABASE_OFFLINE` mock | 0.5 d | medium | After PR-5 (or in parallel with PR-7) |
| PR-7 | Rename `Int` money to `*InPaise` | 3 hr | medium | After PR-6 |
| PR-8 | Convert `Float` money to `Int` paise | 2 hr | medium | After PR-7 |
| PR-9 | `Rider` decomposition (remaining 4 child tables) | 1 d | medium | After PR-8 |
| PR-10 | Add CHECK constraints | 1 d | low-medium | After PR-9 |
| **Total** | | **~13 days focused** | | |

**Recommended merge order for one team:** PR-1 + PR-2 + PR-3 in the first PR (3.5 hr). Then PR-4 + PR-5 in a second PR (1-2 days). Then PR-6 + PR-7 + PR-8 in a third PR (1 day). Then PR-9 + PR-10 in a fourth PR (2 days). **4 PRs total, ~5 days of focused work.**

---

# Risk register

| Risk | Mitigation |
|---|---|
| PR-3 rename breaks staging | Replay migration on a fresh DB; verify the new columns match the schema |
| PR-4 unhashed passwords exist in production | Data migration script quarantines bad rows; manual review before re-hashing |
| PR-5 PII columns are plaintext (worst case) | Out-of-band alert; the data migration is unavoidable but slow |
| PR-7 unit assumption is wrong (`RentalPlan.price` is rupees not paise) | **Critical:** verify before any migration. Use-case grep is the gate. |
| PR-10 CHECK constraint rejects existing data | Data audit first; quarantine bad rows before adding constraint |
| `DATABASE_OFFLINE` is set somewhere we don't expect | The env.ts prod-mode guard already prevents this; PR-6 reads from `env` for defense-in-depth |
| Coordinate timing between PRs | The 4-PR merge order above keeps the highest-risk changes isolated |

---

# What you do next

**Reviewer (you):** this plan is for the dev team, not for you. The actionable items for you are:

1. **Hand the 4-PR merge order to the dev team** — they can ship PR-1, PR-2, PR-3 in one sprint (low risk, immediate wins).
2. **PR-3 (payment gateways) needs a 1-week staging soak** before the follow-up migration runs in production. Make sure the dev team doesn't rush this.
3. **PR-4 (lock password) and PR-5 (PII encryption) are the highest-impact** for security. Flag them as priorities if the dev team asks what to ship first.
4. **PR-6 (DATABASE_OFFLINE removal) is a laptop-mode dev experience change** — coordinate with whoever runs the dev environment before this ships.

If you want to track these in your `docs/FOLLOWUP_TICKETS.md`, copy the 4-PR merge order in there. Or ping me and I'll do it.

---

# Pointers

- **Full audit:** `docs/AUDIT_DATABASE.md` (67 findings, ~62 KB)
- **Prior remediation:** `SCOPE.md` (Phases 0-7; Rider decomposition already done in Phase 2)
- **Release readiness:** `docs/RELEASE_READINESS_2026-07-29.md`
- **Existing device test playbook:** `docs/DEVICE_TEST_PLAYBOOK.md` (no DB changes affect the phone test plan)
- **CHECK constraint reference:** [PostgreSQL docs](https://www.postgresql.org/docs/current/ddl-constraints.html)
- **Expand-and-contract pattern:** [martinfowler.com/bliki/ParallelChange.html](https://martinfowler.com/bliki/ParallelChange.html)
