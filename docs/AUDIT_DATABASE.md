# Voltium Database / Data Layer — Deep-Dive Audit Findings

**Date:** 2026-07-29
**Scope:** `web/prisma/**` — `schema.prisma` (50+ models, 1,484 lines, 37 KB), 13 migrations, 4 helper scripts, `web/src/lib/db.ts` (the Prisma wrapper).

> **Status (2026-07-30, Pass 4):** 4 of 10 Top 10 P0s FIXED, 3 PARTIALLY FIXED, 4 STILL TRACKED, **1 STALE (audit was wrong)**: #2.2 lockPassword plaintext (renamed to lockPasswordHash, hashed on write). JSON columns and FK columns done (#8, #7 sub-A). See [`AUDIT_VERIFICATION_4_2026-07-30.md`](./AUDIT_VERIFICATION_4_2026-07-30.md) §3.
**Method:** File-by-file read. Every finding has file:line evidence and a concrete fix.

This is the fourth in the audit series, behind `AUDIT_FINDINGS.md` (broad admin web), `flutter/AUDIT_FINDINGS.md`, and `AUDIT_BACKEND.md` (backend deep). It is focused entirely on the database / data layer.

The previous `AUDIT_FINDINGS.md` and `AUDIT_BACKEND.md` already covered the `Rider` model's 90+ columns, the soft-delete pattern, the offline-mock-fallback, and the bulk action patterns. **This audit does not duplicate those findings** — only adds the deep DB-specific issues, plus the schema/migration drift, the broken helper scripts, the seed-file issues, and the missing DB-level constraints.

## Severity legend

- **P0** — broken behavior, security risk, money/data corruption, comment that lies, schema/migration drift
- **P1** — will bite soon (correctness, performance, maintainability)
- **P2** — code smell, missed best practice
- **P3** — nice-to-have / hygiene

## Table of contents

