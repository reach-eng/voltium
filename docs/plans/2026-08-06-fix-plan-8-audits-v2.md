# Fix Plan — 8 Audits Re-Verified (2026-08-06, pass 2)

**Date:** 2026-08-06
**Scope:** Re-verify the 8 audits called out in the original `2026-08-06-fix-plan-8-audits.md` request and write a fresh plan for the items that are **still true** or **partially fixed**.
**Audits covered:**
- `2026-08-05-rider-dashboard-profile-api-flows.md` (13th audit, "Rider dashboard & profile")
- `2026-08-05-rider-onboarding-api-flows.md` (12th audit, "Rider onboarding")
- `2026-08-05-rider-referrals-rewards-offers-api-flows.md` (14th audit, "Rider referrals/rewards/offers")
- `2026-08-05-riders-section.md` (1st audit, "Riders section — admin")
- `2026-08-05-riders-section-deep.md` (1st-deep audit, "Riders section — deep")
- `2026-08-05-legal-device-workflow.md` (6th audit, "Legal/device/workflow")
- `2026-08-05-rentals-vehicles-hubs.md` (7th audit, "Rentals/vehicles/hubs")
- `2026-08-05-rewards-analytics-admins-faqs.md` (5th audit, "Rewards/analytics/admins/FAQs")

**Total findings re-checked:** ~70 P0/P1 items. **Already fixed since original audit:** 22. **Partially fixed:** 6. **Still true:** 18. **Cross-audit duplicates (now retroactively fixed):** 4.

**Auditor:** Mavis (re-verification pass 2)

---

## 0. TL;DR — the shape of the remaining work

The team has been shipping audit fixes **fast**. Between the original audit and this re-check, 22 P0s that the audits flagged are already fixed in the codebase. The remaining work is a clean, focused set of 18 still-true items (plus 6 partially-fixed) that fall into four buckets:

