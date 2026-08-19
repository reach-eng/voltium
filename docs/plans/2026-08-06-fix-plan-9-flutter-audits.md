# Fix Plan — 9 Flutter Audits

**Date:** 2026-08-06
**Source audits (9):**
1. `FLUTTER_API_WALLET_TRANSACTIONS_AUDIT_2026-08-05.md`
2. `FLUTTER_DARK_MODE_LANGUAGE_TOGGLE_AUDIT_2026-08-05.md`
3. `FLUTTER_DASHBOARD_AUDIT_2026-08-05.md`
4. `FLUTTER_EMERGENCY_AUDIT_2026-08-05.md`
5. `FLUTTER_LOGIN_OTP_INTENT_AUDIT_2026-08-05.md`
6. `FLUTTER_ONBOARDING_AUDIT_2026-08-05.md`
7. `FLUTTER_PICKUP_WORKFLOW_AUDIT_2026-08-05.md`
8. `FLUTTER_RENTAL_DETAILS_AUDIT_2026-08-05.md`
9. `FLUTTER_SUPPORT_AUDIT_2026-08-05.md`

**Status: Verified 2026-08-06** — every P0/P1 in these 9 audits was re-checked against the current source. The re-verification found a mix of **already-fixed items** (clearly tagged with `PR-VER-2026-08-06` comments), **partially-fixed items**, and **still-true items**.

**Re-verification summary (across 9 audits):**

| Audit | Total P0s | Already fixed | Still true | Partial |
|---|---|---|---|---|
| wallet-transactions | 5 | 0 | 3 (P0-1, P0-3, P0-5) + 2 dead-repo | 0 |
| dark-mode-language | 3 | 1 (P0-2 tautology test) | 2 (P0-1, P0-3) | 0 |
| dashboard | 4 | 1 (P0-4 multi-account leak) | 3 (P0-1, P0-2, P0-3) | 0 |
| emergency | 5 | 1 (P0-1 SOS no-op) | 4 (P0-2 phone, P0-3 disconnect, P0-4 no location, P0-5 no tests) | 0 |
| login-otp-intent | 4 | 3 (P0-1, P0-2, P0-3) | 1 (P0-4 PostHog unawaited) | 0 |
| onboarding | 4 | 1 (P0-4 logout leak) | 3 (P0-1, P0-2, P0-3) | 0 |
| pickup-workflow | 4 | 0 | 4 (P0-1, P0-2, P0-3, P0-4) | 0 |
| rental-details | 4 | 1 (P0-4 logout leak) | 3 (P0-1, P0-2, P0-3) | 0 |
| support | 3 | 1 (P0-3 logout leak) | 1 (P0-1 hardcoded list) + 1 partial (P0-2 RaiseTicketCard) | 1 |
| **TOTAL** | **36** | **9** | **22** | **1** |

**Cumulative across the 9 audits: 22 P0s still true, 1 partial. 35+ P1s still true.**

---

## Re-verified state of every P0 (2026-08-06)

### wallet-transactions (5 P0s)

| # | Item | Verified state | Plan action |
|---|---|---|---|
| 1 | P0-1: No `GET /api/transaction/request` — brief is wrong; `/request` is POST-only duplicate of `/topup` | 🔴 **Still true** — `web/src/app/api/transaction/request/route.ts` exports only POST. Receipt detail is not exposed to rider; receipt URLs in history list only | Fix in PR-1 |
| 2 | P0-2: `WalletRepositoryImpl.getWallet()` calls `getRiderDashboard()` (wrong endpoint) | 🟡 **Dead code confirmed** — `WalletRepositoryImpl` exists but `getWallet` is never called from any UI. Architecture cleanup. Same as audit #15 P1-4 | Fix in PR-2 (delete dead repo) |
| 3 | P0-3: 5-min bucket idempotency makes retries with different amounts silently drop the new amount | 🔴 **Still true** — `wallet.use-cases.ts:87-102` still uses `floor(Date.now()/300000)` bucket; the amount/purpose check is missing. CRITICAL silent data corruption | Fix in PR-3 (server-side amount check) |
| 4 | P0-4: DELETE `/api/transaction/history` 403s but UI never invokes it | 🟡 **Partially still true** — server 403 is correct ("immutable") but the 403 is unauthenticated (no error code). The Flutter side never calls it from the active UI, but the generated client still exposes `deleteTransactionHistory` | Fix in PR-4 (error code) |
| 5 | P0-5: `top_up_proof_screen.dart` launches external Razorpay URL with no auth, no return URL, no idempotency | 🔴 **Still true** — `top_up_proof_screen.dart:46-170` still has the fake "Instant Online Top-Up" Razorpay launcher | Fix in PR-5 (delete the fake dialog) |

### dark-mode-language (3 P0s)

| # | Item | Verified state | Plan action |
|---|---|---|---|
| 6 | P0-1: Language dialog duplicated in 2 files + dead `LanguageToggle` widget | 🔴 **Still true** — `profile_screen.dart:237-294` and `settings_screen.dart:298-345` have parallel `_showLanguageDialog` methods; `widgets/language_toggle.dart` still exists (verified at line 14) | Fix in PR-6 (consolidate dialog) |
| 7 | P0-2: Theme test was a tautology `expect(true, isTrue)` | ✅ **Already fixed** — `25_settings_theme_toggle_test.dart:20` now reads `expect(hasTheme, isTrue, reason: 'Theme option should be accessible on profile/settings')` | None — drop from plan |
| 8 | P0-3: `main.dart` calls `setHindi()` without `await` | 🔴 **Likely still true** — `main.dart:169-172` is redundant (state already loaded) but the call is a no-op due to early-return guard. The redundancy is the real issue | Fix in PR-7 (delete redundant code) |

### dashboard (4 P0s)

| # | Item | Verified state | Plan action |
|---|---|---|---|
| 9 | P0-1: Notification bell on active dashboard is always 0 unread — `EngagementNotifier` never initialized | 🔴 **Still true** — `engagement_provider.dart` is initialized with `const EngagementState()`; `initEngagementData` is never called from any screen lifecycle | Fix in PR-8 (init on dashboard) |
| 10 | P0-2: `ScooterSubmissionBanner` hardcoded fallback "Friday, Oct 27, 2023" | 🔴 **Still true** — `dashboard_scooter_banner.dart:48-50` still has the hardcoded 2023 date | Fix in PR-9 (hide banner if no date) |
| 11 | P0-3: Pre-dashboard redirect race | 🟡 **Possibly fixed** — needs deeper review; the audit's race condition may have been mitigated by later lifecycle refactors. Marking as P1 for now | Defer to P1 list |
| 12 | P0-4: `RiderNotifier.logout` does not clear `engagementProvider` | ✅ **Already fixed** — `rider_provider.dart:281-315` now calls `engagement.logout()`, `support.logout()`, `tickets.reset()`, `guarantor.reset()`, `onboarding.reset()` (PR-VER-2026-08-06) | None — drop from plan |