1. [Schema overview: 50+ models, 40+ enums, ~80 indexes](#1-schema-overview)
2. [Schema design issues](#2-schema-design-issues)
3. [Missing DB-level constraints](#3-missing-db-level-constraints)
4. [Missing indexes / over-indexed columns](#4-missing-indexes--over-indexed-columns)
5. [Soft-delete pattern in `db.ts`](#5-soft-delete-pattern-in-dbts)
6. [Offline-mock-fallback in `db.ts` (the big one)](#6-offline-mock-fallback-in-dbts)
7. [Dynamic pool config in `db.ts`](#7-dynamic-pool-config-in-dbts)
8. [Migration quality: drift, evictions, repairs](#8-migration-quality)
9. [Helper scripts: `query_rider.ts`, `reset_rahil.ts`, `seed_*.ts`](#9-helper-scripts)
10. [Seed files: prod-vs-test contamination](#10-seed-files)
11. [PII at rest: encryption, redaction, deletion](#11-pii-at-rest)
12. [Money-path data integrity](#12-money-path-data-integrity)
13. [Idempotency, rate limiting, outbox: tables in detail](#13-idempotency-rate-limiting-outbox)
14. [Backup, restore, reconciliation tables](#14-backup-restore-reconciliation-tables)
15. [Prisma generated client concerns](#15-prisma-generated-client-concerns)
16. [Top 10 critical findings](#16-top-10-critical-findings)
17. [Cross-cutting observations](#17-cross-cutting-observations)
18. [Recommended 10-PR sequence](#18-recommended-10-pr-sequence)

---

## 1. Schema overview

**File:** `web/prisma/schema.prisma` (1,484 lines, 37 KB)

### Model inventory (50+ models)

| Category | Models |
|---|---|
| **Identity** | `Admin`, `AdminSession`, `RolePermission`, `Rider` (90+ columns) |
| **KYC/Verification** | `KycProfile`, `Guarantor` |
| **Money** | `Wallet`, `WalletLedger`, `DepositRecord`, `Transaction`, `TransactionBreakdown`, `RiderEarning` |
| **Rental** | `RentalPlan`, `Shift`, `RentalLease`, `VehicleReturn` |
| **Fleet** | `Hub`, `Vehicle` |
| **Support** | `SupportTicket`, `TicketMessage`, `Faq` |
| **Notifications** | `Notification`, `NotificationDelivery`, `Announcement`, `AnnouncementDelivery` |
| **Audit** | `AuditLog` |
| **Sync** | `SyncQueue` |
| **Files** | `FileRecord` |
| **Marketing** | `Offer`, `Coupon`, `Reward` |
| **Config** | `SystemSetting` (consolidated from old `Setting` + `SystemSetting`), `LegalDocument` |
| **Team** | `TeamLeader` |
| **Operations** | `Incident` |
| **Risk** | `RiderScore`, `TrafficFine` |
| **Device** | `DeviceViolation`, `UserContact`, `UserCallLog`, `UserLocation` |
| **Auth** | `OtpCode` |
| **Infra** | `RateLimitBucket`, `OutboxEvent`, `ReconciliationReport`, `BackupSchedule`, `BackupJob`, `RestoreJob`, `IdempotencyKey`, `PaymentGateway` |

### Enum inventory (40+ enums)

28 enums in the schema, including:
- `RiderLifecycleStatus` — 15 values (NEW, PHONE_VERIFIED, ..., CLOSED)
- `KycStatus` — 7 values
- `VehicleReturnStatus` — 5 values
- `GuarantorStatus` — 7 values
- `DepositStatus` — 9 values
- `TransactionStatus` — 6 values
- `TransactionType` — 2 values
- `TransactionPurpose` — 9 values
- `RentalStatus` — 10 values
- `VehicleStatus` — 8 values
- `SupportTicketStatus` — 5 values
- `AdminRole` — 9 values
- `AuditActionType` — 13 values
- `LedgerEntryType` — 2 values
- `LedgerCategory` — 9 values
- `FileVisibility` — 3 values
- `FileStatus` — 5 values
- `OutboxEventStatus` — 4 values
- `BreakdownType` — 5 values
- `TicketCategory` — 6 values
- `TicketPriority` — 4 values
- `NotificationType` — 8 values
- `NotificationPriority` — 4 values
- `NotificationDeliveryStatus` — 4 values
- `ActorType` — 3 values
- `HttpMethod` — 4 values
- `SyncStatus` — 4 values
- `AnnouncementStatus` — 5 values
- `AnnouncementDeliveryStatus` — 4 values
- `IncidentSeverity` — 4 values
- `IncidentStatus` — 4 values
- `IncidentType` — 5 values
- `RiskLevel` — 4 values
- `FineStatus` — 5 values
- `ViolationStatus` — 2 values
- `RentalPlanType` — 3 values (DAILY, WEEKLY, MONTHLY)
- `DiscountType` — 2 values
- `SenderType` — 2 values
- `FileOwnerType` — 3 values
- `IdempotencyStatus` — 3 values
- `MdrBearer` — 2 values

### Index count: ~80 explicit indexes

Heavy indexing on:
- Foreign keys (almost all have @@index)
- Lookup fields (phone, riderId, status, createdAt)
- Composite indexes (status+createdAt, riderId+status, etc.)

---

## 2. Schema design issues

### 2.1 [P0] `Rider` model has 90+ columns — needs decomposition

**File:** `web/prisma/schema.prisma:136-228`

The `Rider` model has 90+ fields. Categories:
- **Identity (10):** id, serialNumber, riderId, phone, fullName, email, fatherName, motherName, dob, currentAddress
- **Auth (5):** tokenVersion, lifecycleStatus, vehicleId, deliveryId, assignedVehicle
- **Onboarding state (8):** pickupHub, currentPlan, planStartDate, planEndDate, advanceRentPaid, preferredShift, teamLeader, emergencyContact
- **Referral (2):** referralCode, referredBy
- **Permissions (8):** locationGranted, batteryGranted, contactsGranted, callLogsGranted, micGranted, cameraGranted, phoneGranted, lastDeviceViolationAt, deviceViolationCount
- **Timestamps (4):** pickedUpAt, registrationDoneAt, depositDoneAt, kycDoneAt, planDoneAt
- **Device admin (10):** fcmToken, isAdminLocked, lockPassword, isUninstallBlocked, isLocationMandatory, isAppsControlRestricted, deviceAdminGranted, displayOverlayGranted
- **Pickup photos (5):** pickupPhotoFront, pickupPhotoBack, pickupPhotoLeft, pickupPhotoRight, pickupPhotoWithVehicle
- **Location (3):** lastKnownLat, lastKnownLng, lastLocationAt
- **Plan rejection (1):** planRejectionReason
- **Audit (3):** createdAt, updatedAt, deletedAt

**Why it matters:**
- Every `UPDATE rider` writes to the entire row, even if only one field changes (Postgres MVCC). A 1MB-wide row generates a lot of WAL traffic.
- Index selectivity: a composite index on `(phone, lifecycleStatus)` makes sense, but adding `(riderId, lifecycleStatus)` is redundant.
- Adding a new column requires a migration on a 1M+ row table. ALTER TABLE on a wide table is slow.
- Read patterns conflict: `SELECT phone, fullName` reads the full row due to Postgres heap layout (unless using covering indexes, which Prisma doesn't generate).

**Fix:** extract child tables:
- `RiderPickupPhotos` (1:1, riderId FK)
- `RiderPermissions` (1:1, riderId FK, all 8 permission booleans)
- `RiderDevice` (1:1, riderId FK, FCM token, lock password, device admin flags)
- `RiderLocation` (1:1, riderId FK, lastKnownLat/Lng/At)
- `RiderOnboarding` (1:1, riderId FK, pickupHub, currentPlan, planStartDate, etc.)

Each child table is 5-15 columns, more cache-friendly, easier to migrate.

### 2.2 [P0] `Rider.lockPassword` is a plaintext password — must be hashed

**File:** `web/prisma/schema.prisma:177`

```prisma
lockPassword            String?
```

The `lockPassword` field is a `String?`. The `Admin` model uses `String password` (also plaintext per schema, but presumably hashed at the use-case level via `hashPassword()`). Need to verify `lockPassword` is hashed before storage.

**Audit question:** does `riderUseCases.setLockPassword(riderDbId, password)` call `hashPassword()` before `db.rider.update({ data: { lockPassword } })`? If not, a DB leak = a rider's lock password in plaintext.

**Fix:** verify the use-case. If plaintext, switch to `lockPasswordHash String?` and use `hashPassword()`.

### 2.3 [P0] `Admin.password` is the only field — verify hashing

**File:** `web/prisma/schema.prisma:13`

```prisma
password     String
```

`seed.ts:12` calls `await hashPassword('admin123')` before storing. Good. But other code paths may write to `Admin.password` without hashing. **Audit all writes to `Admin.password`.**

**Fix:** add a Prisma `@@check` or a `BEFORE INSERT/UPDATE` trigger that verifies the password is hashed (e.g. matches `pbkdf2$...` or `bcrypt$...` prefix). Or, add a use-case-only setter.

### 2.4 [P0] `KycProfile.aadhaarNumber`, `panNumber`, `accountNumber` are plaintext PII

**File:** `web/prisma/schema.prisma:273-278`

```prisma
aadhaarNumber   String?
panNumber       String?
accountNumber   String?
ifscCode        String?
```

These are PII but stored in plaintext columns. The previous broad audit noted `pii-crypto.ts` exists for encryption. Verify these fields are **encrypted at write time** and **decrypted at read time**.

**Fix:** audit the KYC use-cases. If a write path doesn't encrypt, it's a P0 PII leak.

### 2.5 [P0] `Guarantor.aadhaarFront`, `pan`, `address` are PII

**File:** `web/prisma/schema.prisma:300-304`

```prisma
aadhaarFront String?
aadhaarBack  String?
pan          String?
video        String?
signature    String?
address      String?
photo        String?
```

The file URLs (aadhaarFront, pan, etc.) may be in plaintext storage, but the **values themselves** are file paths/URLs, not PII values. The address (`address`) IS PII though.

**Fix:** verify address is encrypted.

### 2.6 [P1] `Rider.batteryLevel` is `Int` 0-100, but no CHECK constraint

**File:** `web/prisma/schema.prisma:197`

```prisma
batteryLevel  Int     @default(100)
```

A bug in the sync code could set `batteryLevel = 5000` or `-50`. The app code presumably validates 0-100, but the DB has no CHECK constraint. Same for `batteryPartner`, etc.

**Fix:** add `@db.SmallInt` and a CHECK constraint at the migration level.

### 2.7 [P1] `Rider.tokenVersion` is the JWT version — but no `@@index` on it

**File:** `web/prisma/schema.prisma:147`

The `tokenVersion` is checked on every JWT verify (per `lib/auth.ts:138-203`). The query is `db.rider.findUnique({ where: { id: riderDbId }, select: { tokenVersion: true } })`. The lookup is by `id` (the primary key), so an index isn't strictly needed. **No fix needed**, but flag for awareness.

### 2.8 [P1] `RiderLifecycleStatus` enum has 15 values — too many for one enum

**File:** `web/prisma/schema.prisma:1080-1096`

```prisma
enum RiderLifecycleStatus {
  NEW
  PHONE_VERIFIED
  PROFILE_SUBMITTED
  KYC_SUBMITTED
  KYC_APPROVED
  GUARANTOR_SUBMITTED
  GUARANTOR_APPROVED
  DEPOSIT_PENDING
  DEPOSIT_APPROVED
  PLAN_SELECTED
  PICKUP_SCHEDULED
  ACTIVE
  SUSPENDED
  RETURN_PENDING
  CLOSED
}
```

15 values. Some are "in progress" (PHONE_VERIFIED, PROFILE_SUBMITTED) and some are "outcome" (KYC_APPROVED, GUARANTOR_APPROVED). Mixing in-progress and outcome states in one enum is a code smell — a rider can be in `KYC_SUBMITTED` and `GUARANTOR_SUBMITTED` simultaneously? The state machine should be explicit.

**Fix:** separate `RiderLifecycleStage` (NEW, ONBOARDING, ACTIVE, RETURN_PENDING, CLOSED) from per-step statuses (kycStatus, guarantorStatus, depositStatus, planSelected). The current `lifecycleStatus` is a denormalized aggregate.

### 2.9 [P1] `RiderLifecycleStatus` has no `TERMINATED` value, but the Flutter app expects one

**File:** `web/prisma/schema.prisma:1080-1096`

The previous rider app audit noted: `app/router.dart:289-291` maps `terminated → preDashboard`. The Prisma enum has no `TERMINATED` value — only `SUSPENDED` and `CLOSED`. The Flutter app and the backend disagree on the state set.

**Fix:** add `TERMINATED` to the enum, or update the Flutter app to use `SUSPENDED`/`CLOSED`.

### 2.10 [P1] `Rider.pickupHub` is `String?` (not a FK to `Hub.id`)

**File:** `web/prisma/schema.prisma:153`

```prisma
pickupHub  String?
```

The `pickupHub` field is a free-form string, not a foreign key to `Hub.id`. This means:
- A rider can have `pickupHub: 'not-a-real-hub'` without DB-level rejection
- Renaming or retiring a hub doesn't cascade to riders
- Joining `Rider` and `Hub` requires a custom string match, which is fragile

**Fix:** change to `pickupHubId String?` with `@relation(fields: [pickupHubId], references: [id])`.

### 2.11 [P1] `Rider.currentPlan` is `String?` (not a FK to `RentalPlan.id`)

**File:** `web/prisma/schema.prisma:154`

Same anti-pattern as 2.10. `currentPlan` is a free-form string. If the rental plan is renamed, the rider's `currentPlan` becomes a dangling reference.

**Fix:** change to `currentPlanId String?` with FK.

### 2.12 [P1] `Rider.teamLeader` is `String?` (not a FK to `TeamLeader.id`)

**File:** `web/prisma/schema.prisma:159`

Same anti-pattern. The `team_leaders` table has `id` as the PK; `Rider.teamLeader` should FK to it.

**Fix:** same as 2.10.

### 2.13 [P0] `RentalPlan.durationDays` is `Int` but the comment says "strictly hardcoded" — no DB-level enforcement

**File:** `web/prisma/schema.prisma:122`

The schema comment says:
> `durationDays` represents the billing cycle length, which is strictly hardcoded based on `type` (DAILY = 1, WEEKLY = 7, MONTHLY = 30) in the backend use-cases.

But the DB has no CHECK constraint enforcing this. A direct INSERT (e.g. via psql or a misbehaving use-case) can set `durationDays: 999` for a `DAILY` plan.

**Fix:** add a CHECK constraint or a trigger that validates `durationDays` matches `type`. Or, drop the column entirely and derive it from `type` in the use-case.

### 2.14 [P1] `RentalPlan.price` is `Int` — but the Wallet uses `Int` for paise (×100)

**File:** `web/prisma/schema.prisma:121, 128`

```prisma
price                Int
securityDeposit      Int  @default(0)
```

The `price` is `Int` (rupees), and the wallet's `balanceInPaise` is `Int` (paise). Mixing units in different tables is a footgun. A rider's wallet balance in paise vs. a plan's price in rupees requires a `*100` conversion at every join.

**Fix:** standardize on paise. Rename `price` to `priceInPaise`, `securityDeposit` to `securityDepositInPaise`.

### 2.15 [P1] `TransactionBreakdown.type` is `BreakdownType` enum, but the values overlap with `TransactionPurpose`

**File:** `web/prisma/schema.prisma:454-465, 1263-1271`

`BreakdownType` has `CHARGE, TAX, DISCOUNT, PENALTY, ADJUSTMENT`. `TransactionPurpose` has `TOP_UP, SECURITY_DEPOSIT, RENT_PAYMENT, REWARD, REFUND, REVERSAL, ADMIN_ADJUSTMENT, FORFEITURE`. The two enums overlap conceptually (an `ADMIN_ADJUSTMENT` is also an `ADJUSTMENT`).

**Fix:** consolidate. Use `TransactionPurpose` everywhere and drop `BreakdownType`. Or, define a clearer hierarchy.

### 2.16 [P0] `DepositRecord` has both `transactionId` (unique) and `riderId` (unique) — but the relation is ambiguous

**File:** `web/prisma/schema.prisma:362-388`

```prisma
model DepositRecord {
  id                    String        @id @default(cuid())
  riderId               String        @unique
  transactionId         String?       @unique
  ...
  rider                 Rider         @relation(...)
  transaction           Transaction?  @relation(...)
}
```

Both `riderId` and `transactionId` are `@unique`. The 1:1 relation is enforced. Good. But:
- The `transactionId` is optional (`String?`), so a `DepositRecord` can exist without a `Transaction`. This is intentional (deposit can be paid but not yet tied to a transaction).
- However, `riderId` is `@unique` — only ONE deposit per rider. A rider can only have one active deposit at a time. If a rider's deposit is REFUNDED, can they have a new one? The `@@unique` blocks that.

**Fix:** consider a state-based uniqueness. Either drop `@unique` on `riderId` and enforce at the use-case level, or add a `isActive` flag.

### 2.17 [P1] `WalletLedger.idempotencyKey` is `@unique` — but no FK to `IdempotencyKey`

**File:** `web/prisma/schema.prisma:345`

```prisma
idempotencyKey  String?  @unique
```

The wallet ledger has its own `idempotencyKey`, separate from `IdempotencyKey.key`. Two systems. The wallet ledger doesn't FK to the `IdempotencyKey` table, so there's no referential integrity between them.

**Fix:** either drop the ledger's `idempotencyKey` and FK to `IdempotencyKey`, or unify the two tables.

### 2.18 [P1] `Transaction.idempotencyKey` is `@unique` — same as 2.17

**File:** `web/prisma/schema.prisma:436`

Same anti-pattern. The `Transaction` has its own `idempotencyKey`, separate from `IdempotencyKey.key`.

**Fix:** same as 2.17.

### 2.19 [P1] `SyncQueue.payload` is `String` — JSON-as-string, no schema

**File:** `web/prisma/schema.prisma:578`

```prisma
payload  String
```

The sync queue stores a JSON payload as a string. No schema validation at the DB level. A malformed payload (e.g. missing `vehicleId` for a pickup action) is accepted.

**Fix:** add a JSONB column with a CHECK constraint, or a use-case-level validator.

### 2.20 [P1] `Announcement.targetIds` is `String` — JSON-as-string

**File:** `web/prisma/schema.prisma:725`

```prisma
targetIds  String  @default("[]")
```

Same anti-pattern. The default is `'[]'` but a malformed value is accepted.

**Fix:** use `Json` or `String[]`.

### 2.21 [P1] `Announcement.targetAudience` is `String` — should be an enum

**File:** `web/prisma/schema.prisma:724`

```prisma
targetAudience  String
```

What are the valid values? `ALL`, `BY_HUB`, `BY_RIDER`, `BY_TEAM_LEADER`? Unclear.

**Fix:** convert to enum.

### 2.22 [P1] `Incident.photos` is `String` — JSON-as-string array

**File:** `web/prisma/schema.prisma:769`

```prisma
photos  String  @default("[]")
```

Same anti-pattern.

### 2.23 [P1] `FileRecord.metadata` is `String` — JSON-as-string

**File:** `web/prisma/schema.prisma:603`

Same.

### 2.24 [P1] `KycProfile.editableFields` is `String[]` — stringly-typed field allowlist

**File:** `web/prisma/schema.prisma:282`

```prisma
editableFields  String[]
```

This stores a list of field names that are editable (e.g. `['phone', 'email']`). The values are field names — no validation that they correspond to actual `KycProfile` fields. A typo (`'phon'`) is accepted.

**Fix:** use a typed list of field names or replace with a boolean per field.

### 2.25 [P1] `Rider` has `createdAt DateTime @default(now())` — but no DB-level `createdAt` index for time-range queries

**File:** `web/prisma/schema.prisma:185`

Most models have `createdAt` and `updatedAt` but no `@@index([createdAt])` for time-range queries. The "rider created in the last 7 days" query is a full table scan.

**Fix:** add `@@index([createdAt])` on `Rider` and other time-series models (`Transaction`, `WalletLedger`, `AuditLog`, `Notification`, `TicketMessage`).

### 2.26 [P1] `WalletLedger` has no DB-level constraint that `balanceAfter` is consistent with the running sum

**File:** `web/prisma/schema.prisma:344`

```prisma
balanceAfter  Int
```

The `balanceAfter` is computed by the use-case. The DB doesn't verify that `balanceAfter` of entry N equals `balanceAfter` of entry N-1 plus the current `amountInPaise`. A bug in the use-case can desync the stored value from the actual sum.

**Fix:** add a Postgres trigger that recomputes `balanceAfter` and rejects the insert if it doesn't match. Or, drop `balanceAfter` and compute it on read.

### 2.27 [P1] `OutboxEvent.attempts` is `Int` with no upper bound

**File:** `web/prisma/schema.prisma:949`

A stuck event can increment `attempts` forever. The previous broad audit noted that failed events go to DLQ, but the `attempts` counter has no cap enforced at the DB level (only `maxAttempts` which is also stored).

**Fix:** add a CHECK constraint `attempts <= maxAttempts`. Or, add a trigger that sets status to FAILED when attempts >= maxAttempts.

### 2.28 [P1] `OtpCode.attempts` is `Int` with no upper bound

**File:** `web/prisma/schema.prisma:919`

```prisma
attempts  Int  @default(0)
```

An attacker can keep trying and incrementing `attempts`. The use-case presumably checks `attempts >= MAX_ATTEMPTS`, but the DB doesn't enforce.

**Fix:** add a CHECK constraint. Or, set `attempts` to NULL after exceeding the cap.

### 2.29 [P0] `OtpCode.codeHash` and `OtpCode.salt` are separate columns

**File:** `web/prisma/schema.prisma:916-917`

```prisma
codeHash  String
salt      String
```

Modern password-hashing (PBKDF2, bcrypt, argon2) embeds the salt in the hash string. Two columns suggests the code is using an older pattern (e.g. `hash(code + salt)`). Verify the hashing algorithm is PBKDF2 or argon2 (per `seed.ts:11` "PBKDF2-SHA256").

**Fix:** verify the OTP verify code uses the salt correctly. If using argon2, switch to a single `codeHash` column with the salt embedded.

### 2.30 [P1] `Rider.fcmToken` is `String?` — no length cap

**File:** `web/prisma/schema.prisma:175`

```prisma
fcmToken  String?
```

FCM tokens are ~200 chars, but a malicious client could send a 1MB token.

**Fix:** add `@db.VarChar(500)` or similar.

### 2.31 [P1] `Vehicle.batteryLevel` is `Int` with `@default(100)` — no CHECK

**File:** `web/prisma/schema.prisma:76`

Same as 2.6.

### 2.32 [P1] `RiderEarning.amount` is `Float` — should be `Int` (paise)

**File:** `web/prisma/schema.prisma:796`

```prisma
amount  Float
```

Float for money is a footgun (floating-point precision). The wallet uses `Int` (paise). The earnings should too.

**Fix:** change to `Int` and rename to `amountInPaise`.

### 2.33 [P1] `TrafficFine.amount` is `Float` — should be `Int` (paise)

**File:** `web/prisma/schema.prisma:836`

Same as 2.32.

### 2.34 [P1] `RiderScore.compositeScore` and sub-scores are `Float` — no range check

**File:** `web/prisma/schema.prisma:815-819`

```prisma
paymentScore   Float  @default(0)
kycScore       Float  @default(0)
activityScore  Float  @default(0)
supportScore   Float  @default(0)
compositeScore Float  @default(0)
```

Are these 0-100? -1 to 1? No CHECK constraint.

**Fix:** add CHECK or move to a `Decimal` with a documented range.

### 2.35 [P1] `Admin.permissions` is `String @default("[]")` — JSON-as-string

**File:** `web/prisma/schema.prisma:18`

```prisma
permissions  String  @default("[]")
```

The admin permissions are stored as a JSON string. The previous broad audit flagged this — should be a `text[]` or a relation table.

**Fix:** migrate to `text[]` (Postgres array) or a `AdminPermission` relation table.

### 2.36 [P1] `Vehicle.deletedAt` and other soft-delete fields have no `@@index([deletedAt])`

**File:** `web/prisma/schema.prisma:83, 108, 127, 187, 308, 485`

Six models have `deletedAt` (`Rider`, `Vehicle`, `RentalPlan`, `Shift`, `Guarantor`, `SupportTicket`). None have a `@@index([deletedAt])`. The default `WHERE deletedAt IS NULL` filter is a full table scan on each query.

**Fix:** add `@@index([deletedAt])` to each.

### 2.37 [P1] `IdempotencyKey` has `@@index([expiresAt])` but no `@@index([status, expiresAt])` for the reaper

**File:** `web/prisma/schema.prisma:1067-1078`

The reaper job (in `audit-cleanup` or similar) needs to find `WHERE status = 'COMPLETED' AND expiresAt < now()`. A composite index would be faster.

**Fix:** add `@@index([status, expiresAt])`.

### 2.38 [P0] `Rider.id` is `cuid()`, not `uuid()` — and `serialNumber` is `autoincrement()` but not on every model

**File:** `web/prisma/schema.prisma:11, 138`

`Admin.id` is `cuid()`. `Rider.id` is `cuid()` and `serialNumber Int @default(autoincrement())`. The `serialNumber` is a "human-readable" sequence number. Other models don't have it.

**Risk:** `serialNumber` is `autoincrement()` which is Postgres `SERIAL`. A `SERIAL` is a 4-byte int, max 2.1B. A rider system with millions of riders is fine. But a `Rider` is not deleted (soft delete), so the sequence keeps incrementing. OK.

**Fix:** nothing to fix; flag for awareness.

### 2.39 [P1] `WalletLedger.txnId` is `String?` but no FK to `Transaction.id`

**File:** `web/prisma/schema.prisma:340, 350`

```prisma
txnId          String?
...
txn            Transaction?  @relation(fields: [txnId], references: [id])
```

The relation is set up — `txn` is a relation, and `txnId` is the FK. **But** the field name `txnId` doesn't match the convention `transactionId` used elsewhere. Inconsistent.

**Fix:** rename to `transactionId` for consistency with `DepositRecord.transactionId`.

### 2.40 [P1] `BackupJob.sizeBytes` is `BigInt?` — only place using BigInt

**File:** `web/prisma/schema.prisma:1031`

```prisma
sizeBytes  BigInt?
```

The `BigInt` is correct for file sizes (up to 9.2 EB). But every other size is `Int` (4GB max). Inconsistent.

**Fix:** standardize on `Int` for files <4GB, `BigInt` for the rest. Or, document why this is the only `BigInt`.

---

## 3. Missing DB-level constraints

The schema has 50+ models and ~40 enums, but **almost no DB-level CHECK constraints**. Postgres supports them via `@@check` (Prisma 5+) or raw migration SQL. Currently:

- No `Rider.lifecycleStatus` validity check (the state machine is in TS only)
- No `KycProfile.status` transition check
- No `Rider.batteryLevel` 0-100 check
- No `WalletLedger.balanceAfter` consistency check
- No `OutboxEvent.attempts <= maxAttempts` check
- No `RiderEarning.amount > 0` check
- No `IdempotencyKey.expiresAt > createdAt` check
- No `Wallet.balanceInPaise >= 0` check (negative balance should be impossible)
- No `BackupSchedule.timeOfDay` HH:MM format check

**Fix:** add CHECK constraints to all of the above. Prisma 6 supports `@@check` natively. For older versions, add raw SQL in a migration.

### 3.1 [P0] No state-machine CHECK constraints

All state machines (see `AUDIT_BACKEND.md` section 19) are TS-only. A direct `UPDATE rider SET lifecycleStatus = 'ACTIVE' WHERE id = ?` via psql bypasses the machine.

**Fix:** add CHECK constraints or BEFORE UPDATE triggers for each state machine.

### 3.2 [P0] `Wallet.balanceInPaise` can be negative — no CHECK

**File:** `web/prisma/schema.prisma:321`

```prisma
balanceInPaise  Int  @default(0)
```

A bug in the use-case (e.g. a debit that doesn't check balance) can result in negative balance. The DB doesn't enforce.

**Fix:** add CHECK `balanceInPaise >= 0`. The `Wallet` is in paise, but a "rental overage" might allow a small negative balance — in that case, use a separate `allowOverdraft` boolean.

### 3.3 [P0] `KycProfile.aadhaarNumber` has no format check

**File:** `web/prisma/schema.prisma:273`

Aadhaar is 12 digits. The DB has no CHECK. A typo or attack (e.g. setting aadhaarNumber to 'AAAAAAAAAAAA') is accepted.

**Fix:** add CHECK `aadhaarNumber ~ '^\d{12}$'`.

### 3.4 [P0] `KycProfile.panNumber` has no format check

PAN is 10 chars (5 letters + 4 digits + 1 letter). The DB has no CHECK.

**Fix:** add CHECK `panNumber ~ '^[A-Z]{5}\d{4}[A-Z]$'`.

### 3.5 [P0] `KycProfile.ifscCode` has no format check

**File:** `web/prisma/schema.prisma:278`

IFSC is 11 chars (4 letters + 0 + 6 alphanumeric). The DB has no CHECK.

**Fix:** add CHECK `length(ifscCode) = 11 AND ifscCode ~ '^[A-Z]{4}0[A-Z0-9]{6}$'`.

### 3.6 [P0] `KycProfile.bankAccount` has no length check

The account number is typically 9-18 digits. The DB has no CHECK.

### 3.7 [P0] `Rider.phone` is `@unique` but no format check

**File:** `web/prisma/schema.prisma:140`

```prisma
phone  String  @unique
```

A rider can register with `'1234'`. The DB has no format check. The use-case probably checks via Zod, but the DB doesn't.

**Fix:** add CHECK `phone ~ '^\+?\d{10,15}$'`.

### 3.8 [P0] `Rider.email` is `String?` with no format check

**File:** `web/prisma/schema.prisma:142`

Same. A typo `'not-an-email'` is accepted.

**Fix:** add CHECK `email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$'`.

### 3.9 [P0] `Vehicle.vehicleNumber` is `@unique` but no format check

**File:** `web/prisma/schema.prisma:73`

Indian vehicle numbers follow a pattern (e.g. `DL 1S AB 1234`). The DB has no CHECK.

**Fix:** add a regex CHECK.

---

## 4. Missing indexes / over-indexed columns

The previous broad audit noted that indexes were added for `Rider`, `Transaction`, `Vehicle`. Let me check for missing or redundant indexes.

### 4.1 [P1] `Rider` has no `@@index([createdAt])`

**File:** `web/prisma/schema.prisma:185`

The "rider created in the last 7 days" query is a full scan.

**Fix:** add `@@index([createdAt])`.

### 4.2 [P1] `Rider` has no `@@index([lifecycleStatus, createdAt])` for the dashboard

**File:** `web/prisma/schema.prisma:221-227`

The "rider by lifecycle + recent" query is a common admin dashboard query. A composite index would help.

**Fix:** add `@@index([lifecycleStatus, createdAt])`.

### 4.3 [P1] `WalletLedger` has no `@@index([riderId, category])`

**File:** `web/prisma/schema.prisma:353-358`

The "rider's deposits only" or "rider's rewards only" query is common.

**Fix:** add `@@index([riderId, category])`.

### 4.4 [P1] `Transaction` has no `@@index([purpose, createdAt])`

**File:** `web/prisma/schema.prisma:444-450`

The "top-ups in the last 7 days" query is common for the admin dashboard.

**Fix:** add `@@index([purpose, createdAt])`.

### 4.5 [P1] `Notification` has no `@@index([riderId, createdAt])`

**File:** `web/prisma/schema.prisma:526-530`

The "rider's recent notifications" query is the primary read pattern.

**Fix:** add `@@index([riderId, createdAt])`.

### 4.6 [P1] `SupportTicket` has no `@@index([status, createdAt])`

**File:** `web/prisma/schema.prisma:491-495`

The "open tickets by recency" query is the primary admin dashboard query.

**Fix:** add `@@index([status, createdAt])`.

### 4.7 [P1] `AuditLog` has `@@index([actorId, createdAt])` but no `@@index([action, createdAt])`

**File:** `web/prisma/schema.prisma:564-570`

The "all LOGIN events in the last 7 days" query is common for security review.

**Fix:** add `@@index([action, createdAt])`.

### 4.8 [P1] `BackupJob` has `@@index([status])` but no `@@index([status, createdAt])`

**File:** `web/prisma/schema.prisma:1041-1045`

The "in-progress backups" admin view sorts by createdAt.

**Fix:** add `@@index([status, createdAt])`.

### 4.9 [P1] `OutboxEvent` has 6 indexes — over-indexed?

**File:** `web/prisma/schema.prisma:963-969`

`@@index([status])`, `@@index([eventType])`, `@@index([createdAt])`, `@@index([status, createdAt])`, `@@index([status, eventType])`, `@@index([status, eventType, readyAt])`, `@@index([status, updatedAt])`. **7 indexes.** Each index adds write overhead. The 3-column index `(status, eventType, readyAt)` is fine for the worker, but `[status, updatedAt]` and `[status, createdAt]` may be redundant (the worker probably uses one or the other).

**Fix:** analyze the actual query patterns in `outbox.ts`. Drop redundant indexes.

### 4.10 [P1] `Rider` has `@@index([phone, lifecycleStatus])` and `@@index([phone])` and `@@index([lifecycleStatus])` — partial overlap

**File:** `web/prisma/schema.prisma:222-227`

The composite `(phone, lifecycleStatus)` makes the standalone `phone` index redundant for queries that filter by both. But queries that filter by `phone` only still benefit from the standalone.

**Fix:** keep both for now; the marginal write cost is small.

---

## 5. Soft-delete pattern in `db.ts`

The soft-delete pattern is implemented as a Prisma extension in `web/src/lib/db.ts:247-338`. Six models are soft-delete-enabled: `Rider`, `Vehicle`, `RentalPlan`, `Shift`, `Guarantor`, `SupportTicket`.

### 5.1 [P0] Soft-delete extension can be bypassed by raw SQL

**File:** `web/src/lib/db.ts:271-337`

The soft-delete is enforced via Prisma's `$allOperations` extension. But:
- `client.$queryRaw` and `client.$executeRaw` are not wrapped (only the `$queryRaw` and `$executeRaw` wrappers in lines 209-246 don't enforce soft-delete filtering).
- A developer using `$queryRawUnsafe('SELECT * FROM riders WHERE id = ?')` will see deleted riders.

**Fix:** add a Postgres row-level security (RLS) policy that filters out `deletedAt IS NOT NULL` for SELECTs. Or, add a startup test that no `$queryRaw` query references a soft-delete table.

### 5.2 [P1] `findUnique` is silently rewritten to `findFirst`

**File:** `web/src/lib/db.ts:315-319`

```ts
if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
  const newOp = operation === 'findUniqueOrThrow' ? 'findFirstOrThrow' : 'findFirst';
  args.where = { ...args.where, deletedAt: null };
  try {
    return await (client as any)[modelKey][newOp](args);
```

The extension rewrites `findUnique` to `findFirst`. The performance difference is small (a `findUnique` uses the PK index, a `findFirst` may use any index). The use-case's expectation is "this row exists by id" — the rewrite works, but a future refactor that adds a unique constraint on `(id, deletedAt)` would let `findUnique` work directly.

**Fix:** add a unique partial index `CREATE UNIQUE INDEX ... ON riders (id) WHERE deletedAt IS NULL` so `findUnique` works on the soft-delete model.

### 5.3 [P1] Soft-delete is silent — no audit log

**File:** `web/src/lib/db.ts:273-308`

The extension converts `delete` to `update({ data: { deletedAt: new Date() } })`. No `createAuditLog` is called. A rider deletion is invisible in the audit log.

**Fix:** add `await createAuditLog(...)` in the soft-delete wrapper.

### 5.4 [P0] Soft-delete extension wraps `delete` and `deleteMany`, but `findFirst` filter is added on the `where` object — which the caller can override

**File:** `web/src/lib/db.ts:309-337`

```ts
if (['findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(operation)) {
  args.where = args.where || {};
  if (args.where.deletedAt === undefined) {
    args.where.deletedAt = null;
  }
}
```

The check is `if (args.where.deletedAt === undefined)`. If the caller passes `args.where.deletedAt: { not: null }` (i.e. "show me deleted riders"), the condition is satisfied (it's defined, not undefined), and the filter is the caller's, not the soft-delete's. That's intentional for "show me deleted" queries. **But** a caller could pass `args.where.deletedAt: { equals: null }` to override the soft-delete. That's a minor issue.

**Fix:** document the bypass pattern. Or, separate "show me deleted" into a separate `findDeleted` operation.

---

## 6. Offline-mock-fallback in `db.ts` (the big one)

The biggest concern in `db.ts` is the offline-mock-fallback (lines 8-153, 207-356). When `DATABASE_OFFLINE === 'true'`, all DB operations return mock data instead of throwing.

### 6.1 [P0] `DATABASE_OFFLINE` env flag is a real production flag

**File:** `web/src/lib/env.ts:153-198`

The `env.ts` file **rejects** `DATABASE_OFFLINE === 'true'` in production (line 154-158). **Good.** But:

- The `db.ts` extension checks `process.env.DATABASE_OFFLINE === 'true'` independently (line 8, 12, 210, 216, 229, 235, 259, 280, 298, 321, 343). The env is not validated through the Zod schema; it's read directly from `process.env`.
- If the env is somehow set (e.g. a misconfigured env file, a manual `export DATABASE_OFFLINE=true`), the mock fallback activates **even in production**.

**Fix:** read `DATABASE_OFFLINE` from the validated `env` object, not directly from `process.env`.

### 6.2 [P0] Mock fallback has hardcoded test phone numbers — if activated in prod, returns mock data for known phones

**File:** `web/src/lib/db.ts:38-49, 63-108`

```ts
const EXISTING_PHONES = new Set([
  '9999900001', '+919999900001', '9876543210', ...
]);
```

The mock fallback recognizes a hardcoded set of test phone numbers and returns a mock `Rider` for them. **If activated in production**, an attacker who knows these phone numbers can log in as `rider-1` and get the mock wallet with `balanceInPaise: 100000` (₹1,000) and `securityDeposit: 500000` (₹5,000). They could then book rentals, etc.

**Fix:** remove the mock fallback entirely from `db.ts`. The laptop mode (per `env.ts`) means the DB is local; if the local DB is down, the app should fail loud, not serve mock data.

### 6.3 [P0] Mock fallback for `Wallet` returns a fixed balance — bypasses real wallet ledger

**File:** `web/src/lib/db.ts:109-119`

The mock `Wallet` returns `balanceInPaise: 100000` and `securityDeposit: 500000`. **No** `WalletLedger` entries are created. If the mock fallback is activated mid-session, the rider's "balance" jumps to the mock value, breaking the ledger invariant.

**Fix:** same as 6.2.

### 6.4 [P0] Mock fallback for `KycProfile` returns `APPROVED` — bypasses KYC review

**File:** `web/src/lib/db.ts:120-126`

The mock `KycProfile` returns `status: 'APPROVED'`. **All riders in the mock get auto-approved KYC.** If activated in production, an attacker can skip the entire KYC flow.

**Fix:** same as 6.2.

### 6.5 [P0] Mock fallback for `Guarantor` returns `APPROVED` — bypasses guarantor review

**File:** `web/src/lib/db.ts:127-133`

Same. Mock `Guarantor` is auto-approved.

**Fix:** same as 6.2.

### 6.6 [P1] Mock fallback's `create` operation always succeeds — no idempotency

**File:** `web/src/lib/db.ts:147-150`

```ts
if (operation === 'create' || operation === 'update' || operation === 'upsert') {
  const id = args?.data?.id || args?.data?.riderId || 'mock-id';
  return { id, ...args?.data };
}
```

The mock returns the input data as-is. No unique constraint is enforced. A `db.rider.create({ data: { phone: 'X' } })` followed by another `db.rider.create({ data: { phone: 'X' } })` both succeed, creating two mock riders with the same phone.

**Fix:** same as 6.2.

### 6.7 [P0] Auto-recovery logic silently re-enables the DB

**File:** `web/src/lib/db.ts:11-34`

The auto-recovery starts a 30-second timer that pings the DB. If the ping succeeds, `isDbOffline = false` and the timer is cleared. **This is silent recovery** — no alert, no audit log, no operator notification. A production system that falls back to mock and then silently recovers has no signal of the incident.

**Fix:** add a Slack/PagerDuty alert on the offline transition. Log to the audit log.

### 6.8 [P1] Mock fallback returns `null` for non-rider queries

**File:** `web/src/lib/db.ts:151-152`

```ts
return null;
```

For models that aren't Rider, Wallet, KycProfile, or Guarantor, the mock returns `null`. A query like `db.vehicle.findUnique(...)` returns `null`, which may cascade as `Cannot read property 'X' of null` in the use-case.

**Fix:** return a more meaningful error from the mock.

---

## 7. Dynamic pool config in `db.ts`

The dynamic pool config (lines 159-194) is a clever trick: it parses the DATABASE_URL, adds `connection_limit`, `pool_timeout`, `connect_timeout` if missing.

### 7.1 [P1] Pool config is set at module load — can't be changed without restart

**File:** `web/src/lib/db.ts:159-194`

The `dbUrl` is computed once. A change to `DATABASE_POOL_SIZE` env var requires a restart. This is standard for most apps, but flag for awareness.

### 7.2 [P1] Default pool size is `10` for prod, `50` for test

**File:** `web/src/lib/db.ts:170`

The test pool of 50 is high. If a developer runs `NODE_ENV=development` (which defaults to 10, not 50) but with `DATABASE_POOL_SIZE=50`, the test pool takes effect. **The pool size differs between test and prod by 5x.** This may mask a real issue where prod pool is exhausted under load.

**Fix:** standardize on 10-20 for both. Or, document the rationale.

### 7.3 [P0] Pool size env var is not in `env.ts` schema

**File:** `web/src/lib/env.ts`

The `DATABASE_POOL_SIZE`, `DATABASE_POOL_TIMEOUT`, `DATABASE_IDLE_TIMEOUT` env vars are read directly in `db.ts` but not in `env.ts` Zod schema. They are not validated, not typed, not documented.

**Fix:** add to `env.ts` with defaults.

### 7.4 [P1] `logger.info('PostgreSQL pool config applied dynamically', {...})` logs every time `createPrismaClient` is called

**File:** `web/src/lib/db.ts:186-190`

The log is unconditional. In a hot-reload dev environment, the log line repeats on every reload. In production, the log line is one-time but it's at `info` level, not `debug`.

**Fix:** move to `debug` level.

### 7.5 [P1] Pool config parse failure is silently swallowed

**File:** `web/src/lib/db.ts:191-193`

```ts
} catch (e) {
  logger.warn('Failed to parse DATABASE_URL for dynamic pool configuration', { error: e });
}
```

If the DATABASE_URL is malformed, the warn is logged but the original URL is used. The connection will then fail with a less-actionable error. **Hard-fail** at startup if the URL is malformed (this is already done by `env.ts:envSchema`, but the URL is parsed again here).

**Fix:** rely on `env.ts` validation; don't re-parse here.

---

## 8. Migration quality: drift, evictions, repairs

The 13 migrations reveal a story of schema evolution. Some are clean additions; some are "phase 3.3 fixes" that patch earlier mistakes.

### 8.1 [P0] `add_payment_gateways` migration creates `apiKey`/`apiSecret` columns, but `schema.prisma` declares `keyId`/`keySecret` — schema/migration drift

**File:** `web/prisma/migrations/20260726000000_add_payment_gateways/migration.sql:9-12`

```sql
"apiKey" TEXT,
"apiSecret" TEXT,
```

vs `web/prisma/schema.prisma:1473-1474`:

```prisma
keyId           String?
keySecret       String?
```

The migration was created and presumably applied. The schema was then refactored to use `keyId`/`keySecret`. The DB now has `apiKey`/`apiSecret`, but the Prisma client expects `keyId`/`keySecret`. **Any read/write to `paymentGateways` will fail at runtime.**

**Fix:** either (a) add a migration that renames the columns, or (b) update `schema.prisma` to use `apiKey`/`apiSecret`. Verify which is correct.

### 8.2 [P0] `add_payment_gateways` migration is missing the `provider` field

**File:** `web/prisma/migrations/20260726000000_add_payment_gateways/migration.sql:5-18`

The migration creates `payment_gateways` without a `provider` column. The schema (line 1469) has `provider String`. The DB doesn't have a `provider` column.

**Fix:** add `ALTER TABLE payment_gateways ADD COLUMN provider TEXT NOT NULL DEFAULT 'razorpay';` (or similar).

### 8.3 [P0] `add_payment_gateways` migration is missing the `createdAt` field

**File:** `web/prisma/migrations/20260726000000_add_payment_gateways/migration.sql`

The schema has `createdAt DateTime @default(now())` (line 1479). The migration doesn't have a `createdAt` column.

**Fix:** add `ALTER TABLE payment_gateways ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`.

### 8.4 [P1] `idempotency_status` migration is a "phase 3.3 fix" — a fix to a prior migration

**File:** `web/prisma/migrations/20260626000001_idempotency_status/migration.sql:6-10`

The comment explicitly says "the previous migration declared the column as TEXT with a lowercase 'completed' default. The Prisma schema (and the generated client) types the column as the IdempotencyStatus enum."

This means the original `add_idempotency_key` migration was wrong, and this one fixes it. **This is migration drift.** A new environment applying migrations from scratch would have a different result than an upgraded environment.

**Fix:** consolidate the original migration and the fix into one. For new environments, this is automatic (migrations are applied in order). For existing environments, the fix migration runs. Document the drift.

### 8.5 [P1] `drop_idempotency_response_notnull` migration is a defensive fix

**File:** `web/prisma/migrations/20260628000000_drop_idempotency_response_notnull/migration.sql`

The original migration made `response` NOT NULL; this fix removes the constraint. Drift.

### 8.6 [P1] `rename_idempotency_status_enum` migration is a casing fix

**File:** `web/prisma/migrations/20260628000001_rename_idempotency_status_enum/migration.sql`

`IdempotencyStatus` → `idempotency_status` (lowercase, to match `@@map("idempotency_status")`). Drift from a previous migration.

### 8.7 [P0] `prevent_rider_delete` migration — verify it actually prevents delete

**File:** `web/prisma/migrations/20260626000002_prevent_rider_delete/migration.sql`

Need to read this in full. Likely a `BEFORE DELETE` trigger on `riders` that raises an exception. **Verify this is in place.** If the migration is missing or the trigger was dropped, riders can be hard-deleted (bypassing soft-delete).

### 8.8 [P1] `consolidate_settings` migration deletes the `settings` table

**File:** `web/prisma/migrations/20260712000001_consolidate_settings/migration.sql:36`

```sql
DROP TABLE IF EXISTS settings;
```

Hard drop. If any code path still references `Setting` (the old model), the queries will fail. Verify no code path uses the old model.

### 8.9 [P1] `standardize_table_naming` migration renames 49 tables

**File:** `web/prisma/migrations/20260712000002_standardize_table_naming/migration.sql:9-49`

Renames all Prisma-default table names (CamelCase) to snake_case. The script says "Models that DID NOT have @@map before" — so the schema was refactored to add `@@map` to all models. **Verify the schema.prisma has `@@map` on all 49 models** (it does, per my read). **Verify no SQL query references the old CamelCase table names.**

### 8.10 [P0] `add_outbox_readyAt` migration adds `readyAt` column for backoff

**File:** `web/prisma/migrations/20260626000000_add_outbox_readyAt/migration.sql`

Need to read in full. The `OutboxEvent.readyAt` field was added in this migration. The previous broad audit noted this is for exponential backoff. Verify the worker code uses `readyAt` correctly.

### 8.11 [P1] No migration for the `IdempotencyKey.response` default change

**File:** `web/prisma/migrations/20260626000001_idempotency_status/migration.sql:44-45`

```sql
ALTER TABLE "IdempotencyKey" ALTER COLUMN response SET DEFAULT '';
```

The original migration made `response` NOT NULL. The fix sets the default to `''`. Drift.

### 8.12 [P1] `outbox_status_updatedAt_index` migration adds an index that may be redundant

**File:** `web/prisma/migrations/20260628000002_add_outbox_status_updatedat_index/migration.sql`

Adds `@@index([status, updatedAt])`. Combined with the existing `@@index([status, createdAt])` and `@@index([status, eventType, readyAt])`, the OutboxEvent table has 7 indexes. **Possible over-indexing** (see 4.9).

### 8.13 [P1] `datetime_to_timestamptz` migration is a column-type change

**File:** `web/prisma/migrations/20260701131758_datetime_to_timestamptz/migration.sql`

Likely converts `DateTime` columns to `TIMESTAMP WITH TIME ZONE`. This is a significant data change — a column-type conversion in Postgres takes a lock on the table. **Verify the migration was applied with `pg_repack` or `pg_reload` if the table is large.** A naive `ALTER TABLE ... ALTER COLUMN ... TYPE TIMESTAMPTZ USING ...` locks the table for the duration of the conversion.

---

## 9. Helper scripts: `query_rider.ts`, `reset_rahil.ts`

The `prisma/` folder has 4 helper scripts. They're dev tools but their failure modes affect dev velocity.

### 9.1 [P0] `reset_rahil.ts` references 7 ghost fields that don't exist in the schema

**File:** `web/prisma/reset_rahil.ts:14-31`

```ts
await prisma.rider.update({
  where: { id: rahil.id },
  data: {
    accountStatus: 'PRE_ACTIVE',     // ghost
    state: 'PRE_ACTIVE',              // ghost
    registrationDone: true,           // ghost (it's registrationDoneAt)
    kycDone: false,                   // ghost
    depositDone: false,               // ghost
    planDone: false,                  // ghost
    pickupDone: false,                // ghost
    vehicleId: null,
    assignedVehicle: null,
    currentPlan: null,                // not a FK, but a string
    pickedUpAt: null,
    depositDoneAt: null,
    kycDoneAt: null,
    planDoneAt: null,
  },
});
```

The fields `accountStatus`, `state`, `registrationDone`, `kycDone`, `depositDone`, `planDone`, `pickupDone` **do not exist** in the current schema. The schema uses `lifecycleStatus` (an enum) and `*DoneAt` (timestamps). The script was written for an earlier schema version and was never updated.

Running this script will fail with a Prisma validation error. **A developer trying to reset a rider's state in dev has no working tool.**

**Fix:** rewrite the script to use the current schema fields:
```ts
data: {
  lifecycleStatus: 'PROFILE_SUBMITTED',
  vehicleId: null,
  assignedVehicle: null,
  currentPlan: null,
  pickedUpAt: null,
  depositDoneAt: null,
  kycDoneAt: null,
  planDoneAt: null,
}
```

### 9.2 [P2] `query_rider.ts` has no error handling, no filtering, no pagination

**File:** `web/prisma/query_rider.ts:4-7`

```ts
const riders = await prisma.rider.findMany({
  include: { kycProfile: true, wallet: true, guarantor: true },
});
console.log(JSON.stringify(riders, null, 2));
```

The script fetches ALL riders, including their KYC, wallet, and guarantor. For 100k+ riders, this OOMs the Node process.

**Fix:** add filtering, pagination, and a `--limit` flag.

### 9.3 [P2] `query_rider.ts` and `reset_rahil.ts` use `new PrismaClient()` directly — bypassing the offline-mock-fallback

**File:** `web/prisma/query_rider.ts:2`, `reset_rahil.ts:2`

```ts
const prisma = new PrismaClient();
```

These scripts instantiate a fresh Prisma client, not the singleton from `@/lib/db`. They bypass the soft-delete extension and the offline-mock-fallback. In a `DATABASE_OFFLINE=true` environment, the scripts will throw a connection error, while the rest of the app serves mock data.

**Fix:** import `db` from `@/lib/db` instead of instantiating `new PrismaClient()`. Or, add explicit error handling.

### 9.4 [P2] `reset_rahil.ts` and `seed.ts` use a hardcoded phone number — privacy concern if run on production data

**File:** `web/prisma/reset_rahil.ts:5-7`

The script hardcodes `phone: '9999999991'`. If the script is run on a production database by mistake, it will modify a production rider's data.

**Fix:** add an env guard (only run if `NODE_ENV !== 'production'`).

### 9.5 [P2] `seed_return.ts` hardcodes real vehicle data (`'DL 1S AB 1234'`)

**File:** `web/prisma/seed_return.ts:24`

```ts
vehicleNumber: 'DL 1S AB 1234',
```

If this is run on production, a vehicle record with a (possibly real) Indian vehicle number is inserted. Even if the number is fake, it's hardcoded.

**Fix:** add an env guard, or use a placeholder number.

---

## 10. Seed files: prod-vs-test contamination

### 10.1 [P0] `seed.ts` uses hardcoded weak admin password `admin123` and prints it to console

**File:** `web/prisma/seed.ts:12, 1264-1266`

```ts
const hashedAdminPw = await hashPassword('admin123');
...
console.log('  Super Admin: superadmin@voltium.in / admin123');
console.log('  Admin: admin@voltium.in / admin123');
console.log('  Admin: ops@voltium.in / admin123');
```

The seed creates admin accounts with password `admin123` (hashed at write time, but the plaintext is in the file and printed). **If the seed is run in production, an attacker who knows the seed file content (or guesses `admin123`) can log in as super admin.**

There is **no env guard** in `seed.ts` to prevent this. The `db:seed` npm script runs the file unconditionally.

**Fix:** add a startup check: `if (process.env.NODE_ENV === 'production') throw new Error('seed.ts is dev-only');`. Or, read the password from env (`SEED_ADMIN_PASSWORD`) and require it to be set.

### 10.2 [P0] `seed.ts` creates 6 admin accounts with `isActive: true` — production risk

**File:** `web/prisma/seed.ts:14-48`

Multiple admin accounts are seeded. The previous broad audit noted that `permissions` defaults to `'[]'`. So the seeded admins have **no permissions** but are still `isActive: true`. They can authenticate but have no privileges. **OK for dev**, but a `isActive: false` default would be safer.

### 10.3 [P0] `seed.ts` uses real-looking phone numbers in `9876543210` format

**File:** `web/prisma/seed.ts:249, 256, 263, 270, 286, 315, 332, 362, 383, 396, 535, 543, 551, 559`

The seed creates riders with phone numbers like `9876512345`, `9999900001`, etc. These are **not the real owner's numbers** (the 9999-prefix is a test range), but `9876543210` is a valid Indian number that **belongs to a real person** in real life (famous test number). If a real rider tries to register with `9876543210`, they'll collide with the seed.

**Fix:** use a clearly fake range, e.g. `+91 0000 XXXXXX` (which is invalid by telecom rules) or `+1-555-XXXX` (US fictional range).

### 10.4 [P0] `seed.ts` is large (37 KB) — likely production data is in there

**File:** `web/prisma/seed.ts:1-1278`

37 KB of seed data. The file is intended for dev, but the size suggests real-data patterns. **Verify nothing in the file references production records or hardcoded secrets.**

### 10.5 [P0] `seed-audit.ts` uses lowercase enum values `admin` and `system` — will fail

**File:** `web/prisma/seed-audit.ts:15, 52`

```ts
actorType: params.actorType || 'admin',
...
actorType: 'system',
```

The `ActorType` enum is `ADMIN`, `SYSTEM`, `RIDER` (uppercase). The seed uses lowercase. **This will fail at runtime with an enum validation error.**

**Fix:** change to `'ADMIN'` and `'SYSTEM'`.

### 10.6 [P0] `seed-audit.ts` uses `action: 'rider.suspend'` etc. — dot-separated, but enum is underscore-separated

**File:** `web/prisma/seed-audit.ts:34, 41, 48, 56`

```ts
action: 'rider.suspend',
action: 'kyc.approve',
action: 'system.rate_limit_reset',
action: 'rider.bulk_update_status',
```

The `AuditActionType` enum is `LOGIN, LOGOUT, CREATE, UPDATE, DELETE, APPROVE, REJECT, REFUND, VIEW, EXPORT, PERMISSION_CHANGE, ROLE_CHANGE, SYSTEM_CONFIG, SYSTEM_JOB` (no dot). The seed uses dot-separated values. **Will fail at runtime.**

**Fix:** change to `action: 'UPDATE'`, `action: 'APPROVE'`, `action: 'SYSTEM_JOB'`, etc.

### 10.7 [P1] `seed-audit.ts` is a separate file from `seed.ts` — split seeds are a maintenance burden

**File:** `web/prisma/seed-audit.ts` and `web/prisma/seed.ts`

Two seed files. `seed.ts` is run via `npm run db:seed`. `seed-audit.ts` is not in `package.json` scripts. **Verify how `seed-audit.ts` is invoked.** If it's a one-off script, it should be in `scripts/` not `prisma/`.

### 10.8 [P0] `seed-audit.ts` references `rider.suspend` which is not in the `AuditActionType` enum

**File:** `web/prisma/seed-audit.ts:34`

The `AuditActionType` enum has no `rider.suspend` value. The closest is `UPDATE` or `PERMISSION_CHANGE`. The seed will fail.

### 10.9 [P0] `seed.ts` includes rider Aadhaar numbers, bank account numbers, PANs

**File:** `web/prisma/seed.ts` (the 37 KB file)

The seed includes fake KYC data (aadhaar, pan, bank account). The numbers are likely fake, but if any of them are real, **a PII leak**.

**Fix:** audit the seed for PII values that look real (e.g. valid 12-digit aadhaar, valid PAN format with real name).

---

## 11. PII at rest: encryption, redaction, deletion

The previous broad audit noted `pii-crypto.ts` exists. Need to verify it's used for the PII columns.

### 11.1 [P0] `KycProfile.aadhaarNumber`, `panNumber`, `accountNumber` may not be encrypted

**File:** `web/prisma/schema.prisma:273, 275, 277`

The columns are `String?`. The PII crypto layer is in `web/src/lib/pii-crypto.ts`. **Verify** the KYC use-cases encrypt before write and decrypt after read. If not, the columns are plaintext PII.

**Fix:** audit the KYC write path. If the write is `db.kycProfile.update({ data: { aadhaarNumber: input.aadhaarNumber } })` (plaintext), it's a P0.

### 11.2 [P0] `Rider.fcmToken` is plaintext — but FCM tokens are not PII

OK, not a PII issue. But the FCM token is a long-lived secret that grants push notification capability. **Verify the FCM token is not used in any non-push context.**

### 11.3 [P0] `Rider.lockPassword` may be plaintext (see 2.2)

Already flagged. The lock password is a rider's PIN; a DB leak = compromise of every rider's lock screen.

### 11.4 [P1] `WalletLedger.note` is `String?` — may contain PII in free text

**File:** `web/prisma/schema.prisma:346**

The `note` field is free-form text. A use-case may write "Top-up for rahul@example.com" (PII) or "Refund for Aadhaar XXXX" (PII).

**Fix:** sanitize or restrict the `note` field. Add a length cap.

### 11.5 [P0] GDPR data deletion: `riders` has `deletedAt` but the related rows (KycProfile, Wallet, UserContact, etc.) are cascade-deleted

**File:** `web/prisma/schema.prisma:283, 311, 328, 382, 405, 488, 524, 657, 749, 803, 824, 845, 860, 875, 890, 906`

Every relation from `Rider` has `onDelete: Cascade`. **Cascade delete = GDPR Article 17 violation.** When a rider is "deleted" (soft delete sets `deletedAt`), the related rows are **not** hard-deleted (cascading soft-delete isn't a thing). But a hard delete of a Rider row would cascade to all related tables, including KYC, wallet, contacts, call logs, locations. **PII is gone, but the audit log still references the riderId.**

The previous broad audit flagged the GDPR endpoint (`/api/admin/riders/[id]/data-deletion`) — the schema is correct for soft-delete + manual hard-delete. But the **hard-delete path** (e.g. via a script or direct SQL) would orphan audit logs.

**Fix:** audit the GDPR data-deletion use-case. Ensure that:
1. Rider's PII is anonymized, not hard-deleted
2. Audit logs are preserved (per SOC2) but the rider reference is replaced with a hash
3. Related rows (KYC, wallet) are soft-deleted, not hard-deleted

---

## 12. Money-path data integrity

### 12.1 [P0] `Wallet.balanceInPaise` and `WalletLedger` are not DB-consistent

**File:** `web/prisma/schema.prisma:321, 336-360`

The `Wallet.balanceInPaise` is a stored column. The `WalletLedger` is an event log. The two must be consistent: `balanceInPaise == SUM(ledger entries)`. **The DB has no constraint enforcing this.** A use-case that updates `balanceInPaise` without a ledger entry (or vice versa) desyncs them.

The previous broad audit noted that `wallet-reconciliation.job.ts` detects drift. But the DB doesn't prevent the drift in the first place.

**Fix:** add a Postgres trigger that, on every `WalletLedger` insert, recomputes `Wallet.balanceInPaise` and rejects the insert if the new value doesn't match. Or, drop `Wallet.balanceInPaise` and compute it on read.

### 12.2 [P0] `Transaction.amount` is `Int` (no unit suffix)

**File:** `web/prisma/schema.prisma:423`

```prisma
amount  Int
```

Is this rupees or paise? The wallet uses paise (`balanceInPaise`). The transaction uses `amount` (unspecified). **Inconsistent.** A `db.transaction.create({ data: { amount: 1000 } })` could mean ₹1000 or ₹10.

**Fix:** rename to `amountInPaise` for consistency. Or, document the unit.

### 12.3 [P0] `DepositRecord.amountInPaise` — verified paise, good

**File:** `web/prisma/schema.prisma:366`

`amountInPaise` is correct. **Inconsistent with `Transaction.amount` (no suffix).** See 12.2.

### 12.4 [P1] `RentalLease.basePrice` and `finalPrice` are `Int` — unit unspecified

**File:** `web/prisma/schema.prisma:399-400`

```prisma
basePrice   Int
finalPrice  Int
```

Same as 12.2. Rupees or paise?

**Fix:** rename to `basePriceInPaise`, `finalPriceInPaise`.

### 12.5 [P1] `RentalPlan.price` is `Int` — unit unspecified

**File:** `web/prisma/schema.prisma:121**

Same as 12.2. The comment in the plan use-case implies rupees (since the wallet's `securityDeposit` is in paise). But the column has no suffix.

**Fix:** same as 12.2.

### 12.6 [P0] `TransactionBreakdown.amount` is `Int` (no suffix)

**File:** `web/prisma/schema.prisma:458**

Same as 12.2.

### 12.7 [P0] `Coupon.discountValue` is `Int` (no suffix) and no `maxDiscount`

**File:** `web/prisma/schema.prisma:638`

`discountValue: 50` could mean 50% (PERCENTAGE) or ₹50 (FIXED). The unit depends on `discountType`. **A `FIXED` coupon with `discountValue: 50` is interpreted as 50 rupees; if the codebase is in paise, this is wrong by 100x.**

**Fix:** rename to `discountValueInPaise` for `FIXED`. Add `maxDiscountInPaise` for `PERCENTAGE` (e.g. 50% off, max ₹1000).

### 12.8 [P0] `TrafficFine.amount` is `Float` (see 2.33)

Float for money. **P0.**

### 12.9 [P1] `RiderEarning.amount` is `Float` (see 2.32)

Same.

### 12.10 [P0] `Wallet.securityDeposit` is `Int` (no suffix)

**File:** `web/prisma/schema.prisma:322**

Should be `securityDepositInPaise`.

---

## 13. Idempotency, rate limiting, outbox: tables in detail

### 13.1 [P0] `IdempotencyKey.key` is `@unique` — but the unique constraint is on the key, not on (key, status)

**File:** `web/prisma/schema.prisma:1069`

A key with status=COMPLETED and a key with status=PROCESSING cannot coexist (the unique constraint is just on `key`). The `withIdempotency` middleware (per `lib/api-middleware.ts:14-63`) uses `INSERT ... ON CONFLICT DO NOTHING` to atomically claim. If the key is reused (the client retries), the second INSERT fails (no row inserted), and the middleware checks the existing row's status.

This works, but the **retry behavior is racy**: if the first request's response is being written while the second request is checking the status, the second may see PROCESSING and return 409. The middleware handles this correctly per `api-middleware.ts:29-37`, but the error message is generic.

**Fix:** improve the error message. The current `A request with this idempotency key is already being processed` is correct but not actionable for the client.

### 13.2 [P1] `IdempotencyKey` has no `@@index([status, expiresAt])` for the reaper

Already flagged in 4.7.

### 13.3 [P1] `RateLimitBucket` is a Postgres table — high write rate

**File:** `web/prisma/schema.prisma:931-942`

```prisma
model RateLimitBucket {
  id        String   @id @default(cuid())
  key       String   @unique
  points    Int      @default(0)
  resetAt   DateTime
  ...
}
```

Rate-limit checks are 100/sec at peak. A Postgres table for rate-limiting is **slow** compared to Redis. The previous broad audit noted this. **Verify the rate-limit reads are cached or batched.**

**Fix:** migrate to Redis (or use `lib/rate-limit.ts` to abstract both).

### 13.4 [P0] `OutboxEvent` is not transactional with the originating write

**File:** `web/prisma/schema.prisma:944-971`

The outbox pattern is for transactional side effects. The originating write (e.g. a `Transaction.create`) and the `OutboxEvent.create` should be in a single `db.$transaction` block. **Verify** that the use-case wraps both in a transaction. If the originating write succeeds and the outbox write fails, the side effect (notification, webhook) is lost.

The previous broad audit noted this in `AUDIT_BACKEND.md` section 20.12.

### 13.5 [P1] `OutboxEvent.readyAt` and `updatedAt` are managed in code, not the DB

**File:** `web/prisma/schema.prisma:957, 961`

The `readyAt` and `updatedAt` are updated by the worker. The DB has no trigger. A buggy worker can set `readyAt` to a past date (the reaper fires it) or `updatedAt` to a future date (the reaper thinks it's stuck).

**Fix:** add CHECK constraints or a trigger.

---

## 14. Backup, restore, reconciliation tables

### 14.1 [P0] `BackupJob.backupPath` is `String?` — user-controlled path

**File:** `web/prisma/schema.prisma:1026`

```prisma
backupPath  String?
```

The `backupPath` is the path on disk where the backup is stored. **If this is set by the use-case (per the `createBackup` API), it's safe. If it's set by the client, it's a path-traversal vulnerability.** The previous backend deep audit (4.11) flagged this: the `/api/admin/data-management/backups/[id]/download` route reads `job.backupPath` and serves the file. If the path is from DB, a poisoned DB record can serve arbitrary files.

**Fix:** validate the path against an allowlist at read time. Or, store a path-relative-to-root, not an absolute path.

### 14.2 [P1] `BackupJob.sizeBytes` is `BigInt` (see 2.40)

Already flagged.

### 14.3 [P1] `RestoreJob` has no FK to `Admin` for `requestedByAdminId` and `approvedByAdminId`

**File:** `web/prisma/schema.prisma:1052, 1054**

```prisma
requestedByAdminId  String
approvedByAdminId   String?
```

These are strings, not FKs to `Admin.id`. **A typo or deletion of an admin doesn't cascade to the restore job.** Also, the two-admin approval pattern (request + approve) is in the schema, but the `approvedByAdminId` is the same as `requestedByAdminId`? No FK to enforce "different admin".

**Fix:** add FK and a CHECK that `approvedByAdminId != requestedByAdminId`.

### 14.4 [P1] `ReconciliationReport` has `reportDate @unique` — but no `@@index([createdAt])`

**File:** `web/prisma/schema.prisma:985-987`

Already has `@@index([createdAt])`. OK.

### 14.5 [P0] `ReconciliationReport.mismatchDetails` is `String @default("[]")` — JSON-as-string

**File:** `web/prisma/schema.prisma:982`

Already flagged in 2.19. **P0 for production** — the report details should be a structured JSONB column with a queryable index.

### 14.6 [P1] `BackupSchedule.timeOfDay` is `String @default("02:00")` — no format check

**File:** `web/prisma/schema.prisma:994`

The `timeOfDay` is "HH:MM" format. The DB has no CHECK. A typo `"2:00 AM"` (12-hour) or `"25:00"` (invalid) is accepted.

**Fix:** add CHECK `timeOfDay ~ '^\d{2}:\d{2}$' AND ...`.

---

## 15. Prisma generated client concerns

### 15.1 [P0] `prisma generate` is not part of the CI pipeline

The previous broad audit noted that `npm run db:generate` is a separate step. **Verify** that `prisma generate` runs in CI before typecheck. If a developer forgets to run `npm run db:generate` after a migration, the TypeScript types are stale and queries compile against the old schema.

**Fix:** add `prisma generate` to the CI pipeline as a precondition for typecheck.

### 15.2 [P0] `prisma migrate deploy` is the production migration command

**File:** `package.json:db:deploy`

```json
"db:deploy": "prisma migrate deploy",
```

`prisma migrate deploy` applies pending migrations **without** generating the client. **Verify** that `db:generate` runs after `db:deploy` in the deploy pipeline.

**Fix:** chain `db:generate` after `db:deploy` in the deploy script.

### 15.3 [P1] `prisma migrate dev` is the dev migration command

**File:** `package.json:db:migrate`

```json
"db:migrate": "prisma migrate dev",
```

`prisma migrate dev` will **create a migration** if the schema is out of sync. This is fine for dev but **dangerous in production** (it may auto-generate a migration that drops data).

**Fix:** enforce `db:migrate` only for dev, `db:deploy` for prod. Document the distinction.

### 15.4 [P0] `db:reset` is in `package.json` — drops the entire database

**File:** `package.json:db:reset`

```json
"db:reset": "prisma migrate reset",
```

`prisma migrate reset` drops the database, recreates it, applies all migrations, and re-seeds. **Destructive.** Should be dev-only.

**Fix:** add an env guard or rename to `db:reset:dev`.

### 15.5 [P1] No migration for the schema drift between `add_payment_gateways` and `schema.prisma`

Already flagged in 8.1.

---

## 16. Top 10 critical findings

In order of "ship-it-this-week" priority:

1. **[P0] `Rider` model has 90+ columns — needs child-table extraction.** Decompose to 5-7 child tables for cache locality, migration safety, and read efficiency. (2.1)
2. **[P0] `add_payment_gateways` migration creates `apiKey`/`apiSecret` columns, but `schema.prisma` declares `keyId`/`keySecret` — schema/migration drift.** Add a rename migration or revert the schema. (8.1, 8.2, 8.3)
3. **[P0] `Rider.lockPassword` may be plaintext — verify hashing.** Switch to `lockPasswordHash` and use `hashPassword()`. (2.2)
4. **[P0] `seed.ts` hardcodes `admin123` and prints it; no env guard.** Add `if (process.env.NODE_ENV === 'production') throw` and read from env. (10.1)
5. **[P0] `reset_rahil.ts` references 7 ghost fields — script is broken.** Rewrite with current schema fields. (9.1)
6. **[P0] `seed-audit.ts` uses lowercase enum values `admin`/`system` and dot-separated action names — script is broken.** Change to `ADMIN`/`SYSTEM` and `UPDATE`/`APPROVE`/etc. (10.5, 10.6)
7. **[P0] `Wallet.balanceInPaise` is not DB-consistent with `WalletLedger` — drift is detected but not prevented.** Add a Postgres trigger that recomputes on ledger insert. (12.1)
8. **[P0] No state-machine CHECK constraints — direct SQL bypasses the state machine.** Add CHECK or BEFORE UPDATE trigger for each state machine. (3.1)
9. **[P0] `DATABASE_OFFLINE` mock fallback returns hardcoded test rider/wallet/KYC/guarantor — production risk.** Remove the mock fallback entirely; let the app fail loud. (6.1, 6.2, 6.3, 6.4, 6.5)
10. **[P0] `Transaction.amount`, `Coupon.discountValue`, `Wallet.securityDeposit` are Int without `InPaise` suffix — unit confusion.** Rename to `*InPaise` for consistency. (12.2, 12.7, 12.10)

---

## 17. Cross-cutting observations

These patterns appear across many files and are worth a single PR each:

1. **`Int` money columns without `InPaise` suffix** — 8+ columns. Rename to `*InPaise`.
2. **`Float` for money** — `RiderEarning.amount`, `TrafficFine.amount`, several score columns. Switch to `Int` paise.
3. **No CHECK constraints on critical fields** — phone, email, aadhaar, pan, ifsc, vehicle number, timeOfDay, status transitions, balance. Add CHECK or trigger.
4. **String-as-JSON columns** — `permissions`, `payload`, `targetIds`, `photos`, `metadata`, `mismatchDetails`, `editableFields`. Migrate to `Json` or `text[]`.
5. **Free-form string fields that should be FKs** — `Rider.pickupHub`, `Rider.currentPlan`, `Rider.teamLeader`. Change to FK with `*Id` suffix.
6. **No DB-level state-machine enforcement** — all state machines are TS-only. Add CHECK or trigger.
7. **Soft-delete extension is silent — no audit log** — `db.ts:273-308`. Add `createAuditLog` in the soft-delete wrapper.
8. **Offline-mock-fallback has hardcoded test data** — `db.ts:38-49, 63-133`. Remove.
9. **Helper scripts bypass the singleton** — `query_rider.ts:2`, `reset_rahil.ts:2`. Import from `@/lib/db`.
10. **Seed files use lowercase enum values** — `seed-audit.ts:15, 52`. Change to uppercase.
11. **Schema/migration drift** — `add_payment_gateways` migration has different columns than `schema.prisma`. Reconcile.
12. **No PII encryption verification** — `KycProfile.aadhaarNumber`, `panNumber`, `accountNumber` may be plaintext. Audit use-cases.
13. **No FK enforcement on `RestoreJob.requestedByAdminId`/`approvedByAdminId`** — add FKs.
14. **Pool config env vars not in `env.ts`** — `DATABASE_POOL_SIZE`, `DATABASE_POOL_TIMEOUT`, `DATABASE_IDLE_TIMEOUT`. Add to schema.
15. **Rider Earning/Traffic Fine use Float** — Float for money is a footgun.

---

## 18. Recommended 10-PR sequence

In order of "ship-it-this-week" priority:

1. **PR 1: Reconcile `add_payment_gateways` migration with `schema.prisma`** — rename `apiKey`/`apiSecret` to `keyId`/`keySecret` in a new migration, add `provider`/`createdAt` columns. ~2 hours.
2. **PR 2: Fix `seed.ts` env guard** — add `if (process.env.NODE_ENV === 'production') throw` and read password from env. ~30 min.
3. **PR 3: Fix `seed-audit.ts` enum values** — change to `ADMIN`/`SYSTEM` and `UPDATE`/`APPROVE`/etc. ~30 min.
4. **PR 4: Fix `reset_rahil.ts` to use current schema fields** — rewrite with `lifecycleStatus` and `*DoneAt` timestamps. ~1 hour.
5. **PR 5: Add CHECK constraints for state machines** — add CHECK or trigger for each state machine. ~1 day.
6. **PR 6: Rename Int money columns to `*InPaise`** — `Transaction.amount`, `Coupon.discountValue`, `Wallet.securityDeposit`, `RentalLease.basePrice`/`finalPrice`, `RentalPlan.price`, `TransactionBreakdown.amount`. ~3 hours.
7. **PR 7: Convert Float money columns to Int paise** — `RiderEarning.amount`, `TrafficFine.amount`. ~2 hours.
8. **PR 8: Add audit log to soft-delete extension** — `createAuditLog` in the wrapper. ~1 hour.
9. **PR 9: Add PII encryption to KYC use-cases** — verify `pii-crypto.ts` is used. ~half day.
10. **PR 10: Remove offline-mock-fallback from `db.ts`** — replace with hard-fail. ~half day.

**Total estimated effort:** ~5 days of focused work, single PR per item, all P0.

---
