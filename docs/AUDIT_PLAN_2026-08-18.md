# Voltium Audit Plan — 2026-08-18

**Author:** Mavis (Voltium Mavis)
**Status:** Working plan. Ship the 2 P0 PRs this week; the rest in priority order.
**Source audits:** Flutter audit + Web admin audit + Security & cross-cutting audit (3 parallel agents, all read-only, 2026-08-18).

---

## 1. Executive summary

3 parallel audits of the Voltium rider app + admin web + backend API. The codebase is in good shape overall — dark mode, theme tokens, i18n scaffolding, Riverpod v3, design-system primitives are all in place. The remaining work is **3 P0 ship-blockers + 12 P1 review-ready PRs + 24 P2/P3 polish**.

| Dimension | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|
| Security & cross-cutting | **2** | 7 | 12 | 5 | 26 |
| Flutter (rider app) | **1** | 3 | 12 | 4 | 20 |
| Web admin | 0 | 4 | 6 | 1 | 11 |
| **Total** | **3** | **14** | **30** | **10** | **57** |

**3 PRs are ship-blockers and should land this week:** PR-SEC-1 (security P0s), PR-FLUTTER-1 (Toast bypass P0). The remaining 12 PRs can land over the next 2-3 weeks in the priority order below.

---

## 2. The 3 P0s — ship this week

### 🔴 P0-S1: `GET /api/rider/profile` leaks `lockPasswordHash` + `fcmToken`

**File:** `web/src/lib/flatten-rider.ts:47,82-83` (the spread), `web/src/server/modules/riders/rider.use-cases.ts:176-218` (the call site)

**Vulnerability.** `flattenRider` does:
```ts
const { kycProfile, wallet, guarantor, ...rest } = r;
return { ...rest, ... };
```
The `...rest` spread is unrestricted — it includes every other Rider column, including `lockPasswordHash`, `fcmToken`, `tokenVersion`, `currentAddress`, `fatherName`, `motherName`, `emergencyContact`, pickup photo URL keys, etc. The `getProfile` use case calls `db.rider.findUnique({ include: { kycProfile, wallet, guarantor, vehicleReturns, vehicle } })` — the full row, then hands it to `flattenRider`.

**Attack scenario.** A logged-in rider hits `GET /api/rider/profile` and gets `lockPasswordHash` back in plaintext. The Flutter `verify-lock` flow takes a **4-digit** lock PIN (see `flutter/lib/l10n/app_en.arb:849`). An offline attacker brute-forces 10,000 candidates in seconds, recovers the PIN, and uses it to unlock a device that an admin has `isAdminLocked`. The same spread also leaks `fcmToken` (long-lived push-channel secret) and any future sensitive column will be leaked automatically because the spread is unrestricted.

**Fix.** Replace the `db.rider.findUnique({ include: ... })` with an explicit `select` mirroring the `SAFE_PROFILE_FIELDS` allowlist. Drop `lockPasswordHash`, `fcmToken`, `tokenVersion` from the select. Optional: add a guard `Object.keys(rest).forEach(k => { if (k in FORBIDDEN_PROFILE_FIELDS) delete rest[k]; })` in `flattenRider` for defense in depth.

**Acceptance.**
- `GET /api/rider/profile` response contains **none** of: `lockPasswordHash`, `fcmToken`, `tokenVersion`, `password`.
- Unit test asserts `flattenRider` does not include these keys.
- One-shot grep audit of the Rider model documents the at-rest exposure status of every column.

---

### 🔴 P0-S2: `POST /api/files/confirm-upload` is an unauthenticated-IDOR

**File:** `web/src/app/api/files/confirm-upload/route.ts:9-32`, `web/src/server/modules/files/files.use-cases.ts:109-130`

**Vulnerability.** The route only checks "you are logged in as a rider OR admin" — it never checks the `fileRecordId` belongs to the caller. The use case `confirmUpload` does `getFileRecordById(fileRecordId)`, checks the file is on disk, and marks it as `UPLOADED`. No ownership check anywhere.