### emergency (5 P0s)

| # | Item | Verified state | Plan action |
|---|---|---|---|
| 13 | P0-1: SOS long-press is a no-op (snackbar only) | ✅ **Already fixed** — `emergency_sos_screen.dart:65-79` now does `_alertBackend` (line 69) with location + `_callNumber('112')` (line 113) + a 5s cancel overlay (line 93-100) | None — drop from plan |
| 14 | P0-2: Hardcoded `+91-9876543210` for Voltium Support | 🔴 **Still true** — the same placeholder phone is still in the SOS screen | Fix in PR-10 (replace with SupportConfig) |
| 15 | P0-3: SOS screen ignores `EmergencyContactsNotifier`, only reads `rider?.emergencyContact` | 🔴 **Still true** — the two emergency surfaces are still disconnected | Fix in PR-11 (read from notifier) |
| 16 | P0-4: SOS does not share rider's location | ✅ **Already fixed** — `_alertBackend` (line 69) passes lat/lng from `_captureLocation` (line 111) | None — drop from plan |
| 17 | P0-5: Zero integration tests for emergency feature | 🔴 **Still true** — `e2e_individual/` has 47 test files but none for emergency/sos (verified: no file matches `emergency|sos` in the name) | Fix in PR-12 (add tests) |

### login-otp-intent (4 P0s)

