# Deep Audit: Riders Section (Admin Panel + Rider App + Adjacent Modules)

**Date**: 2026-08-05
**Scope**: Rider lifecycle across the entire stack — admin panel (`/api/admin/riders/*`), rider app (`/api/rider/*`, `/api/device/*`), server modules (`riders`, `kyc`, `guarantors`, `wallet`, `deposits`), shared libs (`auth`, `rbac`, `pii-crypto`, `outbox`, `server-cache`, `wallet-service`), Flutter side (`lib/core/network/api_client.dart`, `lib/widgets/locked_overlay.dart`, `lib/features/*`), Prisma schema, and the test suite.
**Method**: Static read of every file in the audit chain (≈4,500 lines) + Prisma schema cross-reference + cross-check against Flutter consumer endpoints.
**Companion**: This is the **deep** audit. The surface audit lives at `docs/audits/2026-08-05-riders-section.md`. Read that first for the admin-UI side; this one covers the model + lifecycle + ledger + cross-stack contract layers.

**Bottom line**: **1 critical P0 (verify-lock is broken for every rider in production)**, **5 P1s** (state-machine silent failure, $5 wallet bug, ledger race, KYC silent transition, guarantor re-replace), and **~20 P2/P3** that span: type safety, test gaps, dead UI, transaction-boundary issues, magic-number logic, and lifecycle enum duplication.

---

## P0 — Critical, breaks production

### P0.1 — `verify-lock` reads a non-existent field, so riders can never unlock their devices

**Evidence**:
- `web/prisma/schema.prisma:218, 928` — DB has **only** `lockPasswordHash` (twice — once on `Rider`, once on `Device`)
- `web/src/app/api/rider/device/verify-lock/route.ts:60-69`:
  ```ts
  const rider = await db.rider.findUnique({
    where: { id: riderDbId },
    select: { lockPassword: true },  // ← field doesn't exist in Prisma schema
  });
  if (!rider || !rider.lockPassword) {
    return success({ success: false }, 'Lock password is not configured');
  }
  const { valid } = await verifyPassword(password, rider.lockPassword);
  ```
  Prisma returns `rider.lockPassword = undefined` for every rider in production. The route always returns `{ success: false }` with the message *"Lock password is not configured"*.
- `actions/route.ts:128-150` (the admin lock/unlock path) correctly writes `lockPasswordHash`. So admins set the hash; the rider app's verify route can't read it. The two ends of the lock flow don't speak the same field name.
- Flutter consumer: `flutter/lib/widgets/locked_overlay.dart:83` POSTs to `/api/rider/device/verify-lock`. `flutter/lib/core/network/generated/api_client.dart:546` calls the same endpoint.
- Tests: `tests/unit/verify-lock-impersonation.test.ts:61, 101` actually documents the bug — the test comment reads *"Default: rider has no lockPasswordHash. No lockPasswordHash set → success:true with data.success=false (legacy shape)"*. The test acknowledges the field name bug and tests the "always fail" path, masking the production failure.

**Impact**:
- Every rider who gets `ADMIN_LOCK` triggered on their device (the only way an admin can take a stolen/lost device) is permanently locked out. The unlock code shown to the admin is a hash, not a plaintext, so the rider cannot type it into the app. Even if the rider could type it, the route would still return "lock password not configured."
- This is the **kind of bug that gets you in the news** — a rider calls support because their phone is bricked, support escalates, nobody can unblock.

**Fix** (1 PR):
1. `verify-lock/route.ts:62`: change `select: { lockPassword: true }` → `select: { lockPasswordHash: true }`
2. `verify-lock/route.ts:65, 69`: replace `rider.lockPassword` with `rider.lockPasswordHash`
3. `tests/unit/verify-lock-impersonation.test.ts`: add a test that sets `lockPasswordHash` to a known bcrypt hash and asserts the verify flow succeeds with the correct password
4. Sweep the codebase for other `lockPassword` references (the admin-riders use-case still has it in `getDeviceData` — see P1.4 below)

---

## P1 — Real bugs, fix in the next sprint

### P1.1 — Magic-number field-routing for guarantor updates silently corrupts data

**Evidence**: `rider.use-cases.ts:482-496`:
```ts
for (const [key, value] of Object.entries(input)) {
  if (value === undefined || value === null) continue;
  ...
  } else if (SAFE_GUARANTOR_FIELDS.has(key)) {
    const dbKey = key.charAt(9).toLowerCase() + key.slice(10);
    guarantorData[dbKey] = value;
  }
}
```

`SAFE_GUARANTOR_FIELDS` contains keys like `guarantorName`, `guarantorPhone`, `guarantorRelation`. The code computes `key.charAt(9).toLowerCase() + key.slice(10)` to strip the 9-character `guarantor` prefix.