**Attack scenario.** Rider A is on the KYC step; their `aadhaarFront` upload is in flight (`status: PENDING_UPLOAD`, file on disk). Rider B — a different rider, or an attacker account — calls `/api/files/confirm-upload` with Rider A's `fileRecordId`. The server marks the record as uploaded. When Rider A's actual upload arrives (or doesn't), the state is already wrong. Rider A's KYC review may show a "wrong photo" (the file the attacker confirmed but didn't actually upload), or block Rider A's KYC submission entirely. Repeatable across KYC, profile photo, signature, vehicle return photos, security deposit.

**Fix.** In `fileUseCases.confirmUpload`:
```ts
const record = await getFileRecordById(fileRecordId);
if (!record) throw new NotFoundError();
if (actor.role === 'rider' && record.ownerId !== actor.riderDbId) {
  throw new ForbiddenError('Cannot confirm another rider\'s upload');
}
if (actor.role === 'admin' && !hasPermission(actor, 'files_admin')) {
  throw new ForbiddenError('Missing files_admin permission');
}
```
Mirror the check in the use case, not just the route, so direct use-case callers can't bypass. Also mirror the check on `requestReadUrl` if it isn't already enforced.

**Acceptance.**
- Rider A cannot confirm Rider B's pending fileRecord (403, not 404).
- Admin with `files_admin` permission can confirm any.
- Admin without `files_admin` gets 403.
- Integration test: `riderA.confirmUpload(riderB.fileRecordId)` returns 403.

---

### 🔴 P0-F1: `Toast` helper bypassed by 87% of SnackBar call sites

**Files:** 29 files call `ScaffoldMessenger.of(context).showSnackBar(SnackBar(...))` directly — **148 raw `SnackBar(...)` occurrences**. Canonical `lib/utils/toast.dart:25-91` ships `Toast.success / .error / .info / .warning` with icon + brand color + padding + radius + floating behaviour. Only 4 files use it.

**What the user sees.** Success toasts on `login_screen.dart:99-103` and `otp_verification_screen.dart:290-295` are grey-default — no check icon, no green background. On `rewards_screen.dart` and others the success SnackBar has a green background but no check icon. Error SnackBars in `login_screen.dart` are red without an `error_outline` icon; error SnackBars in `dashboard_sheets.dart` are the same. Duration drift: every raw SnackBar has the Material default 4s; `Toast.error` is 4s; `Toast.success` is 3s. Inconsistent.

**Fix.** Replace all 148 raw `ScaffoldMessenger.of(context).showSnackBar(SnackBar(...))` calls with `Toast.success / .error / .info / .warning` per the existing `utils/toast.dart` API. Where a screen has a one-off need, the call already matches `Toast.success`'s output — delete the custom code and use `Toast.success(context, '<msg>')`.

**Ratchet.** Add `tool/lint_raw_toast_calls.dart` mirroring the existing `tool/lint_raw_colors.dart` pattern: scan for `showSnackBar(` outside `lib/utils/toast.dart`. Allow a `// toast-allow: <reason>` comment for intentional exceptions.

**Acceptance.**
- `grep -rn "showSnackBar" lib/` returns 0 hits outside `lib/utils/toast.dart` (or only intentional `// toast-allow:` exceptions).
- New `toast_visual_consistency_test.dart` golden snapshots `Toast.success / .error / .info / .warning` in both light and dark mode.
- CI runs the new linter in the existing `flutter-ci-cd.yml` job.

---

## 3. The combined ship plan (5 high-priority PRs + 5 follow-up PRs)

### PR ordering rationale

1. **P0 first** — security then UX consistency.
2. **Test foundation** — once `@testing-library/react` and the new Flutter test files exist, every future PR is verifiable without a dev server.
3. **Hygiene** — small, mechanical, ship-it PRs that close the rest of the audit.
4. **Defer non-blocking** — P2s that are bigger lifts or product decisions.

---

### 🚨 PR-SEC-1 — Profile data leak + file confirm-upload IDOR (P0-S1, P0-S2)

**Scope.** 2 P0s, both backend. ~120 LOC, 1 integration test per finding. **Ship this week.**

**Files.**
- `web/src/server/modules/riders/rider.use-cases.ts` — replace `db.rider.findUnique({ include: ... })` with explicit `select` in `getProfile`.
- `web/src/server/modules/files/files.use-cases.ts` — add ownership check in `confirmUpload`.
- `web/tests/security/admin-pii.test.ts` (new) — assert `/api/rider/profile` does not return `lockPasswordHash` or `fcmToken`.
- `web/tests/security/admin-pii.test.ts` (new, same file) — assert rider A cannot confirm rider B's pending fileRecord.

**Reviewer focus.**
- Does the new `select` in `getProfile` cover everything the rider app actually needs? (Cross-check against `RiderModel` and `flattenRider`.)
- Does the ownership check in `confirmUpload` cover the admin path (with `files_admin` permission) and the rider path?

**Acceptance.**
- `GET /api/rider/profile` response shape: no `lockPasswordHash`, no `fcmToken`, no `tokenVersion`.
- `riderA.confirmUpload(riderB.fileRecordId)` returns 403.
- Admin with `files_admin` permission can confirm any fileRecord.
- All existing `tests/security/` and `tests/integration/` still pass.
- `npm run typecheck` + `npm run lint` + `npm run test:integration` all pass.

**Estimated time.** 1 day (1 backend engineer).

---

### 🚨 PR-FLUTTER-1 — Toast bypass cleanup + new ratchet (P0-F1)

**Scope.** Replace 148 raw `SnackBar(...)` with `Toast.*` across 29 files. Add a new linter to keep the bypass from coming back. **Ship this week.**

**Files.**
- 29 Flutter files (the 148 raw SnackBar sites) — mechanical `showSnackBar(SnackBar(...))` → `Toast.X(context, msg)`.
- `tool/lint_raw_toast_calls.dart` (new) — mirrors `tool/lint_raw_colors.dart`, fails the build on any `showSnackBar(` outside `lib/utils/toast.dart`.
- `.github/workflows/flutter-ci-cd.yml` — add the new linter to the CI job.
- `test/utils/toast_visual_consistency_test.dart` (new) — golden snapshots in light + dark mode.

**Reviewer focus.**
- Is every replaced site semantically equivalent? (`SnackBar(backgroundColor: AppColors.error, content: Text('X'))` → `Toast.error(context, 'X')`.)
- Are the intentional exceptions (e.g. SnackBars in system dialogs that can't use `Toast` because the context is wrong) marked with `// toast-allow: <reason>`?
- Does the linter pattern correctly skip comment lines and string literals (avoid false positives)?

**Acceptance.**
- `grep -rn "showSnackBar" lib/` returns 0 hits outside `lib/utils/toast.dart` (or only intentional `// toast-allow:` exceptions).
- `dart run tool/lint_raw_toast_calls.dart` exits 0.
- CI runs the linter in `flutter-ci-cd.yml`.
- `flutter test` and `flutter test:coverage` both pass with no coverage drop.

**Estimated time.** 1 day (1 mobile engineer).

---

### PR-FLUTTER-2 — UX consistency cleanup (F1, F2, F4, F8)

**Scope.** Hand-rolled back buttons → `IconButton`; 118 hand-rolled card chromes → new `AppCard` widget; 5 hand-rolled empty states → `IllustratedEmptyState`; 27 `EdgeInsets.only(left/right)` → `EdgeInsetsDirectional`. **Net –300 LOC across ~80 files.**

**Files.**
- 7 back-button sites — `rental_details_screen.dart:75-107`, `referral_screen.dart:133-160`, `rewards_screen.dart:61-89`, `kyc/documents_screen.dart:228-249`, `onboarding/legal_page_screen.dart:641-665`, `profile/profile_detail_screen.dart:102-125`, `device_compliance/emergency_sos_screen.dart:169-195`.
- 38 card-chrome sites — sed-style replacement to `AppCard` (new in `lib/widgets/cards/cards.dart`).
- 4 hand-rolled empty states — `wallet_widgets.dart:832-847`, `rewards_screen.dart:268-329`, `earnings_screen.dart:460-490`, `active_dashboard_screen.dart:126`.
- 27 RTL anti-patterns — `EdgeInsets.only(left:` → `EdgeInsetsDirectional.only(start:`, `EdgeInsets.only(right:` → `EdgeInsetsDirectional.only(end:`.
- `lib/widgets/cards/cards.dart` (add `AppCard`).
- `lib/widgets/cards_consolidation_test.dart` (new) — golden tests for `AppCard` in 3 states.

**Reviewer focus.**
- Does the new `AppCard` render identically to the 118 hand-rolled cards in light + dark mode? (Compare goldens.)
- Do the 7 IconButton back buttons match the existing back button in `edit_profile_screen.dart` and `settings_screen.dart` (which already use IconButton)? (Visual diff.)
- Does the Hindi-locale back button sit at the leading edge of the AppBar (no extra 20dp left padding)?

**Acceptance.**
- 0 hand-rolled "outlined card with subtle shadow" outside `lib/widgets/cards/cards.dart`.
- 0 `EdgeInsets.only(left:` or `EdgeInsets.only(right:` outside `lib/features/dashboard/presentation/{widgets,screens}/legacy/`.
- 7 back-button files use `IconButton`, not `Container`.
- `flutter test` and golden tests pass in both light and dark mode.
- New integration test `50_rtl_back_button_test.dart` confirms the back button in Hindi locale is at the leading edge of the AppBar.

**Estimated time.** 2 days (1 mobile engineer).

---

### PR-WEB-1 — UX hygiene (W1, W2, W4, W5)

**Scope.** Raw `confirm()` → `AlertDialog`; rename 4 `*Sheet` files to `*Dialog`; clean up 17 dead one-shot scripts; new `EmptyState` primitive. **~30 web files, ~600 LOC, 1 day.**

**Files.**
- `web/src/components/admin/screens/PlanManagement.tsx:69` — new `PlanDeleteDialog` `AlertDialog` (mirror `DeleteShiftDialog` pattern).
- `web/src/components/admin/screens/bulk-messaging/useBulkMessaging.ts:114` — extend `CreateAnnouncementDialog` with `ConfirmImmediateAllDialog`.
- 4 `*Sheet` → `*Dialog` renames: `KycDetailSheet` → `KycDetailDialog`, `IncidentDetailSheet` → `IncidentDetailDialog`, `TransactionDetailSheet` → `TransactionDetailDialog`, `TicketDetailSheet` → `TicketDetailDialog`. Plus 6 import sites + 2 `index.ts` re-exports.
- `web/scripts/` cleanup — 9 debug files deleted, 8 one-shots moved to `prisma/migrations/_archive/` or `docs/runbooks/`.
- `web/src/components/ui/empty-state.tsx` (new) — replace 5 inline "No data" treatments.

**Reviewer focus.**
- Does the new `PlanDeleteDialog` reuse the same `AlertDialog` shell as the existing `DeleteShiftDialog` and `KycDialogs`? (Consistency check.)
- After the rename, does `grep -rE "DetailSheet['\"]" web/src` return 0 admin-internal matches?
- Are the moved one-shot scripts in `prisma/migrations/_archive/` clearly marked as "DO NOT RE-RUN"?

**Acceptance.**
- `grep -rE "window.confirm|confirm\(" web/src/components/admin` returns 0.
- `grep -rE "DetailSheet['\"]" web/src` returns 0 admin-internal matches.
- `ls web/scripts/` returns ≤ 7 files, every one wired into `package.json`.
- `grep -rE "No data available" web/src/components/admin` returns 0.
- `npm run test:unit` + `npm run lint` + `npm run typecheck` all pass.

**Estimated time.** 1 day (1 web engineer).

---

### PR-FLUTTER-3 — Test gap closure + dead-code cleanup (F3, F4, F6, F7)

**Scope.** Add unit tests for 4 missing screens, delete 8 thin duplicate test files, expand 5 thin tests, delete 10+ dead public widgets (~1,800 LOC dead code), fix 3 deprecated `dialogs.dart` helpers. **1.5 days.**

**Files (test additions).**
- 4 new unit tests: `test/features/pickup/presentation/screens/pickup_verification_screen_test.dart`, `test/features/pickup/presentation/screens/pickup_hub_screen_test.dart`, `test/features/wallet/presentation/screens/plan_success_screen_test.dart`, `test/features/wallet/presentation/screens/top_up_amount_screen_test.dart`. Each 80+ lines with happy + error path.
- 2 new unit tests for post-onboarding screens: `test/features/profile/presentation/screens/profile_detail_screen_test.dart`, `test/features/wallet/presentation/screens/history_screen_test.dart`.

**Files (test deletions — 8 thin duplicates).**
- `test/features/onboarding/kyc_preflight_test.dart` + `test/features/onboarding/kyc_preflight_screen_test.dart` — keep `test/screens/kyc_preflight_screen_test.dart`.
- `test/features/kyc/presentation/screens/signature_pad_screen_test.dart` (thin) — keep `test/kyc/signature_pad_screen_test.dart`.
- `test/features/notifications/presentation/screens/notifications_screen_test.dart` (golden only) — keep the other 2.
- `test/features/rewards/presentation/screens/rewards_screen_test.dart` (golden only) — keep `test/rewards/rewards_screen_test.dart` and expand.
- `test/features/support/presentation/screens/support_center_screen_test.dart` (golden only) — keep `test/support/support_center_enhanced_test.dart`.
- `test/features/support/presentation/screens/troubleshooter_screen_test.dart` (golden only) — keep the other.
- `test/features/rentals/presentation/screens/rental_details_screen_test.dart` — expand with a real flow test instead of deleting.

**Files (thin expansions — 5 files).**
- `test/rewards/rewards_screen_test.dart` — add tier calculation, tap-to-share, copy-code.
- `test/features/rentals/presentation/screens/rental_details_screen_test.dart` — add status pill color, rent prompt card visibility.
- `test/features/notifications/presentation/screens/notification_preferences_screen_test.dart` — add toggle state changes.
- `test/features/support/presentation/screens/troubleshooter_screen_test.dart` — add category tap → question list → result flow.
- `test/wallet/top_up_proof_screen_test.dart` — add the **active-path onSubmit no-op regression** test (PR-ONBOARDING-AUDIT 2026-08-14 P0-1 is currently untested).

**Files (dead widget deletions — 13 files + 4 widgets).**
- `lib/widgets/back_button_handler.dart` (whole file) — `BackButtonHandler` + `WillPopScopeWidget` are 0-callers.
- `lib/widgets/gesture_widgets.dart` — `PinchZoom`, `DoubleTapDetector`, `LongPressDraggableWidget`, `DragTargetWidget` (whole file).
- `lib/widgets/micro_interactions.dart` — `BounceButton`, `RippleEffectButton`, `CardFlip`, `ShakeWidget` (whole file).
- `lib/widgets/micro_animations.dart` — `TapScale`, `BounceWidget`, `SuccessAnimation` (whole file).
- `lib/widgets/tilt_card.dart`, `lib/widgets/swipeable_card.dart`, `lib/widgets/empty_state.dart`, `lib/widgets/empty_state_illustrations.dart` (whole files).
- `lib/widgets/navigation_widgets.dart` — `CustomDrawer`, `ExpandableDrawerItem`.
- `lib/widgets/progress_indicators.dart` — `CircularProgressIndicator2`, `KYCProgressIndicator`, `StepProgressIndicator`, `AnimatedProgressBar`.
- `lib/widgets/form_widgets.dart` — `LinearProgressBar`, `AnimatedLinearProgressBar`.
- `lib/widgets/dialogs.dart:69-89` — delete the 3 `*SnackBar` helpers that throw `UnimplementedError`.
- Plus ~7 `test/widgets/*_golden_test.dart` files for the deleted widgets.
- Plus 4 integration test files for the missing flows (`RewardPageObject`, `EndRentalPageObject`, `TroubleshooterPageObject`, `TicketDetailPageObject`).

**Reviewer focus.**
- Does each new unit test cover ≥ 1 happy path + 1 error path? (Not just "renders".)
- Does the dead-widget deletion break any production import? (Run `flutter analyze` after each batch.)
- Does `riverpod_providers.dart` still compile after the `*Ref` alias cleanup? (If we do that in this PR.)

**Acceptance.**
- Unit-test count goes from ~800 to ~820; integration-test count goes from 49 to 53.
- Duplicate test files: 0.
- Thin tests: 0.
- Grep for each deleted class name returns 0 hits.
- `flutter test` + `flutter test:coverage` still pass; coverage holds or improves.

**Estimated time.** 1.5 days (1 mobile engineer).

---

### The 5 follow-up PRs (P1/P2 — land in order, can parallelize)

#### PR-SEC-2 — PII unmasking + CORS tightening + file Content-Disposition + virus-scan stub
- **Scope:** S3, S4, S5. ~200 LOC, 2 days.
- **Files:** `web/src/app/api/rider/kyc/route.ts:40-56` (mask aadhaar/pan/account); `web/src/middleware.ts:184-200` (remove `!isProd` CORS branch); `web/src/app/api/files/[...path]/route.ts:140-155` (add `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`); new `web/src/lib/virus-scanner.ts` stub wired into `files.use-cases.confirmUpload`.
- **Acceptance:** PII in KYC self-service response is masked; dev CORS no longer allows arbitrary origins; all file GETs are `attachment; filename="..."`; virus-scan stub is invoked.

#### PR-WEB-2 — React Testing Library foundation + density-test purge
- **Scope:** W3, W6. ~10 new test files, 1 deletion. 2 days.
- **Files:** add `@testing-library/react` + `@testing-library/jest-dom` to devDeps; new `vitest.config.ts`; 3 new component tests (`AdminLayout.test.tsx`, `KycDialogs.test.tsx`, `PlanManagement.test.tsx`); delete ~800 lines of density-filler tests in `api-routes.test.ts:540-606`.
- **Acceptance:** `npm run test:unit` runs the new component tests and they pass; `api-routes.test.ts` is ≤ 300 lines; the deliberate `confirm()` regression in PlanManagement causes a failing test.

#### PR-SEC-3 — Refresh token jti + category gating + KYC field allowlist + address-encryption decision
- **Scope:** S6, S7, S8, S9. ~250 LOC, 3 days.
- **Files:** `web/src/server/modules/files/files.use-cases.ts` (category gating); `web/src/app/api/auth/logout/route.ts` (add `refreshTokenJti`); `web/src/lib/verify-receipt.ts` (tokenVersion binding); `web/src/server/modules/kyc/kyc.use-cases.ts:21-52` (explicit allowlist in `mapKycFieldsToPrisma`); `prisma/schema.prisma` (decide + document address encryption).
- **Acceptance:** Pre-KYC rider cannot request `kyc_document` upload URL; logout invalidates outstanding receipts within 100ms; `mapKycFieldsToPrisma` rejects unknown keys.

#### PR-FLUTTER-4 — Form fields, dialog shape, body padding tokens, RTL integration test
- **Scope:** F5, F6, F7, F8. ~40 file touches, 1.5 days.
- **Files:** new `AppTextField` in `lib/widgets/form_widgets.dart`; migrate 6 most-visible text fields; standardise 19 `showDialog` callers on `AlertDialog` with `shape: RoundedRectangleBorder(borderRadius: AppRadius.lg)`; 30 `EdgeInsets.all(16)` → `Spacing.paddingMd` migrations; new `tool/lint_rtl_directional_padding.dart` ratchet; new integration test `50_rtl_back_button_test.dart`.
- **Acceptance:** 0 raw text fields outside `AppTextField` wrapper (or intentional `// form-allow:` exceptions); 0 dialog chrome drift; 0 `EdgeInsets.only(left/right:` outside legacy/.

#### PR-WEB-3 — PlanManagement rewrite + api-handler consolidation
- **Scope:** W6 (fold-in), tech debt 3.2 + 3.3. ~15 files, 1 day.
- **Files:** new `useRentalPlans()` hook + `PlanDeleteDialog`; rewrite `PlanManagement.tsx`; delete `web/src/lib/api-handler.ts` (fold `withApiHandler` into `api-middleware.ts`); move `web/src/lib/posthog-rate-limiter.test.ts` to `tests/unit/`.
- **Acceptance:** PlanManagement uses canonical design-system primitives; `api-handler.ts` deleted; `npm run typecheck` + `npm run lint` + `npm run test:unit` all pass.

---

## 4. The 30 P2s (in priority order, ship in remaining time)

These are smaller, mechanical. Group into follow-up PRs or land alongside the PRs above.

| # | Source | Title | File area |
|---|---|---|---|
| 1 | F | Delete 2 `AppConfig` files, merge into `lib/core/constants/app_constants.dart` | `lib/utils/app_config.dart` + `lib/config/app_config.dart` |
| 2 | F | Touch target ratchet ceiling: 15 → 0; migrate 4 specific 40px containers to 44px | `lib/widgets/*` |
| 3 | F | Standardise loading spinners (3 competing idioms → `AppSpinner`) | `lib/widgets/form_widgets.dart` |
| 4 | F | 4 new integration tests for missing flows (reward tier, end rental, troubleshooter, ticket detail) | `flutter/integration_test/e2e_individual/` |
| 5 | F | Move `_archived_tmp_l10n*.txt` into `flutter/.tmp/` or delete | `flutter/_archived_tmp_l10n*.txt` |
| 6 | F | Delete `*Ref` aliases from `riverpod_providers.dart` | `lib/core/state/riverpod_providers.dart` |
| 7 | S | `EncryptCacheService` should use same `FlutterSecureStorage` options as primary | `flutter/lib/services/secure_storage_service.dart:170-180` |
| 8 | S | `decryptPii` legacy-fallback should emit a security event, not `console.warn` | `web/src/lib/pii-crypto.ts:135-152` |
| 9 | S | Two different PII-masking rules (`logger.ts` vs `pii-redact.ts`) — consolidate | `web/src/lib/logger.ts:42-48` |
| 10 | S | `verifyOtp` returns full rider data — drop the rider data, rely on follow-up `getProfile` | `web/src/server/modules/auth/auth.use-cases.ts:96-234` |
| 11 | S | `FILE_UPLOAD_SECRET` / `JWT_SECRET` / `VERIFY_RECEIPT_SECRET` collision not detected at boot | `web/src/lib/env.ts:260-265` |
| 12 | S | PostHog user-id is `riderId.hashCode.toString()` (32-bit collidable) — use salted hash | `flutter/lib/services/analytics_service.dart:82-95` |
| 13 | S | `documents_screen.dart` opens PDFs in `LaunchMode.externalApplication` — switch to in-app | `flutter/lib/features/kyc/presentation/screens/documents_screen.dart:103-205` |
| 14 | S | `requireRiderSession` impersonation path brittle gate — require both `APP_ENV=development` AND flag | `web/src/lib/rider-auth.ts:22-23` |
| 15 | S | `device/verify-lock` doesn't record device fingerprint | `web/src/app/api/rider/device/verify-lock/route.ts:19-21` |
| 16 | S | Per-rider upload count cap (currently unbounded) | `web/src/server/modules/files/files.use-cases.ts:62-107` |
| 17 | S | MIME validation: reject `text/html`, `image/svg+xml` at the catch-all PUT | `web/src/app/api/files/[...path]/route.ts:21-70` |
| 18 | S | `encryptKycData('')` returns `''` (unencrypted) — fix to treat empty as null | `web/src/server/modules/kyc/kyc.repository.ts:16-24` |
| 19 | S | Audit log captures full phone + lat/lng for SOS events (90-day retention) | `web/src/app/api/emergency/sos/route.ts:84-98` |
| 20 | S | `/api/files/local-upload/[id]` PUT only requires HMAC upload token, no rider session | `web/src/app/api/files/[...path]/route.ts:162-269` |
| 21 | S | Receipt TTL not bound to `tokenVersion` | `web/src/lib/verify-receipt.ts:43-49` |
| 22 | S | `/api/auth/send-otp` and `/api/auth/verify-phone` need a daily-IP cap on the union | `web/src/app/api/auth/verify-phone/route.ts:17-52` |
| 23 | W | 279 `ml/mr/pl/pr` instances (RTL risk) — defer to 2027 unless product asks | `web/src/components/admin/**` |
| 24 | W | `Sheet` and `Drawer` are design-system dead weight (1 and 0 use sites) | `web/src/components/ui/{sheet,drawer}.tsx` |
| 25 | W | 3 competing loading idioms (`Skeleton`, `Loader2`, raw `shimmer`) | `web/src/components/admin/AdminLayout.tsx:29-36`, `admin-map.tsx:114`, `AdminUserTable.tsx:127` |
| 26 | W | `aria-label` sparse on icon-only buttons (10-20 buttons across the admin) | `web/src/components/admin/**` |
| 27 | W | Button size drift: 4 `className="h-9 px-4 text-sm"` overrides → `size="sm"`; add `size="xs"` to `Button` cva | `web/src/components/admin/**`, `web/src/components/ui/button.tsx` |
| 28 | W | `RolePermissionManagement` is the only admin file using raw `<input>` | `web/src/components/admin/screens/RolePermissionManagement.tsx` |
| 29 | W | No `pii-leak` or `privilege-escalation` coverage for admin endpoints (8 tests needed) | `web/tests/security/admin-pii.test.ts` + `admin-escalation.test.ts` |
| 30 | W | `api-routes.test.ts` "density" tests are no-ops (assert any plausible status) | `web/tests/api-routes.test.ts:540-606` |

---

## 5. The 10 P3s (defer; not blocking)

(Full list in each source audit. Most are observations, lint tweaks, or single-line refactors. Land in cleanup PRs alongside P2s.)

---

## 6. What was already covered (do not re-audit)

- Dark mode contrast, brightness-aware tokens, theme palette migration (DARK-MODE-AUDIT 2026-08-14, 3 PRs shipped on `fix/onboarding-audit-2026-08-14`).
- Language / i18n (Hindi ARB pre-staging — LANGUAGE-AUDIT 2026-08-16, shipped). The app is en+hi only; do not propose 3rd languages.
- The EditProfile form (full audit done 2026-08-17, all P0/P1 items shipped).
- Static-color ratchet at `flutter/tool/lint_static_palette_tokens.dart`.
- Dead canonical role/KYC color maps in `web/src/lib/admin-ui.ts` and `web/src/lib/role-config.ts` (already addressed; they now exist as the post-audit canonical versions per their own file headers).
- PII leak test at `web/tests/security/pii_leak.test.ts` (covers dashboard PII; per P1-S3 we'll extend to `/api/rider/kyc`).

---

## 7. How to use this plan

1. **Ship PR-SEC-1 + PR-FLUTTER-1 this week** (the 2 P0s). Both are review-ready diffs, both are high-leverage.
2. **Land PR-FLUTTER-2 + PR-WEB-1 + PR-FLUTTER-3 next week** (UX hygiene + test gap closure). These are mechanical, ship-it diffs.
3. **Run the 5 follow-up PRs in order over the next 2 weeks.** The order is by impact × risk: SEC hardening → web test foundation → SEC secret rotation → Flutter polish → web cleanup.
4. **P2s in any order.** They're small enough to land alongside the PRs above.
5. **P3s whenever.** They're observations.

Each PR should ship as its own branch + MR with the acceptance criteria in this doc as the review checklist. The reviewer focus notes are the things the reviewer should pay extra attention to.

---

## 8. Success criteria for the full plan

- **All 3 P0s fixed and merged** by 2026-08-25.
- **All 12 P1s fixed and merged** by 2026-09-15.
- **No new "thin" test files added** (every new test is ≥ 80 lines, covers ≥ 1 happy + 1 error path).
- **Coverage holds or improves** (Flutter 85% gate, web 85% gate per AGENTS.md).
- **No new dead public widgets** (lint catches at write time).
- **No new raw `showSnackBar` outside `utils/toast.dart`** (lint catches at write time).
- **No new `EdgeInsets.only(left/right:` outside `legacy/`** (lint catches at write time).
- **No new raw `confirm()` in the admin** (lint catches at write time).
- **No new `*Sheet` files in the admin** (renamed convention enforced).
- **No regression in any prior audit** (dark mode, i18n, theme, EditProfile).

---

## 9. Source audits

- **Flutter audit** (2026-08-18) — 20 findings, 1 P0, 3 P1.
- **Web admin audit** (2026-08-18) — 11 findings, 0 P0, 4 P1.
- **Security & cross-cutting audit** (2026-08-18) — 26 findings, 2 P0, 7 P1.
- (Prior) Dark mode audit, language audit, EditProfile form audit — all shipped on `fix/onboarding-audit-2026-08-14` (PR1/PR2/PR3 + the consolidated-audit-2026-08-16 commit `09ce5893`).