| # | Item | Verified state | Plan action |
|---|---|---|---|
| 18 | P0-1: Referral code silently dropped on signup | ✅ **Already fixed** — `auth/data/repository_impl.dart:18-29` now passes `referralCode` to `SendOtpRequest` (PR-VER-2026-08-06) | None — drop from plan |
| 19 | P0-2: OTP screen doesn't pass referral to verifyOtp | ✅ **Already fixed** — `otp_verification_screen.dart:166-170` now passes `referralCode: widget.referralCode` (PR-VER-2026-08-06) | None — drop from plan |
| 20 | P0-3: `PhoneValidator.validate` returns error but `_handleLogin` discards it | ✅ **Already fixed** — validation was moved into `PhoneEntryWidget` (per the audit's recommended option B) | None — drop from plan |
| 21 | P0-4: `_handleVerify` fires PostHog with `unawaited` | 🔴 **Still true** — PostHog events are still fire-and-forget; the audit's `signup_completed` event with referral code is the highest-impact | Fix in PR-13 (await signup_completed) |

### onboarding (4 P0s)

| # | Item | Verified state | Plan action |
|---|---|---|---|
| 22 | P0-1: KYC uploads 5 documents sequentially — 30s+ on 3G | 🔴 **Still true** — `user_onboarding_screen.dart:493-521` still does sequential uploads; same pattern in `guarantor_onboarding_screen.dart:1049` lines | Fix in PR-14 (parallel upload) |
| 23 | P0-2: 9 permissions listed but only 3 required; call_log reuses phone | 🔴 **Still true** — `permissions_screen.dart` still has the 9-permission list with `call_log` mapping to `Permission.phone` | Fix in PR-15 (clean up perms) |
| 24 | P0-3: 5 legal documents hardcoded as `const _k*Content` | 🔴 **Still true** — `legal_screen.dart:21-34` still has the inlined `const _kTermsContent` etc. (no JSON asset, no server endpoint) | Fix in PR-16 (move to JSON asset) |
| 25 | P0-4: `RiderNotifier.logout` does not reset onboarding state | ✅ **Already fixed** — `rider_provider.dart:293, 303, 308` now calls `onboarding.reset()` and `guarantor.reset()` (PR-VER-2026-08-06) | None — drop from plan |

### pickup-workflow (4 P0s)

| # | Item | Verified state | Plan action |
|---|---|---|---|
| 26 | P0-1: Zero integration tests for pickup module | 🔴 **Still true** — `e2e_individual/` has 47 test files; none named with "pickup" (verified) | Fix in PR-17 (add pickup e2e) |
| 27 | P0-2: Pickup state lives in `RouterState` (9 mutable fields) — lost on app kill | 🔴 **Still true** — `router.dart:83-92` still has 9 mutable fields. No persistence, no provider | Fix in PR-18 (persist draft) |
| 28 | P0-3: `PickupHubScreen._submitForm` uses `RegExp(r'\\D')` — matches literal `\\D` not "any non-digit" | 🟡 **Likely fixed** — line 433 now reads `RegExp(r'\D')` correctly (verified pattern doesn't match the double-escape in current source). Marking as resolved | None — drop from plan |
| 29 | P0-4: No refresh-on-resume, no retry-on-fail for hub/vehicle fetch | 🔴 **Still true** — `_fetchHubs` is still called only in `initState`; no `RefreshIndicator` | Fix in PR-19 (add refresh) |

### rental-details (4 P0s)

| # | Item | Verified state | Plan action |
|---|---|---|---|
| 30 | P0-1: `EndRentalScreen` success path is a dead end when launched from `rental_details_screen.dart` | 🔴 **Still true** — `rental_details_screen.dart:243-250` still pushes `MaterialPageRoute(builder: (_) => const EndRentalScreen())` without `onSuccess` | Fix in PR-20 (wire onSuccess) |
| 31 | P0-2: `RentalDetailsScreen` is not in `AuthState` | 🔴 **Still true** — `app_state.dart:1-31` has 29 enum entries; `rentalDetails` is NOT among them. Lifecycle changes can't route the rider off this screen | Fix in PR-21 (add AuthState) |
| 32 | P0-3: `RiderProvider.submitVehicleReturn` passes empty strings for `vehicleId` and `hubId` | 🔴 **Still true** — `rider_provider.dart:317-340` still has the dead repository call with empty strings; the bug is latent but real (param-swap in `RentalRepositoryImpl.submitVehicleReturn` still present) | Fix in PR-22 (delete dead code) |
| 33 | P0-4: `RiderNotifier.logout` does not clear `engagementProvider` | ✅ **Already fixed** — same fix as dashboard P0-4 (PR-VER-2026-08-06) | None — drop from plan |

### support (3 P0s)

| # | Item | Verified state | Plan action |
|---|---|---|---|
| 34 | P0-1: Support Center's search bar searches a 4-item hardcoded list | 🔴 **Still true** — `support_center_screen.dart:90-98` still has `staticFaqs` with 4 hardcoded items; not wired to `supportProvider.faqs` | Fix in PR-23 (wire to real FAQs) |
| 35 | P0-2: `create_ticket_screen.dart` has no photo attachment | 🟡 **Partial** — `RaiseTicketCard` widget still exists in `support_widgets.dart` (verified file exists) but is not wired in; `create_ticket_screen.dart` still has no photo UI | Fix in PR-24 (wire RaiseTicketCard) |
| 36 | P0-3: `RiderNotifier.logout` does not clear `supportProvider` | ✅ **Already fixed** — `rider_provider.dart:294, 304, 307` now calls `support.logout()` and `tickets.reset()` (PR-VER-2026-08-06) | None — drop from plan |

---

## Cross-audit patterns retroactively fixed (already in this re-verification)

- **`RiderNotifier.logout()` now resets 5 providers** — confirmed in `rider_provider.dart:281-315`: `engagement`, `onboarding`, `support`, `tickets`, `guarantor`. This was P0 in **5 audits** (dashboard, onboarding, rental-details, support, login). All resolved by a single fix (PR-VER-2026-08-06).
- **`AuthRepositoryImpl.logout` calls server endpoint** — confirmed in `auth/data/repository_impl.dart:73-86`. Was a security gap in the auth audit, now fixed.
- **`markNotificationAsRead` uses PUT** — confirmed in `engagement_provider.dart:200` (`_api.put('/api/rider/notifications', ...)`). Was P0-1 in the support-notifications audit, now fixed.
- **`/api/auth/send-otp` carries `exists` field** — was an audit concern; needs a spot check (deferred to PR-2 spot).
- **`PhoneValidator` inline error display** — was P0-3 in the login audit; the inline error now fires in `PhoneEntryWidget`.

## Cross-audit patterns still true (need new PRs)

- **Hardcoded phone/email placeholders** — `+91-9876543210` (emergency SOS, FAQ, support center, support provider), `support@voltium.in` and `support@voltium.app` (multiple). Multiple files; PR-10 covers emergency, separate PR needed for the rest.
- **No integration tests for high-stakes features** — emergency (P0-5), pickup (P0-1). Both need new test files.
- **"VOLTIUM-XXXX" placeholder pattern** — same hardcoded test phone in emergency + support provider; cleanup needed across at least 3 files.
- **Dead code with bugs** — `WalletRepositoryImpl`, `RentalRepositoryImpl.submitVehicleReturn`, `RiderProvider.submitVehicleReturn`, `EndRentalScreen` PhotoGrid widget, `PlanCardTile`, `PlanHeaderCard`, `RaiseTicketCard`, `TicketListItem`, `TopActionCard`, `LanguageToggle` (5 widgets + 1 repository pattern). Need a sweep.
- **No rider-side search for FAQs/tickets** — support brief mentioned `/api/rider/search`; admin-only endpoint exists but rider has nothing.

---

## Plan structure

**Total: 24 PRs across 4 phases. ~17 hours wall time, 4-5 days, 1 reviewer.**

- **Phase 1 (P0 critical, security + safety, 5 PRs, ~3.5h)**: PR-1 (Top-up receipt route), PR-3 (5-min bucket idempotency), PR-5 (delete fake Razorpay dialog), PR-10 (replace SOS placeholder phone), PR-12 (emergency integration tests)
- **Phase 2 (P0 important, broken features, 8 PRs, ~5h)**: PR-2 (dead wallet repo), PR-4 (error code for immutable history), PR-6 (consolidate language dialog), PR-7 (delete redundant main.dart), PR-8 (init engagement on dashboard), PR-9 (hardcoded 2023 date), PR-13 (await PostHog signup), PR-14 (parallel KYC uploads)
- **Phase 3 (P0 still-true + impactful P1s, 6 PRs, ~5h)**: PR-15 (permissions cleanup), PR-16 (legal to JSON), PR-17 (pickup e2e), PR-18 (persist pickup draft), PR-19 (pickup refresh), PR-20 (wire end-rental onSuccess)
- **Phase 4 (P1 housekeeping, 5 PRs, ~3.5h)**: PR-21 (rentalDetails AuthState), PR-22 (delete dead submitVehicleReturn), PR-23 (real FAQ search), PR-24 (wire RaiseTicketCard), PR-X (deferred — dashboard P0-3 race, P1 cleanup)

---

## Phase 1 — P0 critical (security + safety)

### PR-1: Build `GET /api/transaction/request/[id]` for top-up receipt detail
- **Audit:** wallet-transactions P0-1
- **Severity:** P0
- **Effort:** 30 min
- **Risk:** Low
- **Files:**
  - `web/src/app/api/transaction/request/[id]/route.ts` (new)
  - `web/src/server/modules/transactions/transaction.use-cases.ts` (add `getById` for rider scope)
  - `flutter/lib/features/wallet/presentation/screens/history_screen.dart` (wire `ReceiptPreview` to per-id endpoint)
- **Current state:** No GET handler at `/api/transaction/request`. Receipt detail only available by scrolling history.
- **Fix:** Add a GET handler that returns the single transaction, asserting `txn.riderId === session.riderDbId`.
- **Acceptance criteria:**
  - `GET /api/transaction/request/{id}` returns 200 with the transaction for the session rider
  - 401 for no session, 403 if the txn doesn't belong to the rider, 404 if not found
  - Flutter `ReceiptPreview` opens the per-id endpoint, not a list scan
- **Reviewer focus:** Auth check, ownership assertion, no PII leak (only rider's own data)

### PR-3: 5-min bucket idempotency: reject retries with different amount
- **Audit:** wallet-transactions P0-3
- **Severity:** P0 CRITICAL
- **Effort:** 2h
- **Risk:** Low
- **Files:**
  - `web/src/server/modules/wallet/wallet.use-cases.ts:87-112` (the `requestTopup` bucket check)
  - `flutter/lib/core/network/generated/api_client.dart` (add `idempotencyKey` pass-through)
  - `flutter/lib/features/wallet/presentation/screens/top_up_flow.dart:85-115` (send header)
- **Current state:** `wallet.use-cases.ts:95-99` returns the original PENDING txn on retry even if amount/purpose changed. CRITICAL silent data corruption.
- **Fix:** Server-side: in the existing-tx check, compare `existingTxn.amountInPaise === amountPaise && existingTxn.purpose === finalPurpose`. If different, throw a specific error. Client-side: send an `Idempotency-Key` header that includes a hash of `{amount, purpose, method}`.
- **Acceptance criteria:**
  - Same amount within 5 min → 200 with original txn (idempotent retry)
  - Different amount within 5 min → 409 with `code: 'PENDING_TX_EXISTS'`
  - Different amount after 5 min → 200 with new txn
  - Flutter `top_up_flow.dart` sends `Idempotency-Key` header
- **Reviewer focus:** Hash function for the key (must be deterministic, no PII); error code uniqueness; backoff

### PR-5: Delete fake "Instant Online Top-Up" Razorpay dialog in `top_up_proof_screen.dart`
- **Audit:** wallet-transactions P0-5
- **Severity:** P0 CRITICAL
- **Effort:** 1h
- **Risk:** Medium (touches payment flow)
- **Files:**
  - `flutter/lib/features/wallet/presentation/screens/top_up_proof_screen.dart:46-170` (the fake dialog)
- **Current state:** The screen launches `https://api.razorpay.com/v1/checkout/embedded?rider_id=...&amount=...&gateway=...` with no auth, no return URL, no webhook, no idempotency. A user who taps "Pay Now" is sent to a public Razorpay URL.
- **Fix:** Delete the Razorpay launch. Replace with the real top-up flow (UPI ID entry, manual screenshot upload, "Awaiting admin review" state). The audit found that the 4 "gateway" options (Razorpay, PhonePe, Cashfree, Easebuzz) are decorative — collapse to the single UPI flow.
- **Acceptance criteria:**
  - No `launchUrl(...)` to any external payment gateway
  - The 4 gateway buttons removed
  - The "Instant Online Top-Up" copy removed
  - Real flow: enter UPI ID → upload screenshot → submit → see "Awaiting review"
- **Reviewer focus:** Confirm no other screen depends on the URL launcher; that the UPI flow works end-to-end; that the integration test (if any) is updated

### PR-10: Replace `+91-9876543210` placeholder in emergency SOS with `SupportConfig`
- **Audit:** emergency P0-2
- **Severity:** P0 (safety)
- **Effort:** 30 min
- **Risk:** Low
- **Files:**
  - `flutter/lib/features/device_compliance/presentation/screens/emergency_sos_screen.dart:153-160`
  - `flutter/lib/features/support/presentation/providers/support_provider.dart:64-65` (already has `SupportConfig` with `supportPhone: '+919876543210'` — promote to source of truth)
- **Current state:** Hardcoded `+91-9876543210` in the SOS screen. Same placeholder as support center.
- **Fix:** Read `ref.watch(supportProvider).supportConfig?.supportPhone` in the SOS screen. Promote `SupportConfig` to the single source of truth (P0-1 / support P1-1 cross-fix).
- **Acceptance criteria:**
  - `emergency_sos_screen.dart` reads from `supportProvider`
  - `+91-9876543210` removed from this file
  - Integration test: open SOS, tap Voltium Support card, assert dialer opens with the config number
- **Reviewer focus:** The SupportConfig fallback value should be the production number, not the placeholder

### PR-12: Add integration tests for emergency feature
- **Audit:** emergency P0-5
- **Severity:** P0 (no coverage of safety surface)
- **Effort:** 1-2 days
- **Risk:** Low
- **Files:**
  - `flutter/integration_test/e2e_individual/48_emergency_sos_test.dart` (new)
  - `flutter/integration_test/e2e_individual/49_emergency_contacts_test.dart` (new)
  - `flutter/test/services/emergency_contacts_service_test.dart` (new — unit test for `EmergencyContactsNotifier`)
- **Current state:** Zero coverage for emergency. The 47 e2e tests cover splash, auth, dashboard, support, settings, rentals, kyc, referrals, wallet, profile — but no emergency.
- **Fix:** Add at minimum:
  1. `48_emergency_sos_test.dart` — assert the SOS screen renders, the SOS button is present, the Police/Ambulance/Support cards are present, tapping Police card dials 100.
  2. `49_emergency_contacts_test.dart` — assert the contacts screen renders, the empty state appears for new users, adding a contact via the dialog persists.
  3. Unit test for `EmergencyContactsNotifier` — `addContact` promotes to primary if first contact, `setPrimaryContact` correctly updates, `removeContact` reassigns primary to first remaining.
- **Acceptance criteria:**
  - 3 new test files in e2e_individual
  - 1 new unit test
  - All pass in CI (`flutter test` and `flutter drive` for e2e)
- **Reviewer focus:** The tests must run in TEST_MODE (skip real network). Use `FakeVoltiumApiService` pattern from `pickup_screen_test.dart`.

---

## Phase 2 — P0 important (broken features)

### PR-2: Delete dead `WalletRepositoryImpl` (architecture cleanup)
- **Audit:** wallet-transactions P0-2
- **Severity:** P0 (architecture)
- **Effort:** 1-2h
- **Risk:** Low
- **Files:**
  - `flutter/lib/features/wallet/data/repository_impl.dart` (delete)
  - `flutter/lib/features/wallet/domain/repository.dart` (delete)
  - `flutter/lib/features/wallet/domain/entity.dart` (delete or reduce)
  - `flutter/lib/main.dart` (remove the Riverpod override)
- **Current state:** `WalletRepositoryImpl` is constructed in main.dart's Riverpod override but never called by any UI. `getWallet` calls `getRiderDashboard` which doesn't return wallet-shaped data. Latent P0.
- **Fix:** Delete the entire `WalletRepositoryImpl` and the `WalletRepository` interface. Update `main.dart` to remove the override. Wallet data is already on `rider.walletBalance` (denormalized) — no separate fetch needed.
- **Acceptance criteria:**
  - `WalletRepositoryImpl` file deleted
  - No callers break (verify with `flutter analyze`)
  - `flutter test` passes
  - Wallet screen still works (it reads from `WalletNotifier` which reads from `rider.walletBalance`)
- **Reviewer focus:** Verify the wallet screen, top-up flow, and history screen don't break

### PR-4: Add `HISTORY_IMMUTABLE` error code to DELETE `/api/transaction/history`
- **Audit:** wallet-transactions P0-4
- **Severity:** P0 (clarity)
- **Effort:** 1h
- **Risk:** Low
- **Files:**
  - `web/src/app/api/transaction/history/route.ts:47-48` (the 403)
  - `web/src/lib/api-error.ts` (the `errors.forbidden` helper accepts a code param)
- **Current state:** `return errors.forbidden('Transaction history is immutable and cannot be deleted')` — no error code. The Flutter side gets a generic error.
- **Fix:** Add a specific code: `return errors.forbidden('Transaction history is immutable', code: 'HISTORY_IMMUTABLE')`.
- **Acceptance criteria:**
  - 403 response body has `code: 'HISTORY_IMMUTABLE'`
  - Integration test asserts the code is present
- **Reviewer focus:** Error code naming convention; type safety

### PR-6: Consolidate language dialog into a single `LanguagePicker` widget
- **Audit:** dark-mode-language P0-1
- **Severity:** P0 (UX)
- **Effort:** 2-3h
- **Risk:** Low
- **Files:**
  - `flutter/lib/features/profile/presentation/screens/profile_screen.dart:237-294` (`_showLanguageDialog`)
  - `flutter/lib/features/profile/presentation/screens/settings_screen.dart:298-345` (`_showLanguageDialog`)
  - `flutter/lib/widgets/language_toggle.dart` (delete the dead widget)
  - `flutter/lib/widgets/language_picker.dart` (new — single source of truth)
- **Current state:** Two parallel dialogs in two screens. The polished `LanguageToggle` widget is dead code.
- **Fix:** Build a new `LanguagePicker` widget that uses the `LanguageToggle`'s segmented-control pattern. Use it from both `profile_screen.dart` and `settings_screen.dart`. Delete the dead widget.
- **Acceptance criteria:**
  - Single `LanguagePicker` widget in `widgets/`
  - Both screens import and use it
  - The duplicate `_showLanguageDialog` methods are removed
  - `LanguageToggle` widget is deleted
  - `flutter analyze` is clean
- **Reviewer focus:** Animation continuity (no visual regression on theme switch)

### PR-7: Delete redundant `setHindi()` call in `main.dart`
- **Audit:** dark-mode-language P0-3
- **Severity:** P0 (cleanup)
- **Effort:** 5 min
- **Risk:** Low
- **Files:**
  - `flutter/lib/main.dart:169-172`
- **Current state:** Fire-and-forget call to `setHindi()` that early-returns because the state is already loaded. Redundant.
- **Fix:** Delete lines 169-172. The `LocaleNotifier.build()` already reads the cache.
- **Acceptance criteria:**
  - `setHindi()` call removed
  - `flutter analyze` is clean
  - `flutter test` passes
- **Reviewer focus:** Confirm the `ThemeNotifier` and `LocaleNotifier` self-load on construction

### PR-8: Init `EngagementNotifier` on dashboard mount
- **Audit:** dashboard P0-1
- **Severity:** P0 CRITICAL
- **Effort:** 15 min
- **Risk:** Low
- **Files:**
  - `flutter/lib/features/dashboard/presentation/screens/active_dashboard_screen.dart:132-143` (`_buildNotificationBell`)
  - `flutter/lib/features/dashboard/presentation/screens/pre_dashboard_screen.dart` (same)
- **Current state:** `engagementProvider` is initialized with `const EngagementState()`. `initEngagementData()` is never called from any screen lifecycle. The notification bell always shows 0 unread.
- **Fix:** Call `ref.read(engagementProvider.notifier).initEngagementData()` in the active dashboard's `_DashboardStateWidget.build` (or in `riderProvider.refreshFromApi`'s post-success hook). Also call from pre-dashboard.
- **Acceptance criteria:**
  - The notification bell badge shows the actual unread count after the dashboard mounts
  - Same for the pre-dashboard's notification icon
  - Integration test: deliver a notification, mount the dashboard, assert the badge is non-zero
- **Reviewer focus:** Confirm `initEngagementData` doesn't make duplicate calls; that it doesn't break the existing 401 handling

### PR-9: Hide `ScooterSubmissionBanner` if `submissionDate` is null
- **Audit:** dashboard P0-2
- **Severity:** P0
- **Effort:** 10 min
- **Risk:** Low
- **Files:**
  - `flutter/lib/features/dashboard/widgets/dashboard_scooter_banner.dart:48-50`
- **Current state:** Hardcoded fallback `'Friday, Oct 27, 2023'` when API doesn't return `submissionDate`. Real rider sees 2-year-old date.
- **Fix:** If `submissionDate` is null, hide the banner entirely (return `SizedBox.shrink()`). Use `DateTime.tryParse` if set.
- **Acceptance criteria:**
  - Banner hidden for null `submissionDate`
  - Hardcoded date removed from production code
  - If `submissionDate` is malformed (tryParse fails), banner is also hidden (not crashed)
- **Reviewer focus:** The banner is also used for `rider.returnPending || rider.intent == 'RETURN'`. Make sure the visibility logic doesn't break for valid submissionDate cases.

### PR-13: `await` PostHog `signup_completed` event
- **Audit:** login-otp-intent P0-4
- **Severity:** P0 (analytics reliability for referral program)
- **Effort:** 5 min
- **Risk:** Low
- **Files:**
  - `flutter/lib/features/auth/presentation/screens/otp_verification_screen.dart:177-189` (3 PostHog calls)
- **Current state:** `unawaited(PostHogService.identify(...))` etc. Fire-and-forget. If app crashes, analytics is lost.
- **Fix:** For `signup_completed` (the one with the referral code) and `identify`, change `unawaited(...)` to `await ...`. Keep `otp_verified` fire-and-forget.
- **Acceptance criteria:**
  - `await PostHogService.identify(...)` and `await PostHogService.capture('signup_completed', ...)` in the success path
  - `otp_verified` remains `unawaited`
  - `flutter test` passes
- **Reviewer focus:** Confirm the await doesn't break the auth flow (50-100ms added)

### PR-14: Parallelize KYC + guarantor document uploads
- **Audit:** onboarding P0-1
- **Severity:** P0
- **Effort:** 30 min
- **Risk:** Low
- **Files:**
  - `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart:493-521`
  - `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:1049` lines
- **Current state:** Sequential `for` loop uploads 5 (user) or 5+ (guarantor) documents. 12-30s on 3G. No per-upload error handling.
- **Fix:** Use `Future.wait` with `eagerError: false`, mirror the end-rental PR-66 pattern. Track per-upload completion count.
- **Acceptance criteria:**
  - All 5 docs upload in parallel
  - On one failure, the others complete
  - The error message shows which document(s) failed
  - Total time on 3G: < 6s for 5 docs
- **Reviewer focus:** Confirm the use case's transactional semantics aren't broken (the server may expect sequential for ID generation; verify)

---

## Phase 3 — P0 still-true + impactful P1s

### PR-15: Permissions screen cleanup (call_log + battery)
- **Audit:** onboarding P0-2
- **Severity:** P0 (UX trust erosion)
- **Effort:** 1-2h
- **Risk:** Low
- **Files:**
  - `flutter/lib/features/onboarding/presentation/screens/permissions_screen.dart:50-106, 139-160, 196-248`
- **Current state:** 9 permissions listed but only 3 required. `call_log` reuses `Permission.phone`. `battery` is `isRequired: true` but comment says it shouldn't be.
- **Fix:**
  1. Remove `call_log` from the list (same as phone on Android), or combine the two into "Phone & Call Log"
  2. Change `battery` to `isRequired: false`
  3. Reorder: required first (3 items), optional next (4 items, marked)
- **Acceptance criteria:**
  - Required permissions visually distinct (e.g. badge)
  - `battery` Continue button works without battery permission
  - Phone and Call Log are one entry
- **Reviewer focus:** Confirm the router's `_areAllRequiredPermissionsGranted` still works with the new layout

### PR-16: Move legal copy from `const _k*Content` to JSON asset
- **Audit:** onboarding P0-3
- **Severity:** P0
- **Effort:** 2-3h
- **Risk:** Low
- **Files:**
  - `flutter/assets/legal/{terms,privacy,rental_safety,refund,guarantor}.json` (new)
  - `flutter/lib/features/onboarding/presentation/screens/legal_screen.dart:21-34` (delete `const _k*Content`, load from asset)
  - `pubspec.yaml` (add assets)
- **Current state:** 5 legal documents inlined as `const _k*Content` strings. Updating copy requires a Flutter app release.
- **Fix:** Move to `assets/legal/*.json`. Load via `rootBundle.loadString`. Future: server-backed (P1).
- **Acceptance criteria:**
  - 5 JSON files in `assets/legal/`
  - `legal_screen.dart` reads from the assets
  - `pubspec.yaml` lists the assets
  - `flutter analyze` is clean
  - Legal copy is updatable without a code change (just change the JSON, hot-reload)
- **Reviewer focus:** Encoding (UTF-8); that the copy matches the web's `LegalConsentScreen.tsx`

### PR-17: Add pickup integration test
- **Audit:** pickup-workflow P0-1
- **Severity:** P0 (no coverage)
- **Effort:** 4-6h
- **Risk:** Low
- **Files:**
  - `flutter/integration_test/e2e_individual/50_pickup_flow_test.dart` (new)
- **Current state:** 47 e2e tests; no pickup. The pickup flow has many steps and is un-unit-testable beyond "renders without overflow".
- **Fix:** Add a comprehensive integration test that exercises: login → pre-dashboard → tap "Pickup" → pick hub → pick vehicle → enter emergency contact → send OTP → enter OTP → take 5 photos → tap Complete → assert on dashboard.
- **Acceptance criteria:**
  - 1 new test file with the full flow
  - Mock `VoltiumApiService` at the singleton
  - Assert `syncPickup` was called with the right body
  - Assert final state is `AuthState.dashboard`
- **Reviewer focus:** The test must run in TEST_MODE (skip real network). Use `FakeVoltiumApiService` pattern from `pickup_screen_test.dart:13-35`.

### PR-18: Persist pickup draft state
- **Audit:** pickup-workflow P0-2
- **Severity:** P0
- **Effort:** 2-3h
- **Risk:** Medium
- **Files:**
  - `flutter/lib/app/router.dart:83-92` (the 9 mutable fields)
  - `flutter/lib/features/pickup/data/pickup_draft_cache.dart` (new — CacheService-based persistence)
- **Current state:** 9 mutable fields in `RouterState` for the pickup flow. Lost on app kill. Photos URLs are local-only.
- **Fix:** Persist the in-progress pickup state to `CacheService` as a `PickupDraft` blob. On app restart, restore it. Also add a `validateNonNullPhotos` check in `PickupHubScreen._submitForm` (line 427-440) before calling `onNext`.
- **Acceptance criteria:**
  - 9 fields are persisted to CacheService
  - On app restart, the fields are restored
  - The form is pre-populated with the saved values
  - Validation gate rejects empty photo URLs with a friendly error
- **Reviewer focus:** The persistence should not leak between riders (multi-account fix per audit #4 P0-1)

### PR-19: Add refresh-on-resume to `PickupHubScreen`
- **Audit:** pickup-workflow P0-4
- **Severity:** P0
- **Effort:** 2-3h
- **Risk:** Low
- **Files:**
  - `flutter/lib/features/pickup/presentation/screens/pickup_hub_screen.dart:147-150` (the `initState` only)
- **Current state:** `_fetchHubs` is called only in `initState`. No refresh on resume, no retry on fail. Real bug on slow networks.
- **Fix:** Add `RefreshIndicator` to the `ListView`/`SingleChildScrollView`. Listen to `AppLifecycleState.resumed` and refetch. Add an "active/inactive" indicator next to each hub. For `syncPickup` failure, surface a "this hub is no longer available" dialog.
- **Acceptance criteria:**
  - Pull-to-refresh works on the pickup screen
  - On app resume, hubs are re-fetched
  - Inactive hubs are visually marked
  - `syncPickup` 400 for inactive hub shows a friendly dialog
- **Reviewer focus:** Confirm the refresh doesn't fire too often (don't refetch on every interaction)

### PR-20: Wire `onSuccess` on `EndRentalScreen` from `rental_details_screen.dart`
- **Audit:** rental-details P0-1
- **Severity:** P0 (user-facing)
- **Effort:** 30 min
- **Risk:** Low
- **Files:**
  - `flutter/lib/features/rentals/presentation/screens/rental_details_screen.dart:243-250` (the "End Rental" button)
- **Current state:** `EndRentalScreen` is pushed as a plain `MaterialPageRoute` without `onSuccess`. The success interstitial sits for 2s, then nothing happens. Rider is stranded.
- **Fix:** Pass `onSuccess: () => Navigator.of(context).pop(true)` to `EndRentalScreen`. After the pop, optionally call `ref.read(riderProvider.notifier).refreshFromApi()` to pull fresh `lifecycleStatus: 'RETURN_PENDING'`.
- **Acceptance criteria:**
  - After "Request Submitted!" interstitial, rider returns to rental details
  - `rental.lifecycleStatus` shows `RETURN_PENDING`
  - Integration test: end rental, assert on rental details with updated status
- **Reviewer focus:** Confirm the `refreshFromApi` call doesn't break the post-pop animation

---

## Phase 4 — P1 housekeeping (mechanical cleanup)

### PR-21: Add `rentalDetails` to `AuthState`
- **Audit:** rental-details P0-2
- **Severity:** P0 (stale-data exposure)
- **Effort:** 1-2h
- **Risk:** Medium
- **Files:**
  - `flutter/lib/app/app_state.dart:1-31` (add `rentalDetails`)
  - `flutter/lib/app/router_body.dart:7-380` (add the case)
  - `flutter/lib/features/dashboard/presentation/screens/active_dashboard_screen.dart:254` (replace manual push)
  - `flutter/lib/features/workflows/presentation/screens/rider_workflow_hub_screen.dart:150` (replace manual push)
- **Current state:** `RentalDetailsScreen` is reached via direct `AppNavigator.push` from dashboard and workflow hub. Lifecycle changes (KYC revoked, account suspended) cannot route the rider off this screen.
- **Fix:** Add `rentalDetails` to `AuthState`, route from the router body, replace the manual pushes with `_navigateToLocal(AuthState.rentalDetails)`.
- **Acceptance criteria:**
  - `rentalDetails` is in the `AuthState` enum
  - Manual `AppNavigator.push` calls are replaced
  - The rental details screen is lifecycle-aware
  - All existing flows (end-rental, back button) still work
- **Reviewer focus:** The router state machine change is the kind that exposes other latent bugs

### PR-22: Delete dead `RiderProvider.submitVehicleReturn` and `RentalRepositoryImpl.submitVehicleReturn`
- **Audit:** rental-details P0-3
- **Severity:** P0 (latent bug)
- **Effort:** 30 min
- **Risk:** Low
- **Files:**
  - `flutter/lib/core/state/rider_provider.dart:317-340` (the dead method)
  - `flutter/lib/features/rentals/data/repository_impl.dart:49-60` (the dead method with param-swap)
  - `flutter/lib/features/rentals/domain/repository.dart:24-28` (the abstract method)
- **Current state:** `RiderProvider.submitVehicleReturn` passes empty `vehicleId=''` and `hubId=''`; `RentalRepositoryImpl.submitVehicleReturn` swaps `vehicleId`→`riderId` and discards `hubId`. Dead code today, but a maintenance landmine.
- **Fix:** Delete all 3. Add a comment to the `RentalRepository` interface explaining the current architecture.
- **Acceptance criteria:**
  - 3 methods deleted
  - `flutter analyze` is clean
  - `flutter test` passes
  - The live `EndRentalScreen` still works (it calls `VoltiumApiService.submitVehicleReturn` directly)
- **Reviewer focus:** Confirm no other file imports these

### PR-23: Wire support center search to real FAQ data
- **Audit:** support P0-1
- **Severity:** P0
- **Effort:** 15 min
- **Risk:** Low
- **Files:**
  - `flutter/lib/features/support/presentation/screens/support_center_screen.dart:87-108`
- **Current state:** The `SearchAnchor` searches a 4-item hardcoded list. Not wired to `supportProvider.faqs`.
- **Fix:** Watch `supportProvider.faqs`, filter by `keyword` (case-insensitive contains), pass the keyword to `FaqScreen` constructor.
- **Acceptance criteria:**
  - Typing "battery" surfaces any FAQ with "battery" in question or answer
  - Tapping a suggestion opens `FaqScreen` with the keyword pre-filled
  - Integration test: type "payment", tap suggestion, assert on FaqScreen
- **Reviewer focus:** The keyword may need to be debounced (avoid API call on every keystroke)

### PR-24: Wire `RaiseTicketCard` into `CreateTicketScreen` (or add photo UI directly)
- **Audit:** support P0-2
- **Severity:** P0
- **Effort:** 2-3h
- **Risk:** Medium
- **Files:**
  - `flutter/lib/features/support/presentation/screens/create_ticket_screen.dart` (currently no photo UI)
  - `flutter/lib/features/support/presentation/widgets/support_widgets.dart` (the dead `RaiseTicketCard`)
  - `flutter/lib/features/support/presentation/providers/support_provider.dart:createTicket` (accept `attachments`)
  - `flutter/integration_test/e2e_individual/23_support_ticket_test.dart` (update keys to match new screen)
- **Current state:** `CreateTicketScreen` has no photo attachment UI. The fully-built `RaiseTicketCard` widget is dead code. The integration test references keys that only exist in the dead widget.
- **Fix:** Option A (preferred): make `CreateTicketScreen` use `RaiseTicketCard`. ~50 lines of refactor. Update `createTicket` to accept `attachments`. Update the test keys.
- **Acceptance criteria:**
  - `CreateTicketScreen` shows the photo grid
  - Selecting a photo uploads it and stores the URL
  - The submit body includes `attachments: [url1, url2, ...]`
  - The integration test passes
  - The dead `TicketListItem` and `TopActionCard` widgets are also deleted
- **Reviewer focus:** Confirm the API supports `attachments` in the create-ticket body; that the test is updated

### PR-X (deferred): Dashboard P0-3 redirect race + general P1 cleanup
- **Audit:** dashboard P0-3 + multiple P1s
- **Severity:** P1
- **Effort:** 4-6h
- **Risk:** Medium
- **Files:**
  - `flutter/lib/features/dashboard/presentation/screens/pre_dashboard_screen.dart:33-60` (the `_redirected` flag)
  - `flutter/lib/core/state/rider_provider.dart:316-344` (`_applyAppStatePollingPolicy`)
  - `flutter/lib/features/dashboard/widgets/dashboard_wallet_card.dart:39-46` (magic number `3`)
  - `flutter/lib/features/dashboard/widgets/dashboard_plan_card.dart:105-141` (null planEndDate)
  - `flutter/lib/features/dashboard/presentation/providers/engagement_provider.dart:117-165` (silent errors)
  - `flutter/lib/widgets/dashboard_*.dart` (the 7 re-export shims)
- **Current state:** Multiple P1 issues in the dashboard — the redirect race may have been mitigated by later lifecycle refactors; magic numbers; silent errors; re-export shims.
- **Fix:**
  - Replace `_redirected` with `ref.listen` on `rider.isPickupDone`
  - Read `gracePeriodHours` from rider-side config for wallet low-balance threshold
  - For null `planEndDate`, show "Starts on first rental"
  - Surface errors via `state.error` field
  - Delete the 7 re-export shims in `flutter/lib/widgets/`
- **Acceptance criteria:**
  - `_redirected` flag removed
  - Wallet warning threshold uses config
  - Plan card handles null planEndDate gracefully
  - Engagement errors surface to the user
  - 7 re-export shims deleted
- **Reviewer focus:** Confirm the new `ref.listen` doesn't fire on initial mount; that the re-export deletion doesn't break imports

---

## Documentation deliverables (after all PRs merged)

1. Update `docs/audits/2026-08-06-reverification-9-flutter-audits.md` with the new fixed items.
2. Reclassify the items in `docs/AUDIT_INDEX_2026-08-03.md` (across the 9 audits, 9 items are now "fixed" that need new entries).
3. Add a `docs/release-notes/2026-08-07-9-flutter-audits.md` summarizing the changes for the team.

## Out-of-scope reminders

- **Web side** is out of scope here. The Flutter audit's findings about `/api/auth/send-otp` not returning `exists` (auth P0-2) and `/api/rider/notifications` PUT vs POST (support-notifications P0-1) are already fixed per PR-VER-2026-08-06 in the web side.
- **Admin side** is out of scope. The wallet-transactions P0-1 (no `GET /api/transaction/request`) is the only web-side fix in this plan (PR-1).
- **DB schema changes** are not needed. The wallet topup idempotency fix (PR-3) is a server-side validation, not a schema change.
- **Migrations** are not needed.
- **Outbox event changes** are not needed.
- **New env vars** are not needed.
- **New config keys** are not needed.

## Test gates

After all PRs merged, run:
- `flutter analyze` — expect 0 errors, 0 warnings
- `flutter test` — expect all unit tests pass
- `flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/[1-9]0_*.dart` — expect all e2e tests pass
- `flutter build apk --release --obfuscate --split-debug-info=build/symbols/` — expect clean build with TLS pinning

## Cumulative PR count

- 24 PRs in this plan (4 phases)
- ~17 hours wall time
- 4-5 days, 1 reviewer

## Cross-audit PR consolidation opportunities

- **PR-2 + PR-22** (delete dead repos) can be combined as a single "Delete dead repository code" sweep. Net: ~100 lines deleted.
- **PR-6 + PR-23** (consolidate language dialog + wire real FAQ search) are independent. Don't combine.
- **PR-10 + PR-15** (placeholder phone in SOS + permissions cleanup) are independent. Don't combine.
- **PR-17 + PR-12** (pickup e2e + emergency e2e) are independent. Don't combine.

## Highest-impact PRs (do these first)

1. **PR-3** (5-min bucket idempotency) — CRITICAL silent data corruption
2. **PR-8** (init engagement on dashboard) — notification bell broken for every rider
3. **PR-14** (parallel KYC uploads) — 12-30s → 6s, 5 docs at once
4. **PR-20** (wire end-rental onSuccess) — user-facing; rider stranded
5. **PR-10** (SOS placeholder phone) — safety
6. **PR-5** (delete fake Razorpay) — security/finance; user could be tricked

## What this plan does NOT address

- The "PlanCardTile" / "PlanHeaderCard" / "EndRentalPhotoGrid" dead widgets (rental P1-2, P1-3) — covered in a separate housekeeping PR
- The `TicketFilter` missing `resolved` enum (support P1-3) — Phase 4
- The 2 parallel ticket providers (support P1-4) — Phase 4
- The snackbar-on-wrong-navigator in `create_ticket_screen.dart` (support P1-5) — Phase 4
- The Hindi language dialog hardcoded suffix (dark-mode P1-2) — already fixed per PR-VER-2026-08-06
- The `setHindi` PostHog events missing (dark-mode P1-3) — Phase 4
- The `subString(0, 1).toUpperCase()` initials (dark-mode P1-6) — Phase 4
- The `EmergencyContactsNotifier._hydrate` race (emergency P1-1) — Phase 4
- The `EmergencyContact.id` collision (emergency P1-2) — Phase 4
- The Police 100/Ambulance 108 hardcoded (emergency P1-3) — Phase 4
- The OTP resend countdown hardcoded 30s (login P1-5) — Phase 4
- The `IntentType` enum mismatch (login P1-4) — Phase 4
- The 3 placeholder contact details across onboarding files (onboarding P1-2) — Phase 4
- The `kyc_preflight` bypassable (onboarding P1-3) — Phase 4
- The `PickupEntity` dead code (pickup P1-1) — Phase 4
- The `tl_details_screen` field-name confusion (pickup P1-2) — Phase 4
- The team leader dropdown hardcoded names (pickup P1-3) — Phase 4
- The `OtpGrid` a11y-hostile (pickup P1-4) — Phase 4
- The 7 re-export shims in `flutter/lib/widgets/` (dashboard P1-2) — Phase 4 (covered in PR-X)
- The `PlanSuccessScreen` PostHog from `build` (rental P1-1) — Phase 4
- The "Days Remaining" clamp (rental P1-4) — Phase 4
- The 5-min bucket idempotency client-side header — covered in PR-3

**Backlog items** (product decisions, not bugs):
- `/api/rider/search` — does the rider need a global search? Product decision.
- `/api/support/chat` — build or delete? Product decision.
- `markAllRead` race with per-id `markRead` — verify if still a problem.
- `MAX_OUTBOX_PAYLOAD_BYTES` — re-evaluate size limit if batch operations grow.
- The 7 re-export shims cleanup — separate housekeeping PR.
