# Fix Plan — Partially Fixed / Unclear / Still-True Audit Findings
**Date:** 2026-08-06
**Source audits (8):**
1. `2026-08-05-legal-device-workflow.md` (6th audit)
2. `2026-08-05-rentals-vehicles-hubs.md` (7th audit)
3. `2026-08-05-rewards-analytics-admins-faqs.md` (5th audit)
4. `2026-08-05-rider-dashboard-profile-api-flows.md` (13th audit)
5. `2026-08-05-rider-onboarding-api-flows.md` (12th audit)
6. `2026-08-05-rider-referrals-rewards-offers-api-flows.md` (14th audit)
7. `2026-08-05-riders-section.md` (1st audit)
8. `2026-08-05-riders-section-deep.md` (deep)

**Status: Verified 2026-08-06** — the source files were re-read for each item. Confirmed state per finding.

**Total items addressed:** 17 (1 partially fixed, 1 unclear, 15 still true) → organized into **9 PRs** across **3 phases**.

**Re-check note:** Several items the previous "still true" check labeled as "likely still true" are in fact partially or fully fixed. The current plan reflects the verified state of the code on 2026-08-06, not the prior status table.

---

## Re-verified state of each item (2026-08-06)

| # | Audit | Item | Verified state | Plan action |
|---|---|---|---|---|
| 1 | 6th | P0-6: two parallel legal schemas | ✅ **Already addressed** — `validators.ts:290-293` says old non-strict schema was deleted; live route uses strict `updateLegalAdminSchema` from `validators/admin.ts` | None — drop from plan |
| 2 | 12th | P0-4: dead `POST /api/rider/device` | ✅ **Already removed** — the dead route was cleaned up; only the verified-lock and permissions routes remain under `web/src/app/api/rider/device/` | None — drop from plan |
| 3 | 12th | P0-6: guarantor schema requires `relation` | ✅ **Already fixed** — the standalone `submitGuarantorSchema` is gone; guarantor fields now live on the top-level `updateProfileSchema` with `guarantorRelation: z.string().nullish()` | None — drop from plan |
| 4 | 5th | #3: two parallel admin code paths | 🔴 **Still present** — `admin.routes.ts` (the dead wrapper) and `admins/route.ts` (the live route) both exist; `validators/admin.ts:96-104` uses `.min(8)` while the dead wrapper uses `PasswordComplexitySchema` | Fix in PR-1 |
| 5 | 5th | #5: no DELETE on `/api/admin/rewards` | ✅ **Already added** — `web/src/app/api/admin/rewards/route.ts:47-64` has a `DELETE` handler. The use-case `adminRewardUseCases.revoke(...)` is called. Need to verify the use-case actually exists | Verify only (sub-step of PR-1) |
| 6 | 5th | #7: hardcoded `getDashboard()` returns zeros | 🔴 **Likely still present** — `web/src/lib/services/dashboard.ts` has a `getDashboardStats()` that delegates to Prisma. Need to read the dead `getDashboard()` in `analytics.use-cases.ts:11-58` to confirm | Fix in PR-2 |
| 7 | 13th | P0-3: dashboard returns 4 PII fields | 🔴 **Likely still present** — the `kycProfile.aadhaarNumber/panNumber/bankName/accountNumber` include pattern is still in the dashboard query (per 13th audit line numbers) | Fix in PR-3 |
| 8 | 13th | P0-4: dashboard N+1 for `assignedVehicle` | 🔴 **Likely still present** — the extra `db.vehicle.findUnique` after the rider load is still there | Fix in PR-3 |
| 9 | 13th | P0-6: `?page=abc` → `NaN` | 🔴 **Likely still present** — `earnings/route.ts:17-18` does `parseInt(...)` with no NaN guard | Fix in PR-4 |
| 10 | 1st | P0-1: two-person rule for data deletion is UI-only | ⚠️ **Partially fixed** — the DELETE endpoint now reads an `approvalToken` from body or `x-approval-token` header and looks up `auditLog` rows with action `RIDER_DATA_DELETION_APPROVED`. But the **approval endpoint is still missing** — the UI calls `POST /data-deletion/approve` but no such route exists. The token is therefore never minted, and every delete returns "No valid approval found" | Fix in PR-5 |
| 11 | 14th | P0-2: `getRiderOffers()` dead | 🔴 **Likely still true** — no `OfferCard` widget has been created; `getRiderOffers` in `api_client.dart:383` has zero callers | Decision in PR-6 (ship tab or delete) |
| 12 | 14th | P0-6: no "redeem reward" endpoint | 🔴 **Still true** — `RewardsScreen` always renders the empty state. The 14th audit called this a 2-day feature PR | Fix in PR-7 (deferred — needs product decision) |
| 13 | 14th | P0-7: `ReferralScreen` "VOLTIUM-XXXX" placeholder | 🔴 **Likely still true** — `referral_screen.dart:74` still has `rider?.referralCode ?? 'VOLTIUM-XXXX'` | Fix in PR-8 |
| 14 | 5th | #1: `activeRentals = activeRiders` | 🔴 **Still present** — `dashboard.ts:35` has `db.vehicle.count({ where: { status: { in: ['ACTIVE_RENTAL', 'OVERDUE'] } } })` for `activeRentals` and `dashboard.ts:23` for `activeRiders` separately. So the original bug appears fixed at the DB-query level. **But the analytics cross-audit claim** that `activeRiders` count is shown as "active rentals" on the UI is a separate concern. Need to re-verify the analytics.use-cases.ts path | Re-verify in PR-9 |
| 15 | 7th | P1-P3: race conditions, lifecycle enum, hard-delete | 🔴 **Likely still present** — the 7th audit's structural claims (lifecycle enum duplication across modules, hard-delete with audit gap) | Fix in PR-9 |
| 16 | 13th | P0-1: verify-lock bug | ✅ **Already fixed** — `verify-lock/route.ts:66` now reads `lockPasswordHash` | None — drop from plan |
| 17 | 13th | P0-2: Flutter never calls `postRiderDeviceVerifyLock` | 🔴 **Likely still true** — the dead method on the API client. Need to verify | Fix in PR-8 (verify it before considering the lock feature done) |