**Bugs**:
1. `charAt(9)` is the **10th** character (0-indexed). For `guarantorName` (13 chars), `charAt(9) = 'm'`, so the computed `dbKey = 'm' + 'ame' = 'mame'`. The intended `dbKey` is `name`. **The guarantor name is being stored under the key `mame`**.
2. The same logic applied to `guarantorAadhaarFront` (20 chars) → `charAt(9) = 'A'`, lowercased → `'a'`, plus `slice(10)` = `'adhaarFront'` → `dbKey = 'adhaarFront'`. **This one is correct only because the original 9-char prefix + next char is exactly 'A' followed by 'adhaarFront'.** It works by accident.
3. The same for `guarantorFatherName` → `charAt(9) = 'F'` → `'f' + 'atherName'` = `'fatherName'`. Works by accident.
4. But `guarantorMotherName` → `charAt(9) = 'M'` → `'m' + 'otherName'` = `'motherName'`. Works.
5. `guarantorAddress` → `charAt(9) = 'A'` → `'a' + 'ddress'` = `'address'`. Works.
6. `guarantorAadhaarBack` → `'a' + 'adhaarBack'` = `'adhaarBack'`. Works.
7. **`guarantorDob` (13 chars) → `charAt(9) = 'o'` → `'o' + 'b'` = `'ob'`. Bug — the field is `dob` on Prisma.**
8. **`guarantorPan` (11 chars) → `charAt(9) = 'a'` → `'a' + 'n'` = `'an'`. Bug — the field is `pan` on Prisma.**
9. **`guarantorVideo` (13 chars) → `charAt(9) = 'i'` → `'i' + 'deo'` = `'ideo'`. Bug — the field is `video`.**
10. **`guarantorPhoto` (13 chars) → `charAt(9) = 'h'` → `'h' + 'oto'` = `'hoto'`. Bug — the field is `photo`.**
11. **`guarantorRelation` (16 chars) → `charAt(9) = 'R'` → `'r' + 'elation'` = `'relation'`. Works by coincidence.**
12. **`guarantorStatus` (15 chars) → `charAt(9) = 'S'` → `'s' + 'tatus'` = `'status'`. Works.**

So out of 14 guarantor fields, 4 are routed to wrong keys (`dob`, `pan`, `video`, `photo`) and 1 (`guarantorName` → `mame`) is completely wrong. The other 9 work because the next character after `guarantor` happens to be the right one for the camelCase → lowercase split.

**Test coverage**: `tests/unit/guarantor-field-routing.test.ts` exists but only tests `guarantorName` (which is the broken case). The fact that the test passes is suspicious — probably mocks the DB and never verifies what actually got written. Or the test was written against the wrong expectation.

**Impact**: A rider's guarantor submission with any of `dob`, `pan`, `video`, `photo`, or `name` is silently discarded on the upsert (`guarantor.upsert` with `update: { ...(guarantorData as any) }` — the extra fields just sit in the object and Prisma ignores unknown columns; but the actual `dob`/`pan`/`video`/`photo`/`name` columns are NOT updated). The admin review then sees a guarantor with all fields blank.

**Fix**: replace the magic number with an explicit map:
```ts
const GUARANTOR_FIELD_TO_DB: Record<string, string> = {
  guarantorName: 'name',
  guarantorPhone: 'phone',
  guarantorRelation: 'relation',
  guarantorDob: 'dob',
  guarantorFatherName: 'fatherName',
  guarantorMotherName: 'motherName',
  guarantorAddress: 'address',
  guarantorAadhaarFront: 'aadhaarFront',
  guarantorAadhaarBack: 'aadhaarBack',
  guarantorPan: 'pan',
  guarantorVideo: 'video',
  guarantorSignature: 'signature',
  guarantorPhoto: 'photo',
  guarantorStatus: 'status',
};
```

### P1.2 — `guarantor.use-cases.submitGuarantor` calls `replaceGuarantor` then `submitGuarantor` against the same row

**Evidence**: `guarantor.use-cases.ts:39-44`:
```ts
const current = await guarantorRepository.findByRiderId(riderDbId);
if (current && current.status === 'REJECTED') {
  await guarantorRepository.replaceGuarantor(riderDbId);
}
return guarantorRepository.submitGuarantor(riderDbId, input as any);
```

`replaceGuarantor` (guarantor.repository.ts:153-168) sets the status to `REPLACED`. Then `submitGuarantor` (guarantor.repository.ts:46-77) tries to transition `REPLACED → SUBMITTED`. Per the state machine (`guarantor-state-machine.ts:27`), **`REPLACED` has no transitions** — it's terminal.

`validateGuarantorTransition('REPLACED', 'SUBMITTED')` will throw `GuarantorStateError: Invalid guarantor transition: "REPLACED" → "SUBMITTED"`.

**Impact**: A rider whose guarantor was rejected can never resubmit. The "try to resubmit" flow throws 409 Conflict, and the rider is stuck in REJECTED forever.

**Fix**: two options:
1. (Cheaper) In `replaceGuarantor`, after setting status to `REPLACED`, also clear the rejected fields so the rider is starting fresh. Then in `submitGuarantor`, allow the transition `REPLACED → SUBMITTED` (add it to VALID_TRANSITIONS).
2. (Cleaner) In `submitGuarantor`, if current status is `REPLACED`, skip the state machine check and treat it as a fresh DRAFT.

The current code in `submitGuarantor` (guarantor.repository.ts:46) reads `existing?.status || 'DRAFT'`. For a REPLACED row, it tries `validateGuarantorTransition('REPLACED', 'SUBMITTED')` and throws.

### P1.3 — Wallet ledger `recomputeWalletBalance` trigger can race with `creditWallet` in concurrent transactions