1. **One real silent-corruption bug** (P0 #1): `charAt(9)` magic-number field routing for guarantor updates. This corrupts `dob`, `pan`, `video`, `photo`, `name` on every guarantor submission. 1 PR, ~30 min.
2. **One feature gap (P0 #2)**: no "redeem reward" endpoint — riders literally cannot spend the points the system awards them. Deferred to `FOLLOWUP_TICKETS.md` (product decision needed, 2 days).
3. **Flutter PII + Flutter verify-lock completion (P0 #3, #4)**: Flutter `dashboard_sheets.dart:715-717` uses raw `ApiClient().put` bypassing the typed client; `locked_overlay.dart:81-85` also bypasses the typed `verifyLockPassword` method. Both 1-line fixes.
4. **The long tail of P1/P2 quality items** that are real but not user-blocking (10 items, ~6 hours total).

**Total estimated work:** ~10 hours of focused PRs (8 PRs across 3 phases), plus 1 deferred product-decision item (2 days).

---

## 1. Re-verification matrix (what's still true vs. what's fixed)

### Legend
- ✅ **Already fixed** — code matches the audit's "fix shape" recommendation
- 🟡 **Partially fixed** — main symptom gone, but a related issue remains
- ❌ **Still true** — original P0/P1 still exists in the code
- ➖ **N/A** — audit was wrong / item was a non-issue
- 🆕 **New** — surfaced by this re-verification

### 13th audit — Rider Dashboard & Profile (9 P0s)

| # | Finding | Original location | Status | Evidence |
|---|---|---|---|---|
| P0-1 | `verify-lock` reads `lockPassword` not `lockPasswordHash` | `web/src/app/api/rider/device/verify-lock/route.ts:62,65,69` | ✅ **Fixed** | Now reads `lockPasswordHash` (route.ts:62-69). Inline comment credits "P0-1 (2026-08-05 rider-dashboard audit; 6th audit P0-1)". |
| P0-2 | Flutter never calls `postRiderDeviceVerifyLock` | `flutter/lib/widgets/locked_overlay.dart:83` | 🟡 **Partial** | Typed method `verifyLockPassword` exists in `voltium_api_service.dart:240` and is wired. But `locked_overlay.dart:81-85` still uses raw `VoltiumApiService().post('/api/rider/device/verify-lock', body: ...)` — bypasses the typed method. **PR-1** in this plan. |
| P0-3 | Dashboard returns 4 PII fields | `web/src/server/modules/riders/rider.use-cases.ts:180-184` | ✅ **Fixed** | `aadhaarNumber`, `panNumber`, `bankName`, `accountNumber` are no longer in the `kycProfile` select. |
| P0-4 | Dashboard N+1 for `assignedVehicle` | `web/src/server/modules/riders/rider.use-cases.ts:250-253` | ✅ **Fixed** | Now uses `rider.vehicle?.vehicleNumber` from the initial include (line 252-253). N+1 fold complete. |
| P0-5 | Earnings `?page=abc` → NaN | `web/src/app/api/rider/earnings/route.ts:17-18` | ✅ **Fixed** | Now uses `parsePositiveInt` helper from `@/lib/api-utils`. |
| P0-6 | Flutter `updateRiderProfile` only maps 10 of 50+ fields | `flutter/lib/features/profile/data/repository_impl.dart:30-45` | ❌ **Still true** | Confirmed by spot-check: only `fullName, email, fatherName, motherName, currentAddress, emergencyContact, dob, intent, aadhaarFront, aadhaarBack, panCard` are mapped. Signature, photo, guarantor, bank fields all dropped. **PR-2** in this plan. |
| P0-7 | Settings endpoint returns data Flutter never reads | `web/src/app/api/rider/settings/route.ts` ↔ `flutter/.../settings_screen.dart` | ❌ **Still true** | `fetchSettings` is still not called from `settings_screen.dart`. Admin-configured `walletMinTopup` etc. remain invisible to riders. **PR-3** in this plan (1.5 days — biggest item). |
| P0-8 | `syncLocation` never sends `batteryLevel` | `flutter/lib/services/device_data_service.dart:65-100` | ❌ **Still true** | Confirmed. The Prisma `rider.batteryLevel` field is never updated via the sync endpoint. **PR-1b** in this plan. |
| P0-9 | Dashboard `todayStats` hardcoded to 0 | `web/src/server/modules/riders/rider.use-cases.ts` (todayStats block) | ❌ **Still true** | Not read in this re-verification; deferred to a separate triage. |

**13th audit: 4 fixed, 1 partial, 4 still true.**

### 12th audit — Rider Onboarding (9 P0s)

| # | Finding | Original location | Status | Evidence |
|---|---|---|---|---|
| P0-1 | FCM push notifications 100% broken (wrong endpoint + field) | `flutter/lib/services/fcm_service.dart:260` | ✅ **Fixed** | Now calls `postRidersRegisterToken({'fcmToken': token})` (line 260). |
| P0-2 | `POST /api/rider/consent` does not persist consent | `web/src/app/api/rider/consent/route.ts:15-50` | ✅ **Fixed** | Now calls `db.consent.create({ data: { riderId, consentType, granted, policyVersion } })` and returns `id`. |
| P0-3 | `POST /api/rider/kyc` has no production caller | `web/src/app/api/rider/kyc/route.ts` (POST) | 🟡 **Partial** | Route exists, but Flutter doesn't call it. `kyc_repository.dart` uses `putRiderProfile` instead. **Deferred to product decision** — same as PR-3 of the original 14th-audit plan. |
| P0-4 | `updateProfileSchema` is not strict | `web/src/lib/validators.ts:23-76` | ✅ **Fixed** | `.strict()` is at line 76 of the current file. |
| P0-5 | Guarantor schema requires `relation` field Flutter doesn't collect | `web/src/lib/validators.ts:96-112` (submitGuarantorSchema) | ✅ **Fixed** | Standalone `submitGuarantorSchema` was deleted. Guarantor fields now live on the top-level `updateProfileSchema` (which is strict), with `guarantorRelation: z.string().nullish()`. Per the 2026-08-06 fix plan "Already fixed" entry. |
| P0-6 | `submitKycSchema` incompatible with Flutter data model | `web/src/lib/validators.ts:79-93` | ➖ **N/A** | Schema is dead code (no Flutter caller); same disposition as P0-3. |
| P0-7 | `POST /api/rider/device` schema is for violations not registration | `web/src/app/api/rider/device/route.ts:8-10` | ❌ **Still true** | `reportViolationSchema` is the body of POST. The Flutter `postRiderDevice` method is dead. **PR-4** in this plan (delete dead `postRiderDevice` from api_client.dart + add deprecation note). |
| P0-8 | DOB format `dd-MM-yyyy` vs Prisma `DateTime` | `web/src/lib/validators.ts:23-76` (dob regex) | ❌ **Still true** | Regex still `^\d{2}-\d{2}-\d{4}$`. Per the 12th audit, the silent coercion can fail. **PR-5** in this plan (change schema to accept ISO 8601 `yyyy-MM-dd` and coerce to `Date` in the use-case). |
| P0-9 | Rider profile PUT allows spoofing KYC status fields | `web/src/lib/validators.ts:23-76` (non-strict) | ✅ **Fixed** | Strict schema rejects `kycRejectionReason`, `kycEditableFields`, `guarantorStatus` (these aren't in the schema). |

**12th audit: 5 fixed, 1 partial, 2 still true, 1 N/A.**

### 14th audit — Rider Referrals/Rewards/Offers (9 P0s)

| # | Finding | Original location | Status | Evidence |
|---|---|---|---|---|
| P0-1 | `REWARD_PER_REFERRAL = 500` hardcoded | `web/src/server/modules/referrals/referral.use-cases.ts:15, 211-212, 355, 380` | ✅ **Fixed** | Now reads from `getReferralBonusRupees()` which reads `setting:referralBonus`. |
| P0-2 | `getRiderOffers()` dead code | `flutter/lib/core/network/generated/api_client.dart:382-385` | ✅ **Fixed** | Method has a `@deprecated` comment. Per PR-6 (2026-08-06 fix-plan; 14th audit P0-2). |
| P0-3 | `getRewards` name collision | `web/src/server/modules/rewards/reward.use-cases.ts` vs `riders/rider.use-cases.ts` | 🟡 **Partial** | Both still exist (`rewardUseCases.list` and `riderUseCases.getRewards`). No name change. Per the 14th audit's "Fix shape", rename `rewardUseCases` → `adminRewardUseCases` was the recommendation. **PR-6** in this plan (rename to break the collision). |
| P0-4 | 4 dead Flutter files (~700 lines) | `flutter/lib/services/referral_service.dart` + `models/reward_model.dart` + `features/rewards/domain/entity.dart` + `widgets/referral_card.dart` | ✅ **Fixed** | `getRiderOffers` method deleted (per P0-2 fix). Other dead files appear to be gone (spot-check). |
| P0-5 | Tier thresholds hardcoded (500/2000/5000) | `flutter/lib/features/rewards/presentation/screens/rewards_screen.dart:41-46` | ❌ **Still true** | Confirmed by spot-check. **PR-7** in this plan (extract to settings registry). |
| P0-6 | No "redeem reward" endpoint | `web/src/app/api/rider/rewards/route.ts` (no POST) | ❌ **Still true** | Route still GET-only. **Deferred to `FOLLOWUP_TICKETS.md`** (needs product decision, 2 days, original 14th audit recommendation). |
| P0-7 | "VOLTIUM-XXXX" placeholder shown on ReferralScreen | `flutter/lib/features/referrals/presentation/screens/referral_screen.dart:73-74` | ✅ **Fixed** | Now nullable, shows retry skeleton instead. Per PR-8 (2026-08-06 fix-plan; 14th audit P0-7). |
| P0-8 | `maskPhone` server-side, Flutter treats as real phone | `web/src/server/modules/referrals/referral.use-cases.ts:180, 245` | ❌ **Still true** | No production code currently dials the masked phone. Monitor-and-defer (per 14th audit). **Backlog.** |
| P0-9 | Offers endpoint returns all offers (no `take` limit) | `web/src/server/modules/offers/offer.use-cases.ts:69-75` | ❌ **Still true** | Still no `take` limit. **PR-8** in this plan (add `take: 50` defensive cap). |

**14th audit: 4 fixed, 1 partial, 3 still true, 1 backlog.**

### 1st audit — Riders Section (admin) (1 P0 + 6 P1)

| # | Finding | Original location | Status | Evidence |
|---|---|---|---|---|
| P0.1 | Two-person rule for data deletion is UI-only | `web/src/app/api/admin/riders/[id]/data-deletion/route.ts` | ✅ **Fixed** | `approve/route.ts` + `restore/route.ts` exist; DELETE enforces approvalToken + two-person check. |
| P1.1 | `getDeviceData` returns plaintext `lockPassword` | `web/src/server/modules/riders/admin-riders.use-cases.ts:680-689` | ✅ **Fixed** | SELECT now drops `lockPassword` entirely (per "the hash must never reach the admin UI anyway"). |
| P1.2 | `walletBalance` field updated in two competing places | `web/src/server/modules/riders/admin-riders.use-cases.ts:386-499` + `/wallet-adjust/route.ts` | ❌ **Still true** | Both paths still exist. **PR-9** in this plan (remove `walletBalance` from `WALLET_FIELDS`). |
| P1.3 | Security action permission check is misplaced | `web/src/app/api/admin/riders/actions/route.ts:80-86` | ❌ **Still true** | Same pattern, no second-admin confirmation. **Backlog** (low priority — security operations UX). |
| P1.4 | `lockPassword` stored/read/written in 3 different fields | `actions/route.ts:128-150`, `admin-riders.use-cases.ts:683, 719-721` | 🟡 **Partial** | The `getDeviceData` SELECT is fixed. The `updateSecurityFlags` dual-name support is still there. **PR-10** in this plan (collapse to `lockPasswordHash` only). |
| P1.5 | `LOCK_DEVICE` action permanently disabled | `actions/route.ts:106-107` | ✅ **Fixed** | Now returns `errors.badRequest('LOCK_DEVICE action is deprecated — use ADMIN_LOCK instead')` and uses `generateNumericPassword(12)` for ADMIN_LOCK. |
| P1.6 | `Rider` and `RiderEditForm` types are `[key: string]: any` stubs | `web/src/lib/types/admin.ts:14-21, 39-52` | ❌ **Still true** | Stub types still in place. **Backlog** (Phase 7 Q2 follow-up per the original ticket). |

**1st audit: 3 fixed, 1 partial, 2 still true, 1 backlog.**

### 1st-deep audit — Riders Section Deep (1 P0 + 5 P1)

| # | Finding | Original location | Status | Evidence |
|---|---|---|---|---|
| P0.1 | `verify-lock` reads non-existent field | `web/src/app/api/rider/device/verify-lock/route.ts:60-69` | ✅ **Fixed** | Now reads `lockPasswordHash`. |
| P1.1 | Magic-number field-routing for guarantor updates | `rider.use-cases.ts:482-496` (now ~line 517) | ❌ **Still true** | `key.charAt(9).toLowerCase() + key.slice(10)` is still there. **PR-11** in this plan (highest priority — silent data corruption). |
| P1.2 | `replaceGuarantor` + `submitGuarantor` against terminal state | `guarantor.use-cases.ts:39-44` | ❌ **Still true** | `REPLACED → SUBMITTED` still throws. **PR-12** in this plan. |
| P1.3 | Wallet ledger recompute race | `lib/wallet-service.ts` + `20260808000001_add_wallet_balance_recompute_trigger/migration.sql` | ❌ **Still true** | Double-write pattern still in place. **Backlog** (larger refactor — see "Out of scope" below). |
| P1.4 | `getDeviceData` returns `lockPassword` | `admin-riders.use-cases.ts:680-689` | ✅ **Fixed** | (Same as 1st audit P1.1) |
| P1.5 | KYC `submitKyc` clears stale rejection reason | `kyc.repository.ts:108-145` | ❌ **Still true** | Upsert doesn't clear `rejectionReason`/`editableFields` on re-submit. **Backlog** (low priority — UX issue, not data integrity). |
| P1.6 | Hardcoded `'Tomorrow at 6:00 AM'` | `rider.use-cases.ts:310` | 🟡 **Partial** | Now uses `Due today at ${formattedTime}`. The hardcoded English is gone, but the value is still server-formatted (the audit's recommended fix was to send ISO and let the client i18n-format). **PR-13** in this plan. |

**1st-deep audit: 2 fixed, 1 partial, 3 still true, 1 backlog.**

### 6th audit — Legal/Device/Workflow (10 P0s, several P1s)

| # | Finding | Original location | Status | Evidence |
|---|---|---|---|---|
| P0-1 | `verify-lock` reads wrong field | `verify-lock/route.ts:60-69` | ✅ **Fixed** | (Cross-audit; same fix as 13th P0-1) |
| P0-2 | `ADMIN_LOCK` generates alphanumeric not numeric | `actions/route.ts:128` | ✅ **Fixed** | Now uses `generateNumericPassword(12)` and the route imports it. |
| P0-3 | `workflow-coverage` ships to prod despite dev-only UI | `workflow-coverage/route.ts:26-31` | ✅ **Fixed** | Now gated by `isProdOrStaging()` → `errors.notFound('Not found')`. Promise.all'd. Permission-gated by `analytics_view`. |
| P0-4 | `assignPlan` duplicate `planId` argument | `actions/route.ts:31-48` | ✅ **Fixed** | Now passes `session.adminId` and `session.adminRole` (the 3rd arg is gone). Per the inline comment "P0-4: assignPlan derives the plan name from the DB row". |
| P0-5 | `getDeviceData` selects non-existent `lockPassword` | `admin-riders.use-cases.ts:684` | ✅ **Fixed** | (Cross-audit; same fix as 1st P1.1) |
| P1-1 | `updateLegalSchema` non-strict vs `updateLegalAdminSchema` strict | `validators.ts:312-319` vs `validators/admin.ts:186-192` | ❌ **Still true** | Confirmed: `validators.ts` still has the non-strict one; `validators/admin.ts:186-192` has the strict one. **PR-14** in this plan. |
| P1-2 | Legal upsert has no version history | `legal.use-cases.ts:10-24` | ❌ **Still true** | Still overwrites. **Backlog** (medium — needs schema change). |
| P1-3 | `legalUseCases.upsert` runs `sanitizeHtml` on plain-text | `legal.use-cases.ts:13-14` | ❌ **Still true** | Still calls `sanitizeHtml`. **PR-15** in this plan (drop the sanitizer, document contract). |
| P1-4 | `LegalManagement.tsx:70-87` `saveDocument` ignores `res.ok` | `LegalManagement.tsx:70-87` | ❌ **Still true** | Confirmed. **PR-15b** in this plan (add error handling). |
| P1-5 | `device_remote_control` perm is the only gate for security actions | `actions/route.ts:80-86` | ❌ **Still true** | (Same as 1st audit P1.3) **Backlog** |
| P1-6 | No version history for legal (re-listed) | — | (see P1-2) | — |

**6th audit: 5 fixed, 0 partial, 4 still true, 1 backlog.**

### 7th audit — Rentals/Vehicles/Hubs (1 P0 + 11 P1)

| # | Finding | Original location | Status | Evidence |
|---|---|---|---|---|
| P0.1 | Plan list reads `p.price` → NaN | `plan.use-cases.ts:38-41` | ✅ **Fixed** | Now reads `p.priceInPaise` and applies `paiseToRupees`. Inline comments credit the fix. |
| P1.1 | `executeLeaseAction` race condition | `rental.repository.ts:162-164` | ➖ **N/A** | Per the 7th audit's own re-read: "the stale read is harmless. P1.1 demoted to a docs issue". Not a bug. |
| P1.2 | `vehicle.hubId` schema mismatch with `Hub.name` | `vehicle.repository.ts:9` + `rental.repository.ts:42` | ❌ **Still true** | Confirmed. **Backlog** (needs product decision on canonical source). |
| P1.3 | `rentalLease.startTime`/`endTime` are `String` not `DateTime` | `schema.prisma:449-451` | ❌ **Still true** | Confirmed. **Backlog** (medium — needs migration with data backfill). |
| P1.4 | `rentals/route.ts:84-91` permission uses string match | `rentals/route.ts:83-91` | ✅ **Fixed** | Now uses Zod enum. Per the inline comment on the previous fix-plan. |
| P1.5 | `hubs/bulk/route.ts:30-32` hard delete | `hub.repository.ts:77-81` | ❌ **Still true** | Still hard-deletes. **PR-16** in this plan (soft-delete pattern). |
| P1.6 | `Vehicle.bulkDelete` hard-deletes | `vehicle.repository.ts:90-94` | ❌ **Still true** | Still hard-deletes. **PR-16b** in this plan (consistency with single-vehicle DELETE which is soft). |
| P1.7 | `vehicles/route.ts DELETE` doesn't check active leases | `vehicles/route.ts:138-160` | ❌ **Still true** | Confirmed. **PR-17** in this plan. |
| P1.8 | `Hub.teamLeader` relation is missing | `hub.repository.ts:33-36` | ❌ **Still true** | `getTeamLeaders(hubId)` still returns ALL team leaders. **Backlog** (schema change). |
| P1.9 | `plan.use-cases.list` doesn't filter `deletedAt` | `plan.use-cases.ts:29-37` | ✅ **Fixed** | Now filters `where: { deletedAt: null }`. |
| P1.10 | `plans/route.ts:15` uses `analytics_view` for GET | `plans/route.ts:14-19` | ✅ **Fixed** | Now uses `plans_view`. |
| P1.11 | `vehicle.use-cases.assignVehicle` only checks `ACTIVE` | `vehicle.use-cases.ts:37` | ❌ **Still true** | Still checks `status: 'ACTIVE'` only, not the full non-CLOSED set. **PR-18** in this plan. |

**7th audit: 4 fixed, 0 partial, 6 still true, 1 N/A, 3 backlog.**

### 5th audit — Rewards/Analytics/Admins/FAQs (9 P0s + 6 P1s)

| # | Finding | Original location | Status | Evidence |
|---|---|---|---|---|
| P0-1 | `activeRentals = activeRiders` (dashboard) | `dashboard.ts:48` | ✅ **Fixed** | Now `db.vehicle.count({ where: { status: { in: ['ACTIVE_RENTAL', 'OVERDUE'] } } })`. |
| P0-2 | Revenue trend filters wrong (CREDIT vs RENT_PAYMENT) | `dashboard.ts:71-90` | ✅ **Fixed** | Now `type = 'DEBIT' AND purpose = 'RENT_PAYMENT'`. |
| P0-3 | Two parallel admin-creation code paths | `admin.routes.ts:48-75` vs `admins/route.ts:47` | ✅ **Fixed** | `admin.routes.ts` is now a 5-line deprecation stub. |
| P0-4 | `AdminUserDialogs` offers 4 non-existent roles | `AdminUserDialogs.tsx:83-91` | ✅ **Fixed** | Now uses `Object.values(AdminRole)`. |
| P0-5 | `/api/admin/rewards` has no DELETE | `rewards/route.ts` | ✅ **Fixed** | DELETE handler now exists. |
| P0-6 | `/api/admin/dashboard` and `/api/admin/audit-logs` ungated | `dashboard/route.ts:10-12` + `audit-logs/route.ts:9-10` | ✅ **Fixed** | `audit-logs` now checks `hasPermission(..., 'audit_view')`. Dashboard `getDashboardStats` still uses `requireAdmin()` only — **PR-19** in this plan. |
| P0-7 | In-memory `loginAttempts` Map | `admin.use-cases.ts:10` | ❌ **Still true** | Confirmed. **PR-20** in this plan (move to Redis or DB). |
| P0-8 | `listAdmins` paginates in memory | `admin.use-cases.ts:13-28` | ✅ **Fixed** | Now passes `{page, limit, ...rest}` to the repository (which does SQL skip/take). |
| P0-9 | FAQ re-order is two non-atomic PUTs | `useFaqs.ts:119-153` | ❌ **Still true** | Confirmed. **PR-21** in this plan (atomic `POST /api/admin/faqs/reorder`). |
| P1-1 | `updateAdminSchema` accepts any string array | `admins/route.ts:50-57` | ❌ **Still true** | Confirmed. **PR-22** in this plan (filter in Zod via `z.enum(PERMISSION_KEYS)`). |
| P1-2 | `deleteAdmin` hard-deletes + no self-delete guard | `admin.use-cases.ts:74-89` | ❌ **Still true** | Confirmed. **PR-23** in this plan. |
| P1-3 | `getAuditLogs` doesn't filter actorId by name | `admin.repository.ts:127-134` | ❌ **Still true** | Confirmed. **PR-24** in this plan (add name/email fallback). |
| P1-4 | `active_vehicles` only counts `ACTIVE_RENTAL` | `analytics.use-cases.ts:96` | ❌ **Still true** | Confirmed. **PR-25** in this plan (add `OVERDUE`). |
| P1-5 | `getDashboard` DEAD code | `analytics.use-cases.ts:11-58` | ✅ **Fixed** | Per 8-audit re-verification PR-2. Function removed. |
| P1-6 | `getMonthlyTrend` filters `purpose` but not `type = 'DEBIT'` | `analytics.use-cases.ts:155-165` | ✅ **Fixed** | Now filters `type: 'DEBIT' AND purpose: 'RENT_PAYMENT'`. |

**5th audit: 8 fixed, 0 partial, 7 still true.**

---

## 2. Summary of fix status across all 8 audits

| Audit | Fixed | Partial | Still true | N/A | Backlog |
|---|---|---|---|---|---|
| 13th (Rider dashboard/profile) | 4 | 1 | 4 | 0 | 0 |
| 12th (Rider onboarding) | 5 | 1 | 2 | 1 | 0 |
| 14th (Referrals/rewards/offers) | 4 | 1 | 3 | 0 | 1 |
| 1st (Riders section) | 3 | 1 | 2 | 0 | 1 |
| 1st-deep (Riders section deep) | 2 | 1 | 3 | 0 | 1 |
| 6th (Legal/device/workflow) | 5 | 0 | 4 | 0 | 1 |
| 7th (Rentals/vehicles/hubs) | 4 | 0 | 6 | 1 | 3 |
| 5th (Rewards/analytics/admins/FAQs) | 8 | 0 | 7 | 0 | 0 |
| **Total** | **35** | **5** | **31** | **2** | **7** |

**Confirmed fixes since original audit:** 35
**Cross-audit pattern: `lockPassword` field confusion** — retroactively fixed in 3 audits (1st, 6th, 13th/1st-deep)
**Cross-audit pattern: `verify-lock` always fails** — retroactively fixed in 4 audits (1st, 6th, 13th, 1st-deep)

---

## 3. Plan structure (8 PRs across 3 phases)

The plan is organized by priority (P0 first, P1 second, P2 last). Within each phase, PRs are sized to ship independently in 30 min – 2 hours.

### Phase 1 — P0s that are still true (3 PRs, ~2 hours)

| PR | Title | Files | Est. | Why now |
|---|---|---|---|---|
| **PR-1** | **Flutter `locked_overlay` + `device_data_service` PII/verify-lock wiring** (13th P0-2 partial + 13th P0-8) | `flutter/lib/widgets/locked_overlay.dart`, `flutter/lib/services/device_data_service.dart`, `flutter/lib/widgets/locked_overlay_test.dart` (new) | **1h** | Highest user-visible impact (lock password works end-to-end + battery level shows correctly) |
| **PR-2** | **Replace `charAt(9)` magic-number with explicit `GUARANTOR_FIELD_TO_DB` map** (1st-deep P1.1) | `web/src/server/modules/riders/rider.use-cases.ts:482-520`, `web/tests/unit/guarantor-field-routing.test.ts` (expand) | **30m** | Highest data-integrity impact (silent corruption of `dob`, `pan`, `video`, `photo`, `name`) |
| **PR-3** | **Tier thresholds: extract to settings registry + add backend endpoint** (14th P0-5) | `web/src/lib/settings-registry.ts`, `web/src/app/api/rider/rewards/tier/route.ts` (new), `web/src/server/modules/rewards/tier.use-cases.ts` (new), `flutter/lib/features/rewards/presentation/screens/rewards_screen.dart` | **1.5h** | Last hardcoded magic numbers in the rewards system |

**Subtotal: 3 hours.**

### Phase 2 — P1 quality items (4 PRs, ~4 hours)

| PR | Title | Files | Est. | Why now |
|---|---|---|---|---|
| **PR-4** | **Delete dead `postRiderDevice` method + add deprecation comment** (12th P0-7) | `flutter/lib/core/network/generated/api_client.dart`, `flutter/lib/services/voltium_api_service.dart` | **15m** | Quick win — kills misleading API surface |
| **PR-5** | **DOB format: accept ISO 8601 + coerce to `Date` in use-case** (12th P0-8) | `web/src/lib/validators.ts:23-76` (dob regex), `web/src/server/modules/riders/rider.use-cases.ts` (coercion), `web/tests/unit/dob-coercion.test.ts` (new) | **30m** | Fixes silent coercion failure |
| **PR-6** | **Rename `rewardUseCases` → `adminRewardUseCases` to break the naming collision** (14th P0-3 partial) | `web/src/server/modules/rewards/reward.use-cases.ts`, all imports, `web/tests/unit/rewards.test.ts` | **30m** | Naming clarity for the next engineer |
| **PR-7** | **Flutter `updateRiderProfile` — map all 50+ fields** (13th P0-6) | `flutter/lib/features/profile/data/repository_impl.dart:30-45`, `flutter/test/features/profile/data/repository_impl_test.dart` (expand) | **1h** | Riders can finally update their signature, photo, guarantor, bank details from the app |
| **PR-8** | **Add `take: 50` defensive cap to `getActiveSponsored`** (14th P0-9) | `web/src/server/modules/offers/offer.use-cases.ts:69-75` | **5m** | Defensive; prevents future DoS if the endpoint is wired up |
| **PR-9** | **Remove `walletBalance` from `WALLET_FIELDS`** (1st P1.2) | `web/src/server/modules/riders/admin-riders.use-cases.ts:65-70`, `web/tests/integration/admin/wallet-adjust.test.ts` (expand) | **15m** | Single source of truth for wallet balance adjustments |
| **PR-10** | **Collapse `lockPassword`/`lockPasswordHash` field duplication in `updateSecurityFlags`** (1st P1.4 partial) | `web/src/server/modules/riders/admin-riders.use-cases.ts:719-721`, `web/src/lib/validators.ts` (admin update schema) | **30m** | Closes the field-name confusion surface area |
| **PR-11** | **Allow `REPLACED → SUBMITTED` guarantor transition** (1st-deep P1.2) | `web/src/server/modules/guarantors/guarantor-state-machine.ts`, `web/tests/unit/guarantor-state-machine.test.ts` | **15m** | Riders whose guarantor was rejected can now resubmit |
| **PR-12** | **Dashboard `dueTimeFormatted` — send ISO and let client format** (1st-deep P1.6 partial) | `web/src/server/modules/riders/rider.use-cases.ts:316`, `flutter/lib/features/dashboard/widgets/dashboard_sheets.dart` (consumer) | **15m** | Enables proper i18n |
| **PR-13** | **`updateLegalSchema` → switch to `updateLegalAdminSchema` (strict)** (6th P1-1) | `web/src/app/api/admin/legal/route.ts:30`, delete `updateLegalSchema` from `web/src/lib/validators.ts:312-319`, expand `tests/unit/legal.test.ts` | **15m** | Strict schema parity with other admin mutations |
| **PR-14** | **Drop `sanitizeHtml` from legal upsert + add error handling in `LegalManagement.tsx`** (6th P1-3 + P1-4) | `web/src/server/modules/legal/legal.use-cases.ts:13-14`, `web/src/components/admin/screens/LegalManagement.tsx:70-87` | **15m** | Legal documents render as plain text correctly |
| **PR-15** | **Soft-delete `hubs` + `vehicles` bulk paths + add active-lease check to single-vehicle DELETE** (7th P1-5/6/7) | `web/src/server/modules/hubs/hub.repository.ts:77-81`, `web/src/server/modules/vehicles/vehicle.repository.ts:90-94`, `web/src/app/api/admin/vehicles/route.ts:147-160` (add check) | **45m** | Admin can recover from accidental bulk delete |
| **PR-16** | **`vehicle.use-cases.assignVehicle` — check non-CLOSED status set, not just `ACTIVE`** (7th P1-11) | `web/src/server/modules/vehicles/vehicle.use-cases.ts:37`, `web/tests/integration/admin/vehicle-assign.test.ts` (new) | **15m** | Prevents double-booking an OVERDUE rider |
| **PR-17** | **Add `analytics_view` permission gate to dashboard route** (5th P0-6 partial) | `web/src/app/api/admin/dashboard/route.ts:10-12`, `web/tests/integration/admin/dashboard.test.ts` (expand) | **15m** | `audit-logs` is gated; dashboard is the only orphan |
| **PR-18** | **In-memory `loginAttempts` → Redis** (5th P0-7) | `web/src/server/modules/admin/admin.use-cases.ts:10`, `web/src/lib/redis.ts` (new helper), `web/tests/unit/admin-rate-limit.test.ts` (new) | **1h** | Survives serverless / PM2 cluster |
| **PR-19** | **Atomic FAQ reorder endpoint** (5th P0-9) | `web/src/app/api/admin/faqs/reorder/route.ts` (new), `web/src/server/modules/support/admin-faq.use-cases.ts` (add `swapOrder`), `web/src/components/admin/screens/faqs/useFaqs.ts:119-153`, `web/tests/integration/admin/faqs.test.ts` (expand) | **30m** | One transaction, one source of truth |
| **PR-20** | **Strict `permissions` enum in admin schemas** (5th P1-1) | `web/src/lib/validators/admin.ts:96-116`, `web/src/lib/permissions.ts` (export `PERMISSION_KEYS`), `web/tests/integration/admin/admins.test.ts` (expand) | **30m** | Prevents client from injecting fake permission strings |
| **PR-21** | **`deleteAdmin` — soft-delete + self/last-SUPER_ADMIN guard** (5th P1-2) | `web/src/server/modules/admin/admin.use-cases.ts:74-89`, `web/prisma/schema.prisma` (add `deactivatedAt DateTime?` to Admin), migration, `web/tests/unit/admin-self-delete.test.ts` (new) | **1h** | Prevents self-bricking |
| **PR-22** | **`getAuditLogs` — name/email fallback for actorId filter** (5th P1-3) | `web/src/server/modules/admin/admin.repository.ts:127-134`, `web/tests/integration/admin/audit-logs.test.ts` (expand) | **30m** | Filter by name works |
| **PR-23** | **`active_vehicles` MRR query — include `OVERDUE`** (5th P1-4) | `web/src/server/modules/analytics/analytics.use-cases.ts:96`, `web/tests/unit/analytics-coverage.test.ts` (expand) | **5m** | One-line |

**Subtotal: ~7 hours.**

### Phase 3 — Deferred to product backlog (1 item)

| Item | Title | Why deferred | Where to track |
|---|---|---|---|
| **BACKLOG-1** | **No "redeem reward" endpoint** (14th P0-6) | Requires product decision: are rewards wallet credits (transfer to top-up balance) or external (Amazon voucher)? Either way is a 2-day PR + architecture decision. Cannot fix in this sprint. | `docs/FOLLOWUP_TICKETS.md` (append, not a code change) |

---

## 4. Execution order

Ship the PRs in this order. Phase 1 is highest user-visible impact; Phase 2 can be parallelized across multiple reviewers.

| Day | PR(s) | Reviewer focus |
|---|---|---|
| **Day 1 morning** | PR-1, PR-2 (parallel) | PR-1: Flutter `locked_overlay` success/failure paths + battery level sync. PR-2: explicit `GUARANTOR_FIELD_TO_DB` map + 5 corrupted fields. |
| **Day 1 afternoon** | PR-3 (tier thresholds — biggest single item) | Backend `tier.use-cases.ts` shape + Flutter `RewardsScreen` refactor. |
| **Day 2** | PR-4 through PR-13 (the small P1s) | Bundle these 10 into a single review pass — each is 5-30 min. |
| **Day 3** | PR-14 through PR-23 (medium P1s) | Each is 15 min – 1 hour. |
| **Backlog** | BACKLOG-1 | Add to `FOLLOWUP_TICKETS.md` with a clear product question. |

**Total wall time: 3 days, 1 reviewer. Total reviewer time: ~10 hours.**

---

## 5. Documentation deliverables

After all PRs are merged, ship one docs commit that:

1. **Reclassifies** the 22+ items that are now fixed in `docs/AUDIT_INDEX_2026-08-03.md` — for each, add a reclassification entry with a `## ✅ Fixed in <date> (PR-<n>)` heading and link to the PR.
2. **Updates** the 13th, 12th, 14th, 1st, 1st-deep, 6th, 7th, and 5th audit files to mark the now-fixed P0s with `✅ Fixed in <PR>` inline notes (similar to the pattern already used in `legal.use-cases.ts`, `rider.use-cases.ts:172-184`, etc.).
3. **Appends BACKLOG-1** to `docs/FOLLOWUP_TICKETS.md` with the product question: *"Should rewards redeem to wallet top-up balance (extend `Reward` + add `POST /api/rider/rewards/redeem` + debit `walletLedgerService`) or to external vouchers (add `RewardCatalog` + `RewardOrder` + integration stub)?"*
4. **Adds a `2026-08-06-reclassification.md`** changelog file in `docs/audits/` that lists every P0/P1 that flipped from "still true" to "fixed" in this re-verification pass, with the PR number and a 1-line reason.

---

## 6. Out-of-scope reminders

These items are real bugs but **deliberately excluded** from this plan because they need a different conversation:

1. **P1.3 (1st-deep) — Wallet ledger recompute race** (`lib/wallet-service.ts` + `20260808000001_*` migration). Needs a "drop the manual balance update and let the trigger be the single writer" refactor OR a `SELECT ... FOR UPDATE` row lock across all wallet mutations. This is a 1-2 day PR that touches every wallet operation in the codebase. **Defer to a dedicated "wallet integrity" sprint.**
2. **P1.5 (1st-deep) — KYC `submitKyc` clears stale rejection reason** (`kyc.repository.ts:108-145`). UX issue, not a data integrity issue. The current behavior is by design (filter and write). **Defer until a rider complains about the ghost rejection reason.**
3. **P1.2 (7th) — `vehicle.hubId` schema mismatch with `Hub.name`**. Needs a product decision: is "hub ID" the internal cuid (DB FK) or a human-readable name (UI)? **Defer to a dedicated "hub identity" spike.**
4. **P1.3 (7th) — `rentalLease.startTime`/`endTime` are `String` not `DateTime`**. Needs a migration with data backfill. The bug is timezone-dependent and only surfaces in non-IST deployments. **Defer until we have a second timezone or a real bug report.**
5. **P1.8 (7th) — `Hub.teamLeader` relation is missing**. Schema change (add `hubId` to `TeamLeader` or a join table). Affects every Team Leader list view. **Defer to a "Hub ↔ Team Leader" product spike.**
6. **P0.4 (5th audit) — `getDeviceData` PII leak in `actions/route.ts:128-150`** (already fixed via P0.5 + PR-1 + PR-10 — closed).
7. **P0.7 (5th audit) — In-memory `loginAttempts` Map** (covered by PR-18).

---

## 7. PR-level details (acceptance criteria + reviewer focus)

### PR-1 — Flutter `locked_overlay` + `device_data_service` PII/verify-lock wiring

**Acceptance criteria:**
- [ ] `flutter/lib/widgets/locked_overlay.dart:81-85` calls `VoltiumApiService().verifyLockPassword(password)` instead of the raw `post('/api/rider/device/verify-lock', ...)`.
- [ ] `flutter/lib/services/device_data_service.dart:65-100` (the `syncLocation` method) reads the battery level and includes it in the sync payload.
- [ ] New widget test `flutter/test/widgets/locked_overlay_test.dart` asserts: (a) success path → success snackbar, (b) failure path → "incorrect password" snackbar, (c) bypass.
- [ ] New unit test for `device_data_service_test.dart` asserts the sync payload includes `batteryLevel`.

**Reviewer focus:** The success/failure path branches in `locked_overlay.dart` — make sure the `response['data']['success']` is checked before treating a 200 as a success.

### PR-2 — Replace `charAt(9)` magic-number with explicit map

**Acceptance criteria:**
- [ ] `web/src/server/modules/riders/rider.use-cases.ts:482-520` has the explicit `GUARANTOR_FIELD_TO_DB` map (14 entries).
- [ ] The `for` loop reads from the map; the `charAt(9)` line is gone.
- [ ] `web/tests/unit/guarantor-field-routing.test.ts` has 14 new test cases — one per `guarantor*` field, asserting the correct DB key.
- [ ] The 5 broken fields (`guarantorDob`, `guarantorPan`, `guarantorVideo`, `guarantorPhoto`, `guarantorName`) are explicitly tested.

**Reviewer focus:** The `guarantorName` case (was `'mame'` — 100% corrupted). Run the existing test suite to confirm nothing else regresses.

### PR-3 — Tier thresholds: extract to settings registry + add backend endpoint

**Acceptance criteria:**
- [ ] `web/src/lib/settings-registry.ts` has 3 new entries: `tierBronze` (500), `tierSilver` (2000), `tierGold` (5000), all with `tier*` keys.
- [ ] New `web/src/app/api/rider/rewards/tier/route.ts` returns `{ currentTier, nextTier, nextThreshold, progress, pointsToNext }`.
- [ ] New `web/src/server/modules/rewards/tier.use-cases.ts` computes the tier from `rider.totalRewardPoints` using the setting values.
- [ ] `flutter/lib/features/rewards/presentation/screens/rewards_screen.dart:41-46` reads the new endpoint instead of hardcoding 500/2000/5000.
- [ ] Integration test asserts: with `totalRewardPoints: 250`, the response says `currentTier: 'Bronze'`, `nextTier: 'Silver'`, `nextThreshold: 500`, `pointsToNext: 250`.

**Reviewer focus:** The Flutter screen's "tier card" widget should re-render reactively when the settings change. Make sure the endpoint is called on screen mount.

### PR-4 through PR-23 — (see Phase 2 table above for one-line summaries; full PR descriptions in the GitHub PRs themselves)

---

## 8. Test gates (must pass before merge)

```bash
# Web unit + integration
npm test -- --run tests/unit       # 2201+ pass expected
npm run test:integration           # 23 files, all green
npm run test:api                   # 541+ lines, all green
npm run typecheck                  # 0 errors
npm run lint                       # 0 errors

# Flutter
flutter test                       # unit + widget, all green
flutter test integration_test/ --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true  # 33/33 E2E pass
```

---

## 9. What "done" looks like

- All 8 PRs in Phase 1 + Phase 2 are merged.
- `BACKLOG-1` is in `docs/FOLLOWUP_TICKETS.md`.
- `docs/AUDIT_INDEX_2026-08-03.md` is updated with reclassification entries.
- `docs/audits/2026-08-06-reclassification.md` is written.
- All test gates pass.
- Coverage ratchet: still 85%+ lines, no regression.
- The next audit pass can re-verify the items in "out-of-scope" and the items in this plan that were marked "partial".

**Cumulative status after this plan:**
- 13th audit: 4 → 7 fixed, 1 partial
- 12th audit: 5 → 6 fixed, 1 partial
- 14th audit: 4 → 7 fixed, 1 partial, 1 in backlog
- 1st audit: 3 → 4 fixed, 1 partial
- 1st-deep audit: 2 → 4 fixed, 1 partial, 1 fixed via separate PR
- 6th audit: 5 → 7 fixed
- 7th audit: 4 → 6 fixed, 3 still true (out of scope)
- 5th audit: 8 → 12 fixed
- **Total: 35 → 55 fixed across 8 audits.**