---

## Plan structure

The remaining 11 items that need action are grouped into **9 PRs** across **3 phases**, with explicit hour estimates, dependencies, and the per-PR test gates.

- **Phase 1 (correctness, ~6.5 hours):** PR-1, PR-2, PR-3, PR-4, PR-9 — pure code-level fixes with no feature work
- **Phase 2 (UI wiring, ~5.5 hours):** PR-5, PR-6, PR-8 — backend work that needs UI to call the new endpoint
- **Phase 3 (feature work, deferred):** PR-7 — needs product decision before scoping

---

## PHASE 1 — Correctness fixes (no UI changes)

### PR-1: Delete dead `admin.routes.ts` and align password rule (1 hour)
**Resolves:** 5th audit #3 (two parallel admin code paths)
**Verified state:** `web/src/server/modules/admin/admin.routes.ts` still exists as a "thin admin route handlers using withPermission/withAdmin wrappers" file. It uses `PasswordComplexitySchema` (8+ chars, upper/lower/digit/special). The live `web/src/app/api/admin/admins/route.ts` uses `createAdminSchema` from `validators/admin.ts` with `password: z.string().min(8)`. **An admin created via the live route can have a weak password; the dead wrapper would have rejected it.**

**Changes (1 PR, 1 file + 1 import cleanup):**
1. **Delete** `web/src/server/modules/admin/admin.routes.ts` (143 lines).
2. **Tighten** the live `createAdminSchema` in `web/src/lib/validators/admin.ts:96-104`:
   ```ts
   password: PasswordComplexitySchema,  // 8 chars + upper + lower + digit + special
   ```
   Import the existing `PasswordComplexitySchema` from `web/src/lib/validators.ts:4-10` (it's already exported; just needs a new import in `validators/admin.ts`).
3. **Apply** the same `PasswordComplexitySchema` to `updateAdminSchema.password` (line 111).
4. **Remove** the `import` of `PasswordComplexitySchema` from any other file that no longer needs it after this change.
5. **Add** a vitest asserting the live route rejects `password: 'admin123'` with 400 and the live route accepts `password: 'Admin123!@#'`.

**Test gate:** `npx vitest run tests/unit/api/admin-validators.test.ts` (new test) passes; existing admin tests still pass.

**Hour estimate:** 1 hour.

---

### PR-2: Remove dead `getDashboard()` from `analytics.use-cases.ts` (30 min)
**Resolves:** 5th audit #7 (hardcoded zeros in dead `getDashboard()`)
**Verified state:** `web/src/server/modules/analytics/analytics.use-cases.ts:11-58` likely still contains the dead `getDashboard()` returning hardcoded zeros. (Need to confirm with a direct file read during execution; flagged as 🔴 likely still true based on the 5th audit's structural claim and absence of any fix in subsequent sessions.)

**Changes (1 PR, 1 file):**
1. **Open** `web/src/server/modules/analytics/analytics.use-cases.ts`.
2. **Identify** the `getDashboard()` function (likely between lines 11-58 per the 5th audit).
3. **Grep** the codebase for any caller: `grep -rn "getDashboard()" web/src`.
4. If no callers: **delete the function** (and the unused `getOverview()` if it's only called by `getDashboard()`).
5. If there are callers: leave a `// DEPRECATED: returns hardcoded zeros per 5th audit` comment and route the callers to the live `getDashboardStats()` in `web/src/lib/services/dashboard.ts:5`.
6. **Update** any tests that import the dead function.

**Test gate:** `npx vitest run tests/unit/server/use-cases/analytics*` passes.

**Hour estimate:** 30 min (most of the time is the grep + the read).

---

### PR-3: Strip PII from dashboard response + fold N+1 into single query (2 hours)
**Resolves:** 13th audit P0-3 (4 PII fields on every dashboard load) + P0-4 (N+1 query for `assignedVehicle`)
**Verified state:** The dashboard query in `rider.use-cases.ts` (per 13th audit line numbers 180-184 and 250-253) still includes `kycProfile.aadhaarNumber/panNumber/bankName/accountNumber` and the extra `db.vehicle.findUnique` for `assignedVehicle`.

**Changes (1 PR, 1 file — `web/src/server/modules/riders/rider.use-cases.ts`):**

**P0-3 — drop the 4 PII fields (30 min):**
1. **Find** the dashboard include block (around line 180-184 per the 13th audit). It likely reads:
   ```ts
   kycProfile: {
     select: { /* KYC fields + */ aadhaarNumber: true, panNumber: true, bankName: true, accountNumber: true },
   },
   ```
2. **Remove** the four PII fields from the `select`. Keep the non-PII KYC fields (status, profilePhoto, etc.) that the dashboard actually needs.
3. **Verify** with `grep -rn "aadhaarNumber\|panNumber\|bankName\|accountNumber" web/src/app/api/rider/dashboard/` — should be 0 hits in the response path.
4. **Add** a comment: `// DPDP §6: data minimization. 4 PII fields removed in PR-3 (13th audit P0-3).`

**P0-4 — fold the N+1 (1.5 hours):**
1. **Find** the `db.vehicle.findUnique({ where: { vehicleId: flatRider.assignedVehicle } })` call (around line 250-253 per the 13th audit).
2. **Trace** the data flow: the rider query already includes `assignedVehicle` (a string), and the second query loads the full vehicle object. **If** the dashboard only needs `vehicleNumber` (per the 13th audit), fold the lookup into the rider include:
   ```ts
   const rider = await db.rider.findUnique({
     where: { id: riderDbId },
     include: {
       // ...
       vehicle: {  // relation from Rider.assignedVehicle to Vehicle
         select: { vehicleNumber: true, /* other dashboard fields */ },
       },
     },
   });
   ```
3. **Remove** the standalone `db.vehicle.findUnique` block.
4. **Update** the response shape: `assignedVehicle.vehicleNumber` instead of `assignedVehicle: { vehicleNumber }`.
5. **Verify** Flutter `RiderModel.assignedVehicle` type matches; if not, update the model.

**Test gate:**
- `npx vitest run tests/integration/rider/onboarding.test.ts` (and similar) still pass.
- New vitest: dashboard response does NOT contain `aadhaarNumber`, `panNumber`, `bankName`, `accountNumber`.
- New vitest: dashboard load uses a single Prisma query (count the queries via `prisma.$on('query')` in the test).

**Hour estimate:** 2 hours.

---

### PR-4: NaN-guard the earnings `page` and `limit` params (15 min)
**Resolves:** 13th audit P0-6 (`?page=abc` → `NaN`)
**Verified state:** `web/src/app/api/rider/earnings/route.ts:17-18` still does `parseInt(url.searchParams.get('page') || '1')` with no NaN guard.

**Changes (1 PR, 1 file):**
```ts
// Before
const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20')), 100);

// After
const pageRaw = parseInt(url.searchParams.get('page') || '1', 10);
const limitRaw = parseInt(url.searchParams.get('limit') || '20', 10);
const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
const limit = Number.isFinite(limitRaw) && limitRaw >= 1 ? Math.min(Math.floor(limitRaw), 100) : 20;
```

**Apply the same pattern** to every other route that does `parseInt(searchParams.get(...))`:
- `web/src/app/api/admin/transactions/route.ts:47-48`
- `web/src/app/api/admin/admins/route.ts:23-24`
- `web/src/app/api/admin/audit-logs/route.ts:16-17`
- `web/src/app/api/admin/incidents/route.ts:20-21`
- `web/src/app/api/admin/tickets/route.ts:26-27`
- `web/src/app/api/admin/notifications/route.ts:16-17`
- `web/src/app/api/admin/rewards/route.ts:16-17` (already paginated)
- `web/src/app/api/admin/riders/route.ts` (paginated)
- `web/src/app/api/admin/team-leaders/route.ts:21-22`

**Extract a helper** to `web/src/lib/validators.ts` (or `web/src/lib/api-utils.ts`):
```ts
export function parsePositiveInt(value: string | null, fallback: number, max?: number): number {
  const parsed = parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}
```

**Test gate:** New vitest: `GET /api/rider/earnings?page=abc` returns 200 with the same payload as `?page=1` (no NaN crash). Same for `?limit=-5`, `?limit=99999` (clamped to 100).

**Hour estimate:** 15 min for the helper + 1 file. 1 hour total if applied to all 8+ paginated routes.

**Recommendation:** land this as **2 PRs**:
- **PR-4a (15 min):** the helper + earnings route (the originally-flagged P0).
- **PR-4b (45 min):** apply the helper to the other 7 admin routes (defense in depth).

---

### PR-5: Wire Flutter `postRiderDeviceVerifyLock` so the lock feature is end-to-end (1.5 hours)
**Resolves:** 13th audit P0-2 (Flutter never calls the verify endpoint)
**Verified state:** The Flutter API client has `postRiderDeviceVerifyLock` (per the 13th audit), but no Flutter UI calls it. After PR-1 (verify-lock fix), the backend is correct; the Flutter side needs wiring.

**Changes (1 PR, 2-3 files):**

**Backend (none — already fixed in PR-1):** 0 hours.

**Flutter (1.5 hours):**
1. **Find** the locked device UI. The 13th audit references `flutter/lib/widgets/locked_overlay.dart:83` as the place that POSTs. The current implementation may already call the endpoint but in a way that never gets reached (e.g., a "Try again" button that doesn't fire). Read the file.
2. **If the overlay is missing the verify call:** add a `TextField` for the lock code, a "Unlock" button, and the call to `_apiClient.postRiderDeviceVerifyLock({ password: code })`.
3. **On success:** dismiss the overlay, show a confirmation snackbar.
4. **On failure:** show a snackbar with the server's error message ("Invalid lock password" or "Lock password is not configured").
5. **Add a unit/widget test:** locked overlay with a valid code calls the API; on success, the overlay is dismissed.

**Test gate:** `flutter test test/widgets/locked_overlay_test.dart` (or wherever the widget test lives) passes. E2E: `bash flutter/integration_test/e2e_individual/run_phased_tests.sh emulator-5554` for the lock flow.

**Hour estimate:** 1.5 hours.

---

### PR-9: Reconcile `activeRentals` / `activeRiders` and consolidate lifecycle enum (1.5 hours)
**Resolves:** 5th audit #1 (activeRentals = activeRiders conflation) + 7th audit structural claims (lifecycle enum duplication, dynamic pricing math)
**Verified state:**
- `dashboard.ts:35` correctly counts `vehicle` with status `ACTIVE_RENTAL` or `OVERDUE` for `activeRentals` — the DB-query-level bug is **fixed**.
- But `analytics.use-cases.ts:54` still computes `activeRiders` from a SQL aggregate, and the **Operations Board** screen (per 5th audit) was reported as showing the same conflation. Need to re-verify whether the UI side still aliases the two.

**Changes (1 PR, 2-3 files):**

**Step 1: Re-verify the active-riders vs active-rentals story (30 min):**
1. **Read** the Operations Board UI (`web/src/components/admin/screens/OperationsBoard.tsx` — per prior audit).
2. **Confirm** whether the screen still shows `activeRiders` labeled as "Active Rentals" or whether the labels are now distinct.
3. **If still conflated:** rename the label to "Active Riders (count)" in the Operations Board card so the value is no longer misrepresented.
4. **Search** for other UI surfaces that read `activeRiders` and label it "active rentals": `grep -rn "active rentals" web/src/components/`.
5. **Fix** any incorrect labels.

**Step 2: Consolidate lifecycle enum (1 hour):**
1. **Find** all `lifecycleRank` / `lifecycleStatus` map declarations. The 7th audit noted them in `rental.use-cases.ts`, `plans.use-cases.ts`, `referral.use-cases.ts` (3 copies per the 14th audit). Locate them.
2. **Create** `web/src/lib/lifecycle.ts`:
   ```ts
   export const LIFECYCLE_RANK: Record<string, number> = {
     NEW: 0, PHONE_VERIFIED: 1, PROFILE_SUBMITTED: 2, KYC_SUBMITTED: 3,
     KYC_APPROVED: 4, GUARANTOR_SUBMITTED: 5, GUARANTOR_APPROVED: 6,
     DEPOSIT_PENDING: 7, DEPOSIT_APPROVED: 8, PLAN_SELECTED: 9,
     PICKUP_SCHEDULED: 10, ACTIVE: 11, SUSPENDED: 12, RETURN_PENDING: 13,
     CLOSED: 14,
   };
   export function rankFor(status: string): number {
     return LIFECYCLE_RANK[status] ?? 0;
   }
   ```
3. **Replace** each duplicate `lifecycleRank` literal in the 3+ files with an import of `rankFor`.
4. **Add** a vitest asserting `rankFor('ACTIVE') === 11` and `rankFor('garbage') === 0`.

**Test gate:** All audits that read lifecycleStatus pass. No `lifecycleRank` literal remains in `web/src/server/modules/`.

**Hour estimate:** 1.5 hours.

---

## PHASE 2 — UI wiring (backend + Flutter)

### PR-6: Resolve the `getRiderOffers()` dead-end — ship a "Promotions" tab or delete the endpoint (4 hours)
**Resolves:** 14th audit P0-2 (`getRiderOffers` is dead code)
**Verified state:** `api_client.dart:383` has `getRiderOffers()` with zero production callers. The route at `web/src/app/api/rider/offers/route.ts:11` calls `offerUseCases.getActiveSponsored()` with no rider filter, no limit, no rate limit. This is a security gap waiting to be exploited if a future engineer wires the endpoint.

**This is a product decision.** Two paths:

**Path A — ship a "Promotions" tab (4 hours):**
1. **Add** a `take: 50` cap to `getActiveSponsored` in `web/src/server/modules/offers/offer.use-cases.ts:69-75`.
2. **Add** a `getRiderOffers` screen at `flutter/lib/features/offers/presentation/screens/offers_screen.dart` (new feature folder).
3. **Add** a `Promotions` card to the dashboard (similar to the `ReferralCard` in `flutter/lib/features/referrals/widgets/referral_card.dart`).
4. **Wire** the call: `_apiClient.getRiderOffers()` on dashboard load, render the first 3 sponsored offers.
5. **Add** a widget test asserting the offers render correctly.

**Path B — delete the endpoint (30 min):**
1. **Delete** `web/src/app/api/rider/offers/route.ts`.
2. **Delete** `getRiderOffers` from `api_client.dart:383`.
3. **Document** in the commit: "Promotions feature deferred until product decision."
4. **Add** an entry to `docs/FOLLOWUP_TICKETS.md` for tracking.

**Recommendation:** **Path B is the right call for this 2-month window.** Path A is a real feature that needs product copy, design review, and A/B testing. We are in cleanup mode, not feature mode.

**Hour estimate:** 30 min (Path B) or 4 hours (Path A).

---

### PR-7: Two-person rule for data deletion — add the missing approval endpoint (1 day)
**Resolves:** 1st audit P0-1 (data deletion flow is incomplete)
**Verified state (re-read 2026-08-06):**
- The DELETE endpoint at `web/src/app/api/admin/riders/[id]/data-deletion/route.ts:13` is now properly implemented: it reads an `approvalToken` from body or `x-approval-token` header, looks up an `AuditLog` row with action `RIDER_DATA_DELETION_APPROVED`, verifies the token matches, and enforces the two-person rule (`requestedBy !== actorId`).
- The `auditLog` schema has an `expiresAt` field (per `web/src/lib/audit-log.ts:63, 82-84, 98-100`).
- **But the approval endpoint is still missing.** The UI calls `POST /api/admin/riders/${riderId}/data-deletion/approve` (per the 1st audit), but no such route exists. The token is therefore never minted, and every delete returns "No valid approval found."

**Changes (1 PR, 4 new files + 1 modified):**

**Backend (4 hours):**

1. **Add** `web/src/app/api/admin/riders/[id]/data-deletion/approve/route.ts`:
   ```ts
   export async function POST(
     req: NextRequest,
     { params }: { params: Promise<{ id: string }> }
   ) {
     const session = await requirePermission('riders_delete_approve');
     if (!session) return adminForbidden();
     const { id: riderId } = await params;
     const { reason } = body;
     if (!reason || reason.length < 5) return errors.validation('reason is required (min 5 chars)');

     // Generate a one-time token
     const token = generateSecureToken(32);  // crypto.randomBytes(32).toString('hex')
     const expiresAt = new Date(Date.now() + 60 * 60 * 1000);  // 1 hour

     await createAuditLog({
       actorId: session.adminId,
       action: 'RIDER_DATA_DELETION_APPROVED',
       entity: 'rider',
       entityId: riderId,
       details: { approvalToken: token, requestedBy: session.adminId, reason, expiresAt: expiresAt.toISOString() },
       expiresAt,  // ensure the audit-log lib accepts this param
     });

     return success({ approvalToken: token, expiresAt: expiresAt.toISOString() });
   }
   ```

2. **Add** `web/src/app/api/admin/riders/[id]/data-deletion/restore/route.ts` — flips `lifecycleStatus` from `CLOSED` back to `ACTIVE`, clears `deletedAt`. Permission `riders_delete_approve`.

3. **Add** the `riders_delete_approve` permission to `web/src/lib/permissions-roles.ts` (granted to `SUPER_ADMIN` only — the operation is irreversible).

4. **Add** a soft-delete filter to the existing list endpoint — accept `?deleted=true` and filter where `lifecycleStatus = 'CLOSED' AND deletedAt IS NOT NULL`.

5. **Update** `web/src/lib/audit-log.ts` if the `expiresAt` parameter is not yet exposed (the function signature may need to be extended).

6. **Add** a background worker that scans for `lifecycleStatus = 'CLOSED' AND deletedAt < now() - 7 days` and hard-anonymizes (clears `aadhaarNumber`, `panNumber`, `phone`, `email`, etc.). The DELETE endpoint is now a soft-delete; the worker is the hard-delete.

**Flutter (4 hours):**

1. **Update** the `DataDeletionApprovalCard.tsx` to:
   - POST to the new `/approve` endpoint on "Issue approval token" click.
   - Show the returned token to admin 1.
   - Have admin 2 enter the token in the "Execute deletion" form.
   - POST the token to the existing `/data-deletion` DELETE endpoint (or its current `riderId/data-deletion` form).

2. **Update** the `DataDeletionQueueTable.tsx` to fetch from `GET /api/admin/riders?deleted=true` (new query param).

3. **Add** a "Restore" button to the queue table that POSTs to the new `/restore` endpoint.

**Test gate:**
- `npx vitest run tests/integration/admin/data-deletion-flow.test.ts` passes (currently validates Zod only).
- New vitest: the approval flow (admin 1 issues → admin 2 executes with token → 200; admin 1 tries to execute their own token → 403).
- New vitest: an expired token is rejected (set the audit log `expiresAt` to 5 minutes ago, then call DELETE).

**Hour estimate:** 1 day (4h backend + 4h Flutter + tests).

---

### PR-8: Hide "VOLTIUM-XXXX" placeholder in `ReferralScreen` (1 hour)
**Resolves:** 14th audit P0-7
**Verified state:** `flutter/lib/features/referrals/presentation/screens/referral_screen.dart:74` still has:
```dart
final referralCode = rider?.referralCode ?? 'VOLTIUM-XXXX';
```

**Changes (1 PR, 1 file):**

1. **Modify** `referral_screen.dart:74`:
   ```dart
   // Before
   final referralCode = rider?.referralCode ?? 'VOLTIUM-XXXX';

   // After
   final referralCode = rider?.referralCode;
   ```

2. **Update** lines 207, 281 to render a Skeleton + retry button when `referralCode == null`:
   ```dart
   if (referralCode == null || referralCode.isEmpty) {
     return _ReferralCodeSkeleton();
   }
   ```

3. **Disable the share button** (line 278-284) when the code is missing.

4. **On mount**, if `rider?.referralCode` is null, call the **singular** `GET /api/rider/referral` endpoint (per the 14th audit, this endpoint exists but is dead). If the endpoint returns null, show the skeleton. If it returns a code, store it in a local `ReferralCodeState` provider.

5. **Add a unit test:** when `rider.referralCode` is null, the screen does NOT contain the string `"VOLTIUM-XXXX"`.

**Test gate:** `flutter test test/features/referrals/presentation/screens/referral_screen_test.dart` passes.

**Hour estimate:** 1 hour.

---

## PHASE 3 — Feature work (deferred, needs product decision)

### PR-7 (in 14th audit numbering, **not** the data-deletion PR): "Redeem reward" endpoint + UI
**Resolves:** 14th audit P0-6 (no redemption flow; `RewardsScreen` always shows empty state)
**Status:** ⏸ **Deferred — needs product decision**

**This is a 2-day feature PR per the 14th audit's fix-shape estimate. It requires:**
1. Decision: rewards = wallet credits OR external (Amazon voucher, etc.)?
2. New Prisma models: `RewardCatalog`, `RewardRedemption`, OR extending `Reward` with `redeemedAt`.
3. New endpoint: `POST /api/rider/rewards/:id/redeem`.
4. Wallet debit (or external provider integration).
5. UI: redemption flow on `RewardsScreen`.
6. Tests: redemption, idempotency, balance check.

**This is out of scope for the current cleanup cycle.** Add to `docs/FOLLOWUP_TICKETS.md` and revisit at the next planning session.

---

## Summary table

| PR | Resolves | Effort | Risk | Test gate |
|---|---|---|---|---|
| PR-1: Delete `admin.routes.ts`, tighten password | 5th #3 | 1 h | Low (deletion) | New + existing admin tests pass |
| PR-2: Remove dead `getDashboard()` | 5th #7 | 30 m | Low (deletion) | Analytics tests pass |
| PR-3: Strip dashboard PII + fold N+1 | 13th P0-3, P0-4 | 2 h | Low (drop fields, fold query) | PII redaction vitest + query-count vitest |
| PR-4a: NaN-guard earnings `page`/`limit` | 13th P0-6 | 15 m | Very low | NaN-edge vitest |
| PR-4b: Apply helper to 7 admin routes | 13th P0-6 follow-on | 45 m | Very low | Existing admin tests pass |
| PR-5: Wire Flutter lock-verify UI | 13th P0-2 | 1.5 h | Low | Widget test + E2E lock flow |
| PR-6: Delete `getRiderOffers` (Path B) | 14th P0-2 | 30 m | Low (deletion) | flutter analyze passes |
| PR-7: Two-person rule endpoints + Flutter wiring | 1st P0-1 | 1 day | Med (new endpoints + new UI) | New integration tests + existing admin tests |
| PR-8: Hide "VOLTIUM-XXXX" placeholder | 14th P0-7 | 1 h | Low | Widget test for skeleton |
| PR-9: Reconcile `activeRentals` label + lifecycle enum | 5th #1 + 7th | 1.5 h | Med (lifecycle enum affects many modules) | Existing onboarding tests pass |
| **Total** | | **~9 hours** | | |
| ~~DEFERRED: Redeem reward~~ | 14th P0-6 | 2 days | High | Needs product decision |

---

## Execution order

1. **PR-4a (15 m)** — easiest, smallest blast radius, no risk. Land first to validate the helper.
2. **PR-1 (1 h)** — delete dead code is the lowest-risk cleanup.
3. **PR-2 (30 m)** — dead-code deletion.
4. **PR-9 (1.5 h)** — lifecycle enum consolidation touches many files; land before PR-7 (which uses lifecycle ranks in the new approval flow).
5. **PR-6 (30 m)** — delete the offers endpoint.
6. **PR-3 (2 h)** — PII strip + N+1 fold. Single-file, contained.
7. **PR-8 (1 h)** — UI placeholder fix.
8. **PR-4b (45 m)** — apply the helper across the rest of the admin routes.
9. **PR-5 (1.5 h)** — Flutter lock-verify wiring. Needs a real device or emulator to test the full flow.
10. **PR-7 (1 day)** — two-person rule. The largest change. Land last to avoid blocking other PRs on review.

**Total in this window:** ~9 hours. PR-7 is the only one that requires a full day.

---

## Documentation deliverables

Each PR should include:
1. The 1-line summary in the commit message (referencing the audit, e.g., "PR-1: 5th audit #3 — delete dead `admin.routes.ts` wrapper, tighten live password rule").
2. An entry in `docs/AUDIT_INDEX_2026-08-03.md` (the reclassification ledger) referencing this fix.
3. An entry in `docs/RELEASE_READINESS_2026-08-29.md` (or next release) noting the cumulative fixes.

**Track all 11 active items + the 6 already-fixed items in the audit ledger** so the next reviewer can see the cumulative progress.

---

## Out-of-scope reminders (audit items I am explicitly NOT fixing in this plan)

- **6th audit P0-6** (two parallel legal schemas) — **already addressed** in prior work. Confirmed by re-reading `validators.ts:290-293`.
- **12th audit P0-4** (dead `POST /api/rider/device`) — **already removed**. Confirmed by `glob`-ing the directory.
- **12th audit P0-6** (guarantor schema `relation`) — **already fixed**. `guarantorRelation` is on the top-level profile schema as `z.string().nullish()`.
- **14th audit P0-6** (no redeem-reward endpoint) — **deferred** (Phase 3, needs product decision).
- **13th audit P0-1** (verify-lock bug) — **already fixed**. `verify-lock/route.ts:66` reads `lockPasswordHash`.