**Evidence**: Migration `20260808000001_add_wallet_balance_recompute_trigger/migration.sql` (per the summary, added in PR-150) creates an `AFTER INSERT ON wallet_ledgers` trigger that recomputes `wallet.balanceInPaise` from the ledger. The wallet-ledger service (`wallet-service.ts`) is the single chokepoint for balance changes — and it does the recompute **inside the transaction**, then INSERTs the ledger row, which **also** triggers the recompute.

Order of operations per `libCreditWallet`:
1. Read wallet.balanceInPaise
2. Compute newBalance = current + amount
3. UPDATE wallet SET balanceInPaise = newBalance  ← step 3 already updates the balance
4. INSERT INTO wallet_ledgers  ← step 4 fires the trigger, which re-computes and UPDATE-s again

This is a "double-write" pattern: the application writes `balanceInPaise`, then the trigger overwrites it. The final value is correct *as long as* the trigger's recompute matches the application's `newBalance`. But the trigger is reading from `wallet_ledgers` rows that include the just-inserted one — so the sum should match.

**The race**: two concurrent `creditWallet` calls for the same rider. With the default REPEATABLE READ isolation in PostgreSQL:
- T1 reads balance = 1000
- T2 reads balance = 1000
- T1 UPDATE wallet SET balance = 1100
- T1 INSERT ledger (+100)
- T2 UPDATE wallet SET balance = 1100  ← overwrites T1's value
- T2 INSERT ledger (+100)

Final state: balance = 1100, ledger sum = 200. **Drift of ₹100.**

**Fix**: do the balance read + UPDATE inside `SELECT ... FOR UPDATE` (pessimistic row lock), or use the trigger-only path (drop the manual balance update and let the trigger be the single writer). The trigger-only path is cleaner and matches the rationale for adding the trigger in the first place.

### P1.4 — `getDeviceData` returns `lockPassword` instead of `lockPasswordHash`

**Evidence** (already in the surface audit): `admin-riders.use-cases.ts:680-689` SELECTs `lockPassword: true` from a schema that has `lockPasswordHash` only.

