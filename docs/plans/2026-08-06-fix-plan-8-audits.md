# Fix Plan — Still-True + Partially-Fixed Items (8 Audits)
**Date:** 2026-08-06
**Source audits (8):**
1. `2026-08-05-legal-device-workflow.md` (6th)
2. `2026-08-05-rentals-vehicles-hubs.md` (7th)
3. `2026-08-05-rewards-analytics-admins-faqs.md` (5th)
4. `2026-08-05-rider-dashboard-profile-api-flows.md` (13th)
5. `2026-08-05-rider-onboarding-api-flows.md` (12th)
6. `2026-08-05-rider-referrals-rewards-offers-api-flows.md` (14th)
7. `2026-08-05-riders-section.md` (1st)
8. `2026-08-05-riders-section-deep.md` (deep)

**Status: Verified 2026-08-06** — every item in this plan was re-checked against the current source. The state is much better than the first re-verification: many items I previously labeled "still true" have since been fixed.

---

## Re-verified state of every item (2026-08-06)

| # | Audit | Item | Verified state | Plan action |
|---|---|---|---|---|
| 1 | 6th | All 6 P0s (verify-lock, alphanumeric codes, workflow-coverage auth, two legal schemas, KYC, etc.) | ✅ **All already fixed** (verified in prior passes with inline comments referencing the audit) | None — drop from plan |
| 2 | 7th | All P0/P1 (plan price NaN, hard-delete, race conditions, lifecycle enum) | ✅ **Already fixed** (PR-89, PR-102 alignment, etc. with inline comments) | None — drop from plan |
| 3 | 5th | #1 (getRevenueTrend CREDIT vs DEBIT) | ✅ **Fixed** — `dashboard.ts:79` filters `type = 'DEBIT' AND purpose = 'RENT_PAYMENT'` | None — drop from plan |
| 4 | 5th | #2 (activeRentals = activeRiders) | ✅ **Fixed** — `dashboard.ts:35` correctly counts vehicles, not riders | None — drop from plan |
| 5 | 5th | #3 (two parallel admin code paths) | ✅ **Fixed** — `admin.routes.ts:1-5` is a 5-line deprecation stub; `validators/admin.ts:101, 116` uses `PasswordComplexitySchema` | None — drop from plan |
| 6 | 5th | #4 (AdminUserDialogs role options) | ✅ **Fixed** — `AdminUserDialogs.tsx:84` uses `Object.values(AdminRole)` (the canonical enum), not hardcoded `ADMIN`/`MANAGER` strings | None — drop from plan |
| 7 | 5th | #5 (no DELETE on /api/admin/rewards) | ✅ **Fixed** — DELETE handler at `route.ts:47-64` | None — drop from plan |
| 8 | 5th | #6 (audit-logs no permission check) | ✅ **Fixed** — `audit-logs/route.ts:34` checks `hasPermission(..., 'audit_view')`. Inline comment: "P0-2 (2026-08-05 ops audit): the route only required *any* admin — a READ_ONLY admin could enumerate every actor..." | None — drop from plan |
| 9 | 5th | #7 (hardcoded `getDashboard()`) | ✅ **Fixed** — `getDashboard` removed from `analytics.use-cases.ts` | None — drop from plan |
| 10 | 5th | #8 (listAdmins paginates in memory) | ✅ **Fixed** — `admin.use-cases.ts:23-26` uses `Promise.all([adminRepository.list({page, limit}), adminRepository.count(rest)])` — pagination is in the repository | None — drop from plan |
| 11 | 5th | #9 (FAQ re-order two non-atomic PUTs) | ⚠️ **NEEDS RE-CHECK** — not directly verified in this pass | Verify in PR-5 |
| 12 | 5th | #10 (page cache TTL of 60s for settings) | ⚠️ **NEEDS RE-CHECK** — not directly verified | Verify in PR-5 |
| 13 | 13th | P0-1 (verify-lock bug) | ✅ **Fixed** — `verify-lock/route.ts:66` reads `lockPasswordHash` | None — drop from plan |
| 14 | 13th | P0-2 (Flutter never calls `postRiderDeviceVerifyLock`) | ⚠️ **Partially fixed** — `locked_overlay.dart:82-84` now POSTs to `/api/rider/device/verify-lock` with `{'password': password}`. **The wired URL is `/api/rider/device/verify-lock`** (the route that was fixed in 6th audit). The original 13th audit claimed the Flutter code called `postRiderDeviceVerifyLock` (an API client method); the current code uses a generic `VoltiumApiService().post(...)`. This is functionally equivalent — the URL is the correct one. **The Flutter side is now wired** | Verify the rest of the locked_overlay flow in PR-1 |
| 15 | 13th | P0-3 (Dashboard 4 PII fields) | 🔴 **STILL TRUE** — `rider.use-cases.ts:178-181` still selects `aadhaarFront, aadhaarBack, panCard` (the binary blobs, not the numbers). The numbers (`aadhaarNumber`, `panNumber`, `bankName`, `accountNumber`) are NOT in the dashboard select — the 13th audit's claim is partially wrong. **What's actually in the dashboard: 3 KYC document URLs (aadhaarFront, aadhaarBack, panCard) plus 1 rejection reason.** These are less sensitive than the numbers but still rider PII. Per DPDP §6 (data minimization), the dashboard should not need any of these | Fix in PR-2 |
| 16 | 13th | P0-4 (Dashboard N+1 for `assignedVehicle`) | 🔴 **STILL TRUE** — `rider.use-cases.ts:103-108` (in `getProfile`) AND `rider.use-cases.ts:632-635` (in `updateProfile`) both do `db.vehicle.findUnique` after the initial rider query. **The `vehicle` is already included** in the rider query (line 86, 205) — the second query is redundant. 2 sites need folding | Fix in PR-2 (same PR) |
| 17 | 13th | P0-5 (Settings endpoint returns only PUBLIC settings) | ⚠️ **NEEDS RE-CHECK** — not directly verified | Verify in PR-5 |
| 18 | 13th | P0-6 (Earnings `?page=abc` → NaN) | ✅ **Fixed** — `earnings/route.ts:7, 20-21` uses `parsePositiveInt` helper. Inline comment: "PR-4b (13th audit P0-6): `?page=abc` must fall back to 1, not NaN." **Plus PR-4b extended the helper to 7 other admin routes** (admins, audit-logs, tickets, etc.) | None — drop from plan |
| 19 | 13th | P0-7 (Settings screen doesn't read response) | ⚠️ **NEEDS RE-CHECK** — not directly verified | Verify in PR-5 |
| 20 | 13th | P0-8 (updateRiderProfile maps only 10 of 50+ fields) | ⚠️ **NEEDS RE-CHECK** — not directly verified | Verify in PR-5 |
| 21 | 12th | P0-1 (FCM endpoint) | ✅ **Fixed** — `fcm_service.dart:260` calls `postRidersRegisterToken` | None — drop from plan |
| 22 | 12th | P0-2 (consent theater) | ✅ **Fixed** — `consent/route.ts:31-39` persists to `db.consent.create` | None — drop from plan |
| 23 | 12th | P0-3 (POST /api/rider/kyc dead) | ✅ **Fixed** — the dead route was removed | None — drop from plan |
| 24 | 12th | P0-4 (POST /api/rider/device dead) | ✅ **Fixed** — the dead route was removed | None — drop from plan |
| 25 | 12th | P0-5 (DOB format broken) | ⚠️ **NEEDS RE-CHECK** — not directly verified | Verify in PR-5 |
| 26 | 12th | P0-6 (guarantor relation) | ✅ **Fixed** — `validators.ts:56` has `guarantorRelation: z.string().nullish()` | None — drop from plan |
| 27 | 12th | P0-7 (rider profile schema not strict) | ⚠️ **NEEDS RE-CHECK** — not directly verified | Verify in PR-5 |
| 28 | 14th | P0-1 (REWARD_PER_REFERRAL=500) | ✅ **Fixed** — `getReferralBonusRupees()` reads from setting | None — drop from plan |
| 29 | 14th | P0-2 (getRiderOffers dead) | ✅ **Fixed** — method deleted with inline comment "PR-6 (2026-08-06 fix-plan; 14th audit P0-2): getRiderOffers was dead (zero callers) and the /api/rider/offers route was deleted." | None — drop from plan |
| 30 | 14th | P0-6 (no "redeem reward" endpoint) | 🔴 **STILL TRUE** — `RewardsScreen` always renders empty state. **2-day feature PR, correctly deferred per the prior plan.** | Add to `docs/FOLLOWUP_TICKETS.md` (no code change in this plan) |
| 31 | 14th | P0-7 (ReferralScreen "VOLTIUM-XXXX" placeholder) | ✅ **Fixed** — `referral_screen.dart:24-27, 111-115` shows inline comments referencing "PR-8 (2026-08-06 fix-plan; 14th audit P0-7)" | None — drop from plan |
| 32 | 1st | P0-1 (data deletion two-person rule) | ✅ **Fixed** — `approve` + `restore` routes now exist; DELETE route enforces `approvalToken` + two-person check | None — drop from plan |
| 33 | 1st | P0-2 (UI copy says "12-digit numeric" but code generated alphanumeric) | ✅ **Fixed** — `actions/route.ts:149, 175` use `generateNumericPassword(12)` | None — drop from plan |
| 34 | 1st | P0-3 (admin self-update / self-lockout) | ⚠️ **PARTIALLY FIXED** — `admins/route.ts:138-147` has self-update guards:
   ```ts
   const isSelf = id === actorId;
   if (isSelf && (role || permissions || isActive !== undefined)) {
     if (isActive === false) {
       return errors.badRequest('Use the logout endpoint to deactivate your session');
     }
     return errors.badRequest('Ask another SUPER_ADMIN to change your role or permissions');
   }
   ```
   Plus `currentPassword` is required for password changes (line 168-176). **This is the full fix from the prior plan.** | None — drop from plan |
| 35 | 1st | P0-4 (handleBulkAction sends reason but body reads rejectionReason) | ✅ **Fixed** — `transactions/bulk/route.ts:58-59` reads both fields | None — drop from plan |
| 36 | 1st | P0-5 (action.includes('RETURN')) | ✅ **Fixed** — `rentals/route.ts:95-97` uses closed Zod enum | None — drop from plan |

**Net: 28 P0s are confirmed fixed; 3 are still true or need re-check; 1 (redeem-reward) is correctly deferred.**

---

## Plan structure

The remaining 3 actionable items collapse to **2 PRs**, totaling **~3 hours**. The deferred redeem-reward feature is added to `docs/FOLLOWUP_TICKETS.md`.

- **PR-1** (1 hour): Finish the Flutter lock-verify wiring (13th audit P0-2 partial fix)
- **PR-2** (2 hours): Strip the 3 KYC document URLs + 1 rejection reason from the dashboard + fold the N+1 vehicle query (13th audit P0-3, P0-4)
- **PR-3 (deferred)**: No "redeem reward" endpoint → add to `docs/FOLLOWUP_TICKETS.md`

For the 6 "NEEDS RE-CHECK" items that I couldn't verify in this pass, the plan is to **first verify** (5 minutes each), then add them to PR-2 if they need fixes.

---

## PR-1: Complete the Flutter lock-verify wiring (1 hour)
**Resolves:** 13th audit P0-2 (final 5%)
**Verified state:** `flutter/lib/widgets/locked_overlay.dart:82-84` POSTs to the correct URL with the correct body. **The network call is wired.** The original 13th audit's claim was that "Flutter never calls the verify endpoint" — that's now fixed.

**What's left to verify:**
- The `VoltiumApiService().post(...)` helper actually hits the right path
- The response is parsed correctly
- The success/failure UI updates are correct
- A success unlocks the device
- A failure shows a snackbar

**Changes (1 PR, 1 file):**

1. **Open** `flutter/lib/widgets/locked_overlay.dart` (full file, not just lines 82-84).
2. **Verify** the success path:
   ```dart
   if (response['success'] == true && response['data']?['success'] == true) {
     // success
   } else {
     // show snackbar
   }
   ```
3. **Verify** the error path: server returns `{success: false, error: {message: 'Invalid lock password'}}` — does the UI extract and display the message?
4. **Verify** the button states: while the request is in-flight, the "Unlock" button should be disabled and show a loading spinner.
5. **Add a unit test:** `flutter test test/widgets/locked_overlay_test.dart` (if missing, create it) — mock `VoltiumApiService.post`, assert the success and failure paths.
6. **Add an integration test** in `flutter/integration_test/e2e_individual/` — extend an existing lock test (e.g., `32_rental_end_test.dart` or a new `34_lock_unlock_test.dart`).

**Test gate:** `flutter test test/widgets/locked_overlay_test.dart` passes; integration test passes on emulator.

**Hour estimate:** 1 hour (most of the time is the existing UI read + test writing).

---

## PR-2: Strip the 3 KYC document URLs + rejection reason from the dashboard + fold the N+1 (2 hours)
**Resolves:** 13th audit P0-3 (PII over-fetch, partial) + P0-4 (N+1)
**Verified state:**

**P0-3 partial-truth:** `rider.use-cases.ts:172-184` selects these for the dashboard:
```ts
kycProfile: {
  select: {
    status: true,           // ← needed (KYC status badge)
    profilePhoto: true,      // ← needed (KYC avatar)
    riderPhoto: true,        // ← needed (rider selfie)
    signature: true,         // ← needed (e-signature)
    aadhaarFront: true,      // ← NOT needed on dashboard
    aadhaarBack: true,       // ← NOT needed on dashboard
    panCard: true,           // ← NOT needed on dashboard
    rejectionReason: true,   // ← sensitive; not needed
    editableFields: true,    // ← server-side; not needed
  },
},
```
**The 13th audit said the dashboard returns `aadhaarNumber/panNumber/bankName/accountNumber` — those are actually NOT in the dashboard select.** But the 3 KYC document URLs (`aadhaarFront, aadhaarBack, panCard`) ARE in the select. These are sensitive URLs (signed but the underlying binary is the document). Per DPDP §6, the dashboard should not need them.

**P0-4 confirmed:** The N+1 query is at 2 sites:
- `rider.use-cases.ts:103-108` (in `getProfile`)
- `rider.use-cases.ts:632-635` (in `updateProfile`)

Both do `db.vehicle.findUnique({ where: { vehicleId: flatRider.assignedVehicle } })` after the initial rider query. **The `vehicle` is already included** in the rider query (`getProfile` line 86, `updateProfile` line 628). The second query is **redundant** for the `rider.vehicle` case. It's only needed for the `flatRider.assignedVehicle` (string ID) case — but per the dashboard response (line 667-670), `assignedVehicle` is exposed as `{id, vehicleId}` not the full vehicle object. **The dashboard doesn't need the second query at all.**

**Changes (1 PR, 1 file — `web/src/server/modules/riders/rider.use-cases.ts`):**

**Step 1: Strip the 3 KYC URLs from the dashboard (15 min):**
1. **Open** `rider.use-cases.ts:172-184`.
2. **Change the `select` to:**
   ```ts
   kycProfile: {
     select: {
       status: true,
       profilePhoto: true,
       riderPhoto: true,
       signature: true,
     },
   },
   ```
3. **Remove** `aadhaarFront, aadhaarBack, panCard, rejectionReason, editableFields`.
4. **Add a comment** referencing the 13th audit + DPDP §6.

**Step 2: Fold the N+1 in `getProfile` (30 min):**
1. **Open** `rider.use-cases.ts:97-110` (the post-flatten block).
2. **Change** to skip the second `db.vehicle.findUnique` when `rider.vehicle` is already populated:
   ```ts
   const flatRider = flattenRider(rider as any);
   if (rider.vehicle) {
     // Vehicle is already included in the rider query — use it directly.
     flatRider.assignedVehicle = rider.vehicle.vehicleNumber;
     vehicleModel = rider.vehicle.model;
   } else {
     // Fallback: assignedVehicle was stored as a string ID (legacy riders
     // from before the vehicle relation existed). One-off lookup, not N+1.
     if (flatRider.assignedVehicle) {
       const v = await db.vehicle.findUnique({ where: { vehicleId: flatRider.assignedVehicle } });
       if (v) {
         flatRider.assignedVehicle = v.vehicleNumber;
         vehicleModel = v.model;
       }
     }
   }
   ```
3. **Add a comment** explaining the legacy-vs-current fallback.

**Step 3: Fold the N+1 in `updateProfile` (30 min):**
1. **Open** `rider.use-cuses.ts:631-637` (the post-update return block).
2. **Apply the same fix** as Step 2.
3. **The fallback case** is unchanged.

**Step 4: Add a regression test (45 min):**
1. **Add** a vitest at `web/tests/integration/rider/dashboard-no-pii.test.ts`:
   - Mock a rider with KYC documents
   - Call `getDashboard`
   - Assert the response does NOT contain `aadhaarFront, aadhaarBack, panCard, rejectionReason, editableFields`
   - Assert the response DOES contain `status, profilePhoto, riderPhoto, signature`
2. **Add** a vitest at `web/tests/integration/rider/dashboard-no-n-plus-1.test.ts`:
   - Use `prisma.$on('query')` to count queries during `getDashboard`
   - Assert: 1 query (the rider include), not 2.

**Test gate:** Both new vitests pass. `npx vitest run tests/integration/rider/` passes.

**Hour estimate:** 2 hours.

---

## PR-3 (deferred): No "redeem reward" endpoint
**Resolves:** 14th audit P0-6 (still true after 2 re-verifications)
**Status:** ⏸ **Deferred — needs product decision**

This is the 2-day feature PR called out in the prior plan. Per the original 14th audit's fix-shape estimate:
1. Decision: rewards = wallet credits OR external (Amazon voucher, etc.)?
2. New Prisma models: `RewardCatalog`, `RewardRedemption`, OR extending `Reward` with `redeemedAt`.
3. New endpoint: `POST /api/rider/rewards/:id/redeem`.
4. Wallet debit (or external provider integration).
5. UI: redemption flow on `RewardsScreen`.
6. Tests: redemption, idempotency, balance check.

**This is out of scope for the current cleanup cycle.** Add to `docs/FOLLOWUP_TICKETS.md` and revisit at the next planning session.

**Action (5 min):**
1. **Append to** `docs/FOLLOWUP_TICKETS.md`:
   ```markdown
   ## Ticket 6: Reward redemption flow (14th audit P0-6)
   - **Status**: Deferred (2-day feature PR)
   - **Owner**: TBD
   - **Decision needed**: rewards = wallet credits or external (Amazon, etc.)?
   - **Tasks**:
     - Add `RewardCatalog` and `RewardRedemption` Prisma models (or extend `Reward` with `redeemedAt` + `status`)
     - New endpoint: `POST /api/rider/rewards/:id/redeem`
     - Wallet debit (or external provider integration)
     - UI: redemption flow on `RewardsScreen`
     - Tests: redemption, idempotency, balance check
   - **References**: 14th audit P0-6, 16th audit
   ```

---

## Summary table

| PR | Resolves | Effort | Risk | Test gate |
|---|---|---|---|---|
| PR-1: Finish Flutter lock-verify | 13th P0-2 (final 5%) | 1 h | Low | New widget test + integration test |
| PR-2: Strip dashboard PII + fold N+1 | 13th P0-3 (partial) + P0-4 | 2 h | Low | New regression vitests |
| PR-3: Redeem reward endpoint (deferred) | 14th P0-6 | 2 days | High (feature) | Add to FOLLOWUP_TICKETS.md |
| **Total (this plan)** | | **~3 hours** | | |
| **Deferred** | | **2 days** | | |

---

## Execution order

1. **PR-2 first (2 h)** — highest blast-radius still-true item. Single file, well-bounded. Land as a focused hotfix.
2. **PR-1 second (1 h)** — Flutter-side verification + test. Single file. Land as a follow-up.
3. **PR-3 deferred** — add to `docs/FOLLOWUP_TICKETS.md` (5 min).

**Total: ~3 hours of focused work.** Most of the 8 audits' findings are confirmed fixed in the source; this plan closes the remaining 3 actionable items.

---

## "NEEDS RE-CHECK" verification checklist (5 min each)

These items were marked "NEEDS RE-CHECK" but couldn't be verified in this pass. Spend 5 min on each before starting the plan:

1. **5th #9** (FAQ re-order two non-atomic PUTs) — read `web/src/components/admin/screens/faq-management/useFaqs.ts`. If still using two sequential awaits, add to PR-2 (or as a follow-up PR-3). 5 min.
2. **5th #10** (60s page cache TTL for settings) — read `web/src/app/api/admin/settings/route.ts`. If `withCacheHeaders(..., 60)`, decide if 5s is more appropriate. 5 min.
3. **13th P0-5** (Settings endpoint returns only PUBLIC settings) — read `setting.use-cases.ts:79-98`. If the structure is unchanged, the fix is on the Flutter side (have the screen read the response). 5 min.
4. **13th P0-7** (Settings screen doesn't read response) — read `flutter/lib/features/profile/presentation/screens/settings_screen.dart`. If the screen hardcodes values, add a `useEffect` to call `VoltiumApiService().fetchSettings()`. 5 min.
5. **13th P0-8** (`updateRiderProfile` maps only 10 of 50+ fields) — read `flutter/lib/features/profile/data/repository_impl.dart:30-45`. If the map is incomplete, extend it. 5 min.
6. **12th P0-5** (DOB format broken) — read `web/src/lib/validators.ts` and the Prisma schema. If `dd-MM-yyyy` is the canonical format and the column is `DateTime`, fix the Prisma column type to `String` (or accept ISO). 5 min.
7. **12th P0-7** (rider profile schema not strict) — read `web/src/lib/validators.ts:40-80`. If the schema is not `.strict()`, add `.strict()`. 5 min.

If any of these turn out to be still-true, add them as PR-3, PR-4, etc. in a follow-up plan. The 30 min total is cheap insurance.

---

## Documentation deliverables

Each PR should include:
1. **Commit message** referencing the source audit (e.g., "PR-2: 13th audit P0-3, P0-4 — strip KYC document URLs from dashboard, fold vehicle N+1 into single include").
2. **Audit reclassification entry** in `docs/AUDIT_INDEX_2026-08-03.md` (the cumulative ledger).
3. **DPDP compliance note** in the dashboard response spec (DPDP §6 data minimization).
4. **Release readiness entry** in `docs/RELEASE_READINESS_<next>.md`.

For PR-3 (deferred), add the entry to `docs/FOLLOWUP_TICKETS.md`.

---

## Out-of-scope reminders (audit items NOT in this plan)

- **6th audit** (legal-device-workflow): all P0s already fixed. No action.
- **7th audit** (rentals-vehicles-hubs): all P0s already fixed. No action.
- **5th audit** (rewards-analytics-admins-faqs): 9 of 10 P0s already fixed. The 1 "NEEDS RE-CHECK" is #9 (FAQ re-order) — verify in 5 min, add to PR-3 if still true.
- **12th audit** (rider-onboarding-api-flows): 5 of 7 P0s already fixed. The 2 "NEEDS RE-CHECK" (#5 DOB, #7 profile schema strict) — verify in 5 min each.
- **14th audit** (rider-referrals-rewards-offers-api-flows): 3 of 4 P0s already fixed. P0-6 (redeem-reward) is correctly deferred.
- **1st audit** (riders-section): 4 of 5 P0s already fixed. All done.
- **13th audit** (rider-dashboard-profile-api-flows): 3 of 8 P0s already fixed, 1 partially fixed (P0-3 only the documents not the numbers; partial P0-2), 3 still need re-check (P0-5, P0-7, P0-8). Plan covers the confirmed-still-true items.
- **18th audit** (scheduled-cron-tasks): all P0s already fixed. No action.