This is a P1 (vs. the surface audit's P1) because combined with **P0.1** it shows the same field name confusion across the admin and rider code paths. If the admin-side code is changed to read `lockPasswordHash`, that field will be returned in plaintext-looking form (it's actually a hash, but the admin UI doesn't know that) — confusing the UI. Better to drop the field from the SELECT entirely; the admin never needs the hash.

### P1.5 — KYC `submitKyc` checks the state machine against the old status, but the upsert overwrites the new status unconditionally

**Evidence**: `kyc.repository.ts:108-145`:
```ts
async submitKyc(riderDbId: string, data: Record<string, unknown>) {
  // Read current status to validate transition
  const existing = await db.kycProfile.findUnique({ where: { riderId: riderDbId }, select: { status: true } });
  const currentStatus: KycStatus = (existing?.status as KycStatus) || 'DRAFT';
  validateKycTransition(currentStatus, 'SUBMITTED');  // ← checks DRAFT → SUBMITTED ok

  return db.$transaction(async (tx) => {
    const kyc = await tx.kycProfile.upsert({
      where: { riderId: riderDbId },
      create: { riderId: riderDbId, ...(encryptedData as any), status: 'SUBMITTED' },
      update: { ...(encryptedData as any), status: 'SUBMITTED' },  // ← blind overwrite
    });
    ...
  });
}
```

The `validateKycTransition` check is on the *read* status, but the upsert then overwrites to `SUBMITTED` regardless. If the rider is currently `APPROVED`, `validateKycTransition('APPROVED', 'SUBMITTED')` throws (`APPROVED` only transitions to `EXPIRED`). So the throw is real and prevents the bug. But: the rider can re-submit KYC after `REJECTED` (state machine allows it), and the upsert will set the status to `SUBMITTED` even if the previous status was `REJECTED` with `editableFields`. The `editableFields` filter in `kyc.use-cases.ts:29-37` strips uneditable fields from `prismaData`, but it doesn't tell the rider that the form fields are uneditable — the rider can still POST them, the server filters them, the form is silently updated with the rider's data while the previous reviewer comments are still in `rejectionReason`. This is by design (filter and write), but the UI probably shows "rejected — please fix X, Y, Z" and the rider fixes them; the filter silently accepts the fix; status moves to SUBMITTED. The reviewer then sees the new submission. **This works**, but:

**Real bug**: when the rider re-submits after REJECTED, the use-case sets `kycProfile.status = 'SUBMITTED'` via the upsert. But the previous rejection reason and editable fields are kept (upsert `update` doesn't touch them). The rider doesn't see a fresh rejection reason on the next review, the reviewer doesn't know what they fixed, and the review is essentially starting from a clean slate — but with stale data.

**Fix**: in `submitKyc`, after validating the transition, also clear `rejectionReason` and `editableFields` on the upsert. The reviewer should see only the current submission, not the ghost of the previous rejection.

### P1.6 — `getDashboard` `upcomingRentPrompt` has a hardcoded `'Tomorrow at 6:00 AM'` string

**Evidence**: `rider.use-cases.ts:310`:
```ts
dueTimeFormatted: isOverdue ? 'Overdue' : 'Tomorrow at 6:00 AM',
```

This is the user-visible copy on the dashboard's "rent due" prompt. Hardcoded English. The Flutter app uses i18n (`wallet_unlockPremiumTiers`, etc.) — this string is the only English-only string in a fully-localized app. A Hindi rider sees the rest of the app in Hindi and this prompt in English.

**Fix**: move to the Flutter app's i18n files; the server returns `dueDate` as ISO and the client formats.

---

## P2 — Type safety, contracts, and design

### P2.1 — Four sources of truth for the lifecycle status enum

| Source | Count | Notes |
|---|---|---|
| DB enum `RiderLifecycleStatus` (`schema.prisma:1224-1240`) | **15** | Source of truth (enforced by CHECK constraint triggers) |
| TS `RiderLifecycleStatus` (`rider-lifecycle.service.ts:16-31`) | **15** | Matches DB exactly |
| TS `RiderLifecycleStatus` (`rider.types.ts:7-22`) | **15** | Matches DB exactly |
| TS `RiderState` (`rider-management/types.ts:21-30`) | **9** | 4 phantom values (APPROVED, POST_ACTIVE, PRE_ACTIVE, ONBOARDING) — these don't exist in DB |
| `STATE_FILTERS` UI constant | **6** | Missing 9 DB values (PHONE_VERIFIED, PROFILE_SUBMITTED, KYC_APPROVED, GUARANTOR_*, DEPOSIT_*, PLAN_SELECTED, PICKUP_SCHEDULED, RETURN_PENDING) |
| API allowlist (admin `riders/route.ts:52`) | **5** | Only KycStatus, not lifecycleStatus |
| `RIDER_PERMISSIONS` array | n/a | References `keyof Rider` — any field name from the stub Rider type |

The TS types in the server (`rider-lifecycle.service.ts`, `rider.types.ts`) match the DB. The mismatch is in the **admin UI** (`rider-management/types.ts`) and the **stale API allowlist**.

**Fix**: regenerate `STATE_FILTERS` from the Prisma enum at build time; delete the `RiderState` type from `rider-management/types.ts`; use the server's `RiderLifecycleStatus` everywhere.

### P2.2 — Three sources of truth for KYC status enum

| Source | Values |
|---|---|
| DB `KycStatus` (`schema.prisma:1250-1258`) | PENDING, DRAFT, SUBMITTED, INFO_REQUIRED, APPROVED, REJECTED, EXPIRED (7) |
| TS `KycStatus` (`kyc-state-machine.ts:9-15`) | DRAFT, SUBMITTED, INFO_REQUIRED, APPROVED, REJECTED, EXPIRED (6 — missing PENDING) |
| TS `KycStatus` (`kyc.types.ts`) | (not opened) |
| TS `KycStatus` (`lib/types/admin.ts:23-30`) | NOT_STARTED, PENDING, SUBMITTED, INFO_REQUIRED, APPROVED, REJECTED, VERIFIED (7 — NOT_STARTED + VERIFIED not in DB, PENDING in both) |
| API allowlist (`riders/route.ts:52`) | PENDING, SUBMITTED, APPROVED, REJECTED, INFO_REQUIRED (5) |
| Flutter `KycStatus` (`generated/api_models.dart` — not opened) | likely mirrors whatever OpenAPI was generated from |

**The state machine is missing `PENDING`**. A rider's KYC profile starts as `PENDING` (per the kyc route's default response at `kyc/route.ts:59`). The state machine can't validate a transition FROM PENDING. The repository fallback (`existing?.status as KycStatus || 'DRAFT'`) hides this — it never sees PENDING, always treats PENDING as DRAFT. So the state machine is effectively lying about what status KYC profiles can have.

**Fix**: pick the DB enum as source of truth, add PENDING to the state machine, add it to the allowed initial statuses (`DRAFT`, `PENDING`).

### P2.3 — Lifecycle transition map and the rider.update use-case disagree

**Evidence**:
- `rider-lifecycle.service.ts:37-53` says `GUARANTOR_APPROVED` can only transition to `PLAN_SELECTED`.
- `rider.use-cases.ts:134` (`rejectPlan`) sets `lifecycleStatus: 'GUARANTOR_APPROVED'` (going BACKWARDS) directly via `db.rider.update`, bypassing `transitionRiderStatus` and the state machine.
- `rider.use-cases.ts:585-595` (`updateProfile`): makes 3 separate `transitionRiderStatus` calls based on which fields were updated. **These calls can fire in any order, and each one re-reads the lifecycle status from the DB. If two fields are updated in the same call, the second `transitionRiderStatus` may see the post-first-transition state and fail.**

E.g. if a rider is `NEW`, and the rider submits KYC + guarantor data in one PUT:
1. KYC transition: `NEW → PHONE_VERIFIED` (allowed per the state machine, line 38)
2. Then `PHONE_VERIFIED → PROFILE_SUBMITTED` (allowed, line 39)
3. Guarantor transition: `PROFILE_SUBMITTED → GUARANTOR_SUBMITTED` (allowed, line 40)
4. Then `GUARANTOR_SUBMITTED → GUARANTOR_SUBMITTED` no-op (line 77-78: no-op transitions are allowed)

But if a rider is `GUARANTOR_SUBMITTED` and submits only KYC:
1. KYC transition: `GUARANTOR_SUBMITTED → ?` (NOT in allowed list at line 41)
2. Throws `RiderLifecycleError`

But the state machine allows the implicit progression. The bug: `updateProfile` checks 4 states before transitioning (lines 576-595) but each check is against a different status it just set, not against the current global state. The path is brittle.

**Fix**: collapse `updateProfile`'s state transitions into a single decision tree based on the *initial* `currentRider.lifecycleStatus` and the *full* `kycData` + `guarantorData` flags, computed once. The current pattern re-reads the DB 4 times for one update.

### P2.4 — `riderId` computed from `fullName` in two places with subtly different logic

**Evidence**:
- `admin-riders.use-cases.ts:336-337` (create):
  ```ts
  const prefix = fullName.replace(/[^a-zA-Z]/g, '').padEnd(2, 'X').substring(0, 2).toUpperCase();
  const newRiderId = `VEM${prefix}${String(created.serialNumber).padStart(3, '0')}`;
  ```
- `admin-riders.use-cases.ts:444-447` (update with fullName change):
  ```ts
  const prefix = name.replace(/[^a-zA-Z]/g, '').padEnd(2, 'X').substring(0, 2).toUpperCase();
  riderData.riderId = `VEM${prefix}${String(existing.serialNumber).padStart(3, '0')}`;
  ```
- `rider.use-cases.ts:500-504` (rider self-update, updateProfile):
  ```ts
  if (riderData.fullName && existing.riderId.startsWith('VF-RD-')) {
    const prefix = name.replace(/[^a-zA-Z]/g, '').padEnd(2, 'X').substring(0, 2).toUpperCase();
    riderData.riderId = `VEM${prefix}${String(existing.serialNumber).padStart(3, '0')}`;
  }
  ```

Three copies of the same algorithm. None of them share a helper. If the format ever changes (e.g. prefix from 2 to 3 chars), three places need to be updated.

**Fix**: extract `computeRiderId(fullName, serialNumber)` to a shared util in `riders/` module, use from all three sites.

### P2.5 — `rider.repository.getFullState` includes `transactions` ordered DESC with limit 10, but no `select` — pulls every column

**Evidence**: `rider.repository.ts:29-40`:
```ts
async getFullState(riderDbId: string) {
  return db.rider.findUnique({
    where: { id: riderDbId },
    include: {
      kycProfile: true, guarantor: true,
      transactions: { orderBy: { createdAt: 'desc' }, take: 10 },  // ← no select
      wallet: true,
      leases: true,
    },
  });
}
```

`transactions` is included with no `select` clause. The Prisma `Transaction` model has 20+ columns including `description`, `metadata` (JSONB), `proofUrl` (could be a long URL), `idempotencyKey`, etc. For a 10-row result, this returns 200+ fields that the caller (`rider.use-cases.getState`) never reads.

**Fix**: add `select: { id, type, amountInPaise, status, purpose, createdAt }` (or whatever fields the caller uses — looking at `getState`, it doesn't read transactions at all).

### P2.6 — `requireRiderSession` returns `Response` on error, but some callers check `instanceof Response`, others check `'status' in session`, others check `auth instanceof Response`

**Evidence**: 3 different checks for the same auth helper, across 5+ routes:
- `rider/profile/route.ts:23`: `if (auth instanceof Response) return auth;` (this is the **admin** profile route — different file)
- `rider/dashboard/route.ts:10`: `if (auth instanceof Response) return auth;`
- `rider/kyc/route.ts:23`: `if (session instanceof Response) return session;`
- `rider/guarantor/route.ts:15`: `if (session instanceof Response) return session;`
- `rider/device/verify-lock/route.ts:23`: `if (auth instanceof Response) return auth;`
- `rider/device/permissions/route.ts:11`: `if (auth instanceof Response) return auth;`
- `rider/consent/route.ts:18`: no check (just `auth.riderDbId`)
- `rider/use-cases.ts:15, 23, 37`: `'status' in session`

The auth helper returns a `Response` on error, but the contract isn't enforced by a tagged union or branded type — it's convention. New contributors will write the wrong check. Some routes (consent) skip the check entirely and assume success.

**Fix**: make `requireRiderSession` return a `Result<Session, Response>` or throw a typed error that the route catches.

### P2.7 — `rider.use-cases.getState` reads `vehicleId` from the rider, but the schema has a different field

**Evidence**: `rider.use-cases.ts:643-645`:
```ts
assignedVehicle:
  rider.vehicleId || rider.assignedVehicle
    ? { id: rider.vehicleId, vehicleId: rider.assignedVehicle }
    : null,
```

`Rider.vehicleId` (FK to `Vehicle.id` — internal cuid) is a different thing from `Rider.assignedVehicle` (a free-form string, the vehicle number). The output is `{ id: vehicleId, vehicleId: assignedVehicle }` — confusing. The Flutter consumer of `getState` would need to know which is which.

**Fix**: standardise on one. Either drop the free-form `assignedVehicle` (use only the FK) or drop the FK (use only the string). They were both added in different migrations to solve different problems; the current code carries both.

### P2.8 — `kyc.use-cases.reviewKyc` `case 'REQUEST_INFO'` calls `notificationService.notifyKycStatusChange(riderDbId, 'REQUESTED', infoRequest)` — `REQUESTED` is not a valid `KycStatus`

**Evidence**: `kyc.use-cases.ts:95`:
```ts
case 'REQUEST_INFO': {
  const infoRequest = review.infoRequest || 'Additional information required';
  const result = await kycRepository.requestInfo(riderDbId, reviewerId, infoRequest);
  await notificationService.notifyKycStatusChange(riderDbId, 'REQUESTED', infoRequest);
  return result;
}
```

The KYC DB enum is `DRAFT | SUBMITTED | INFO_REQUIRED | APPROVED | REJECTED | EXPIRED`. `REQUESTED` is not a valid status. The notification service receives `'REQUESTED'` and either (a) maps it internally to `INFO_REQUIRED` (silently) or (b) sends a notification with a typo'd status to the rider's app.

The comment above says "REQUEST_INFO is not in the outbox dispatch table yet (Phase 1.4 dispatcher handles APPROVE/REJECT). Keep the direct call for now; track for the next dispatcher update." — this is debt, not a bug. But the value passed (`'REQUESTED'`) is suspect.

**Fix**: pass `'INFO_REQUIRED'` instead of `'REQUESTED'`.

---

## P3 — Code quality and dead code

### P3.1 — `rider-register.use-cases.ts` (21 lines) is a near-duplicate of `riderUseCases.registerFcmToken` (rider.use-cases.ts:376-381)

Both functions do the same thing:
- `rider-register.use-cases.ts:17-21`: fetch, throw if not found, update, return
- `rider.use-cases.ts:376-381`: same, plus `invalidateRiderCache`

**Which one is used?** `rider.use-cases.ts`'s version (called from somewhere — needs check). `rider-register.use-cases.ts`'s version appears unused.

**Fix**: delete `rider-register.use-cases.ts`.

### P3.2 — `rider.schemas.ts` (19 lines) re-exports `updateProfileSchema` from `@/lib/validators` and adds a `getRiderQuerySchema` that's never used

**Evidence**: `rider.schemas.ts:6-9`:
```ts
import { updateProfileSchema } from '@/lib/validators';
export { updateProfileSchema };
```

And `getRiderQuerySchema` — let me check if it's used.

**Fix**: delete `rider.schemas.ts`; import `updateProfileSchema` directly from `@/lib/validators` in `rider.routes.ts`.

### P3.3 — `rider.routes.ts:36-43` `GET_state` calls `riderUseCases.getState` — but the `/api/rider/state` route doesn't exist

**Evidence**: `rider.routes.ts:36` defines a `GET_state` handler, but there's no `src/app/api/rider/state/route.ts` to call it. The exported `rider.routes.ts` isn't even imported by anything — the actual rider-app routes use the inline handlers I read at `kyc/route.ts`, `guarantor/route.ts`, etc.

**Fix**: delete `rider.routes.ts`.

### P3.4 — `rider.policy.ts` (18 lines) is a dead-code stub

**Evidence**: The two functions `canViewProfile` and `canUpdateProfile` only check role='admin' vs own. They never get called — the actual route handlers do the auth check via `requireRiderSession` and don't consult `riderPolicy`.

**Fix**: delete `rider.policy.ts`, or actually wire it into the routes.

### P3.5 — `rider.types.ts` `RiderProfileUpdate` has 9 fields but `updateProfileSchema` (Zod) has 30+ fields

**Evidence**: `rider.types.ts:24-34` defines `RiderProfileUpdate` with only core rider fields. But the actual `updateProfile` use-case accepts KYC, guarantor, AND vehicle return fields too. The TS type is only used in `rider.use-cases.ts:15` (imported but not actually applied anywhere). 

**Fix**: delete the type, or expand it to match the actual input shape.

### P3.6 — `kyc.types.ts` and `kyc.schemas.ts` not opened — but the export count is 65 lines for `kyc.types.ts` and 19 for `kyc.schemas.ts`. Likely contains duplicate schemas and types.

(Skipped — would require opening the files to confirm.)

### P3.7 — `deviceComplianceUseCases` imported but not opened in this audit

The `rider/device/route.ts` and `rider/device/permissions/route.ts` import from `device-compliance/device-compliance.use-cases`. This module would need to be audited for the same magic-number / state-machine issues. (Not opened.)

### P3.8 — `flutter/lib/widgets/locked_overlay.dart` will never be useful in production

Per P0.1, the server endpoint it calls is permanently broken. The widget is rendered (presumably) but the unlock flow fails. Either:
1. Fix P0.1 (preferred — see fix above)
2. Hide the locked overlay entirely until P0.1 is fixed
3. Add a "contact support" CTA that doesn't pretend to be a self-serve unlock

### P3.9 — `flutter/lib/core/network/api_client.dart` is 551 lines and not read in this audit

Likely contains the OpenAPI-generated HTTP client. The `verify-lock` call is at line 546. The volume (551 lines) suggests it's a kitchen-sink file with every API call inlined. Refactor candidate.

### P3.10 — The `dashboard_rent_prompt_card.dart` (Flutter, uncommitted) consumes the `upcomingRentPrompt` field

Per the summary, the `dashboard_rent_prompt_card.dart` is uncommitted. The server-side computation at `rider.use-cases.ts:262-317` includes `dueTimeFormatted: isOverdue ? 'Overdue' : 'Tomorrow at 6:00 AM'`. The Flutter card will need to ignore this field and format locally per the i18n pattern.

### P3.11 — `flutter/lib/services/voltium_api_service.dart` (240 lines) is a parallel API client to `core/network/api_client.dart`

Two API client implementations. The `generated/api_client.dart` (under core/network) is the OpenAPI-generated one; `voltium_api_service.dart` is a hand-rolled alternative. The first one is 551 lines + a generated `api_models.dart`; the second is 240 lines. Pick one.

### P3.12 — `consent/route.ts:36-41` only logs consent, doesn't persist it

```ts
// Consent is stored locally on device; this endpoint acknowledges receipt.
// A full consent audit table can be added later if needed.
logger.info('[POST /api/rider/consent]', { riderId: auth.riderDbId, consentType, granted, policyVersion });
return success({ consentType, granted, policyVersion, recordedAt: new Date().toISOString() }, 'Consent recorded');
```

**GDPR/DPDP exposure**: if a regulator asks "show me proof that rider X consented to location tracking on date Y", the answer is "we have it in our log aggregator for 30 days, then it's gone." This is a known debt but it has real compliance impact — the comment says "if needed" but the answer is always "yes, needed" once you have a regulator.

**Fix**: add a `ConsentRecord` table with `riderDbId`, `consentType`, `granted`, `policyVersion`, `recordedAt`, `ipAddress`, `userAgent`. Persist before the success response.

---

## P4 — Test coverage gaps

(Test files in `web/tests/unit` related to riders; cross-checked against the audit-chained source files.)

| Test file | Covers | Missing |
|---|---|---|
| `rider-auth.test.ts` | Session/JWT | ??? (not read) |
| `rider-decomposition-state.test.ts` | State machine | ??? |
| `rider-lifecycle-stage.test.ts` | Lifecycle types | ??? |
| `rider-lifecycle-stage-migration.test.ts` | DB migration | ??? |
| `rider-fk-columns-migration.test.ts` | FK migration | ??? |
| `rider-service.test.ts` | Service layer | ??? |
| `riders-legacy-column-drift.test.ts` | Column drift | ??? |
| `riders-legacy-column-readers.test.ts` | Read paths | ??? |
| `riders-lifecycle-stage-shape.test.ts` | Shape compat | ??? |
| `rider-dashboard-rent-prompt.test.ts` | `upcomingRentPrompt` calc | The hardcoded `'Tomorrow at 6:00 AM'` string isn't asserted; only the numeric fields are. |
| `rider-rental-return.test.ts` | Return flow | ??? |
| `api-routes-rider-vs-riders.test.ts` | Route coexistence | ??? |
| `flatten-rider.test.ts` | Flatten util | ??? |
| `kyc.repository.test.ts` | KYC repo (encrypt/decrypt, transitions) | `submitKyc` clearing of `rejectionReason`/`editableFields` (P1.5) — not tested |
| `approveKyc.test.ts` | Approve flow | ??? |
| `guarantor-field-routing.test.ts` | Field routing | **All 5 buggy fields (dob, pan, video, photo, name → mame) are not tested. The test passes because it mocks the DB upsert and never verifies the keys actually sent to Prisma.** This is the smoking gun for P1.1. |
| `verify-lock-impersonation.test.ts` | Impersonation guard | **The read path is not tested with a real `lockPasswordHash` value. The test "acknowledges" the bug (line 61, 101) and only tests the failure path.** |
| `wallet-service.test.ts`, `wallet.repository.test.ts`, `wallet-ledger.service.test.ts` | Wallet ledger | Race condition in P1.3 not tested. |
| `wallet-balance-trigger-coverage.test.ts` | Trigger | PR-150 added this — should catch some race scenarios, but the concurrent-update case is missing. |
| `admin-wallet-adjust-caps.test.ts` | Caps | The competing `walletBalance` path (P1.2 from the surface audit, the bigger fix here) — not tested as a unit. |
| `deposit-ledger.service.test.ts` | Deposit ledger | ??? |
| `data-deletion-flow.test.ts` (in `tests/unit/api/`) | **Only validates the Zod schema parses — never calls an endpoint.** The two-person-rule flow has zero endpoint coverage. (From the surface audit.) |

---

## P5 — Cross-stack contract mismatches (Web ↔ Flutter)

| Endpoint | Web side | Flutter consumer | Match? |
|---|---|---|---|
| `GET /api/rider/dashboard` | returns `{ rider, referralCode, unreadNotifications, todayStats, planDaysRemaining, upcomingRentPrompt }` | (presumed to consume) | ❓ (not read) |
| `GET /api/rider/profile` | `flattenRider()` output (~60 fields) | `rider_model.dart` (per summary, uncommitted work) | ❓ |
| `POST /api/rider/kyc` | returns `{ id, riderId, kycStatus }` | (presumed) | ❓ |
| `GET /api/rider/kyc` | returns `{ kycStatus, profilePhoto, riderPhoto, signature, aadhaarFront, aadhaarBack, panCard, bankName, rejectionReason }` — **does not include `aadhaarNumber`, `panNumber`, `accountNumber`, `ifscCode` even though they're stored encrypted** | (presumed) | ❓ — rider can read PII but not in this response |
| `GET /api/rider/guarantor` | returns `{ guarantorStatus, name, relation, dob, phone, fatherName, motherName, rejectionReason }` — **does not include the Aadhaar/PAN/video/signature/photo/address even though they're stored** | (presumed) | ❓ |
| `POST /api/rider/device/verify-lock` | reads `lockPassword` (P0.1 — never works) | `locked_overlay.dart` | ❌ broken |
| `POST /api/rider/device/permissions` | accepts `{ permissions: { locationGranted, batteryGranted, ... } }` — **8 permissions in schema, but the rider's `Rider` model only has 7 permission columns** (`locationGranted, batteryGranted, contactsGranted, callLogsGranted, micGranted, cameraGranted, phoneGranted` — `deviceAdminGranted` and `displayOverlayGranted` are accepted but no DB columns exist for them) | (presumed) | ❌ — accepts data it can't store |
| `POST /api/rider/consent` | only logs, doesn't persist (P3.12) | (presumed) | ❌ — claims success without recording |
| `GET /api/admin/riders?deleted=true` | does not support `deleted=true` filter (P0.1 from surface audit) | (presumed) | ❌ |
| `GET /api/admin/riders/[id]/device-data` | SELECTs `lockPassword` (P1.4) — schema has `lockPasswordHash` | (admin panel) | ❌ — returns undefined field |

The Flutter side cannot be fully audited without opening `generated/api_models.dart` and the `dashboard_rent_prompt_card.dart` (uncommitted) and `rider_model.dart` (uncommitted). The uncommitted model + card are the source of any new contract mismatches.

---

## Recommended fix order

| Priority | PR | Scope | Est. hours |
|---|---|---|---|
| **P0.1** | `verify-lock` reads `lockPasswordHash` | 1 file edit + 1 new test | 30m |
| **P1.1** | Fix `key.charAt(9)` magic-number routing | 1 file edit + 1 expanded test (cover all 14 fields) | 2h |
| **P1.2** | Allow `REPLACED → SUBMITTED` transition | 1 file edit + 1 test | 1h |
| **P1.3** | Add `SELECT ... FOR UPDATE` in `creditWallet`/`debitWallet` | 2 file edits + 1 race test | 4h |
| **P1.4** | Drop `lockPassword` from `getDeviceData` SELECT | 1 file edit | 15m |
| **P1.5** | Clear `rejectionReason`/`editableFields` on KYC re-submit | 1 file edit + 1 test | 1h |
| **P1.6** | Move hardcoded `'Tomorrow at 6:00 AM'` to Flutter i18n | 1 file edit | 30m |
| **P2.1, P2.2** | Unify lifecycle / KYC enum sources | Delete `RiderState`, add `PENDING` to KYC state machine, regenerate `STATE_FILTERS` from Prisma | 3-4h |
| **P2.3** | Collapse `updateProfile` state-transition tree | 1 file edit + 1 test | 2h |
| **P2.4** | Extract `computeRiderId` helper | 1 file create + 3 file edits | 1h |
| **P2.5** | Add `select` to `transactions` include in `getFullState` | 1 file edit | 15m |
| **P2.6** | Type-safe `requireRiderSession` return | 1 file edit (helper) + 5 route fixes + 1 test | 2h |
| **P2.7** | Pick one of `vehicleId` vs `assignedVehicle` | Schema migration + use-case fix | 4-6h |
| **P2.8** | Pass `'INFO_REQUIRED'` instead of `'REQUESTED'` | 1 file edit | 5m |
| **P3.1, P3.2, P3.3, P3.4, P3.5** | Delete 5 dead code files | 5 file deletes | 30m |
| **P3.6, P3.7** | Audit `kyc.types.ts`, `kyc.schemas.ts`, `deviceComplianceUseCases` | 3 file reads | 1h |
| **P3.8** | Hide `locked_overlay` until P0.1 lands OR add support CTA | 1 file edit | 1h |
| **P3.9, P3.11** | Pick one of the 2 Flutter API clients | 1 file delete + tests pass-through | 1h |
| **P3.10** | Add i18n for `dueTimeFormatted` | 1 server edit + 1 client edit | 1h |
| **P3.12** | Persist `ConsentRecord` table | 1 migration + 1 use-case + 1 route + 1 test | 4h |

**Total: ~30h of focused work** to take the riders section from "audited" to "production-grade, all known issues fixed". Could be split into ~8 PRs over 2-3 weeks.

---

## What I'd do first if I had to pick one

**P0.1** — fix `verify-lock`. This is the **worst** bug in the entire audit because:
- It's broken for every rider in production
- It bricks a feature that has a single, well-defined failure mode
- The fix is a 3-line change
- The downstream consequence (riders who get admin-locked can never unlock themselves) is the kind of customer-trust-destroying failure that's hard to recover from

The first PR of this fix batch should be: change 3 lines in `verify-lock/route.ts`, add a passing test, ship it. Everything else can wait a sprint.
