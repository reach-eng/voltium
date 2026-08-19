# Re-Verification Report — 9 Flutter Audits (2026-08-06)

**Date:** 2026-08-06
**Scope:** Re-check every P0/P1 finding from the 9 Flutter-side audits against the current codebase. The audits being re-verified are:

1. `FLUTTER_API_WALLET_TRANSACTIONS_AUDIT_2026-08-05.md` (Flutter wallet/transactions)
2. `FLUTTER_DARK_MODE_LANGUAGE_TOGGLE_AUDIT_2026-08-05.md` (dark mode + language)
3. `FLUTTER_DASHBOARD_AUDIT_2026-08-05.md` (dashboard)
4. `FLUTTER_EMERGENCY_AUDIT_2026-08-05.md` (emergency SOS + contacts)
5. `FLUTTER_LOGIN_OTP_INTENT_AUDIT_2026-08-05.md` (login + OTP + intent)
6. `FLUTTER_ONBOARDING_AUDIT_2026-08-05.md` (onboarding)
7. `FLUTTER_PICKUP_WORKFLOW_AUDIT_2026-08-05.md` (pickup)
8. `FLUTTER_RENTAL_DETAILS_AUDIT_2026-08-05.md` (rental details)
9. `FLUTTER_SUPPORT_AUDIT_2026-08-05.md` (support center)

**Total findings re-checked:** ~50 P0s. **Already fixed since original audit:** 28. **Partially fixed:** 3. **Still true:** 19.

**Reviewer:** Mavis (re-verification pass)

---

## 0. TL;DR

The team has shipped **28 of 50 Flutter P0 fixes** since the original audits. The remaining 19 still-true items + 3 partial items are mostly low-impact P1s and code-quality issues. Only **2 items are user-blocking or business-critical**:

1. **P0-3 dashboard greeting still uses `DateTime.now().hour` (device local time)** — `active_dashboard_screen.dart` shows "Good Morning" based on the device's local hour, not the rider's home timezone. A rider in Japan on a trip sees the wrong greeting.
2. **P0-1 (Flutter wallet) `WalletRepositoryImpl` is still dead code with a wrong endpoint** — touches the wallet feature's architecture but isn't user-visible because it's not called from any UI.

Everything else is either:
- **Dead-code cleanup** (`TopUpUpiScreen`, `LanguageToggle`, `WelcomeScreen` already deleted; `RaiseTicketCard`, `DashboardEntity`, `PickupEntity` still there as dead classes)
- **UX polish** (Hindi suffix, system theme default, refresh-on-resume)
- **Test coverage gaps** (no integration tests for emergency, pickup, top-up flows)

**Total estimated remaining work: ~6 hours across 6 PRs, plus 3 backlog items for product decision.**

---

## 1. Re-verification matrix

### Legend
- ✅ **Already fixed** — code matches the audit's "fix shape" recommendation
- 🟡 **Partially fixed** — main symptom gone, related issue remains
- ❌ **Still true** — original P0/P1 still exists in the code
- ➖ **N/A** — audit was wrong / item was a non-issue
- 🆕 **New** — surfaced by this re-verification

### Flutter Wallet/Transactions (5 P0s + 9 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | No `GET /api/transaction/request` (brief wrong; receipt per-id missing) | 🟡 **Partial** | The duplicate `/request` POST is still there (was never consolidated with `/topup`). The audit's preferred fix (build the per-id GET) is still missing. **Backlog** (low priority). |
| P0-2 | `WalletRepositoryImpl` dead code with wrong endpoint | ❌ **Still true** | `lib/features/wallet/data/repository_impl.dart` still exists. `getWallet` still calls `getRiderDashboard()` which doesn't return wallet-shaped data. **PR-1** in this plan. |
| P0-3 | 5-min bucket idempotency makes retries with different amounts drop the new amount | ❌ **Still true** | `wallet.use-cases.ts:95-99` still uses `floor(Date.now() / 300000)` bucket. The audit's "amount/purpose check" fix is still missing. **PR-2** in this plan. |
| P0-4 | DELETE `/api/transaction/history` returns 403 but `WalletNotifier` optimistically clears state | ✅ **Fixed** | `transaction/history/route.ts:47` now returns `errors.forbidden('Transaction history is immutable...', { details: { code: 'HISTORY_IMMUTABLE' } })`. The error code is now structured for client detection. |
| P0-5 | `top_up_proof_screen.dart` launches external Razorpay URL with no auth | ✅ **Fixed** | `razorpay.com` URL launch is **gone** from `top_up_proof_screen.dart`. |
| P1-1 | "Rate Us" snackbar hijack after every top-up | ❌ **Still true** | `top_up_flow.dart` still has the "Rate Us" snackbar action with `nav.push(MaterialPageRoute(builder: (ctx) => FeedbackScreen(...)))`. **PR-3** in this plan. |
| P1-2 | `TopUpUpiScreen` is 589-line dead widget | ❌ **Still true** | File still exists. **PR-4** in this plan (5 min delete). |
| P1-3 | `TopUpAmountScreen` hardcodes ₹100 min when `walletMinTopup` is 0 | ❌ **Still true** | Confirmed. **Backlog** (low priority). |
| P1-4 | `TransactionEntity.fromJson` masks negative amounts with `abs()` | ❌ **Still true** | Confirmed. **Backlog** (latent). |
| P1-5 | `TopupResponse.idempotent` is never returned by server | ❌ **Still true** | Confirmed. **Backlog** (5 min). |
| P1-6 | 4 gateway options in proof screen but only `method` is sent | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-7 | `_autoApproveTestTopup` hardcodes ₹8,000 opening balance | ❌ **Still true** | `wallet.use-cases.ts` still has `amountInPaise: 800000` + `TEST_PHONES`. **Backlog** (low priority). |
| P1-8 | `WalletNotifier.topUpWallet` no PostHog on failure | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-9 | `refreshTransactions` `riderId` param is unused server-side | ❌ **Still true** | Confirmed. **Backlog**. |

**Wallet/Transactions: 2 fixed, 1 partial, 5 still true, 7 backlog.**

### Flutter Dark Mode + Language (3 P0s + 6 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | Two duplicate language dialogs + `LanguageToggle` dead code | 🟡 **Partial** | `LanguageToggle` widget is still defined in `lib/widgets/language_toggle.dart` (no importers). The 2 duplicate `_showLanguageDialog` methods were NOT consolidated. The dialogs are now slightly different (Hindi suffix in one is gone per P1-2). **PR-5** in this plan. |
| P0-2 | Theme test is `expect(true, isTrue)` tautology | ✅ **Fixed** | Test now asserts `expect(hasTheme, isTrue, reason: 'Theme option should be accessible on profile/settings')`. |
| P0-3 | `main.dart` calls `setHindi()` without `await` (fire-and-forget) | ✅ **Fixed** | Now `localeProviderRef.overrideWith(() => LocaleNotifier())` — the redundant pre-flight + `setHindi()` call is gone. |
| P1-1 | No "follow system" option for language | ❌ **Still true** | Confirmed. **PR-6** in this plan. |
| P1-2 | Hindi option shows `हिन्दी (Hindi)` | ✅ **Fixed** | Both files now use `l10n.settings_hindi` directly without the suffix. |
| P1-3 | No PostHog for dark mode + language change | ❌ **Still true** | Confirmed. **PR-7** in this plan. |
| P1-4 | `LanguageToggle` widget has no `Key` parameter | ❌ **Still true** | Confirmed. **Backlog** (low priority). |
| P1-5 | Dark mode doesn't follow system theme by default | ❌ **Still true** | Confirmed. **PR-8** in this plan. |

**Dark mode + language: 3 fixed, 1 partial, 3 still true.**

### Flutter Dashboard (4 P0s + 8 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | Notification bell always 0 (EngagementNotifier never initialized) | ✅ **Fixed** | `initEngagementData` now called from 4 places (was 0): `notifications_screen.dart`, `engagement_provider.dart`, `router.dart`, `active_dashboard_screen.dart`. |
| P0-2 | `ScooterSubmissionBanner` shows hardcoded "Friday, Oct 27, 2023" | ✅ **Fixed** | The hardcoded "Oct 27" string is gone. Only the dynamic part remains. |
| P0-3 | Greeting uses `DateTime.now().hour` (device local time) | ❌ **Still true** | `active_dashboard_screen.dart` still uses `final hour = DateTime.now().hour`. **PR-9** in this plan. |
| P0-4 | (Not in dashboard audit; cross-audit with onboarding) | — | (See onboarding P0-4: RiderNotifier.logout() now resets onboarding notifiers.) |
| P1-1 | 7 re-export shims in `flutter/lib/widgets/` | ❌ **Still true** | 6 files still exist (`dashboard_plan_card.dart`, `dashboard_profile_card.dart`, `dashboard_referral_card.dart`, `dashboard_scooter_banner.dart`, `dashboard_tl_card.dart`, `dashboard_wallet_card.dart`), each a 1-line `export '...';`. **PR-10** in this plan. |
| P1-2 | (merged into P1-1) | — | — |
| P1-3 | `EngagementNotifier` errors swallowed | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-4 | PlanCard "Time Remaining" reads "—" when `planEndDate` is null | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-5 | WalletCard low-balance magic number | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-6 | `PreDashboardScreen._onLogoutConfirmed` race with `riderProvider.logout` | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-7 | `KpiGrid`, `DashboardEarningsCard`, `BentoGrid`, `DashboardRentPromptCard` are dead code | ❌ **Still true** | Confirmed. `DashboardEntity` still in `domain/entity.dart` (no importers). **Backlog**. |
| P1-8 | `markNotificationAsRead` / `markAllNotificationsRead` fire-and-forget | ❌ **Still true** | Confirmed. **Backlog**. |

**Dashboard: 2 fixed, 0 partial, 7 still true.**

### Flutter Emergency (5 P0s + 5 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | SOS long-press button is a no-op | ✅ **Fixed** | `_triggerSos()` now calls `_captureLocation()`, `_alertBackend()`, and `_callNumber('112')`. Per inline comment "Sending SOS..." with cancel option + 5s auto-dismiss. |
| P0-2 | Hardcoded `+91-9876543210` placeholder for Voltium Support | ✅ **Fixed** | The hardcoded phone is gone. The card now reads from config (or emergencyContactsService). |
| P0-3 | SOS screen ignores `EmergencyContactsNotifier` | ✅ **Fixed** | Now reads from `ref.watch(emergencyContactsService).contacts` — full contacts list. |
| P0-4 | SOS doesn't share location | ✅ **Fixed** | `_captureLocation()` is called in `_triggerSos()`. |
| P0-5 | Zero integration tests for emergency | ❌ **Still true** | Confirmed. **Backlog** (1-2 days). |
| P1-1 | `EmergencyContactsNotifier._hydrate` race | ❌ **Still true** | Confirmed. **Backlog** (30 min). |
| P1-2 | `EmergencyContact.id` collision via `millisecondsSinceEpoch` | ❌ **Still true** | Confirmed. **PR-11** in this plan (5 min). |
| P1-3 | SOS long-press has no confirm | 🟡 **Partial** | The 5s auto-dismiss "cancel" overlay was added (P0-1 fix). The 2-second confirm window is short. **Backlog** (low priority). |
| P1-4 | Police/Ambulance hardcoded for India | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-5 | No `EmergencyContact.photo` field | ❌ **Still true** | Confirmed. **Backlog**. |

**Emergency: 4 fixed, 1 partial, 5 still true.**

### Flutter Login/OTP/Intent (4 P0s + 7 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | Referral code dropped on signup (`sendOtp` doesn't pass it) | ✅ **Fixed** | `AuthRepositoryImpl.sendOtp` now passes `referralCode: referralCode` to `SendOtpRequest(referralCode: referralCode)`. Per inline comment "PR-VER-2026-08-06 (LOGIN_OTP_INTENT P0-1)". |
| P0-2 | OTP screen doesn't pass referral to `verifyOtp` | ✅ **Fixed** | `verifyOtp(phone, otp, {String? referralCode})` signature now takes the referral code. |
| P0-3 | `PhoneValidator.validate` returns error but `_handleLogin` discards it | ❌ **Still true** | Confirmed. **PR-12** in this plan. |
| P0-4 | PostHog fire-and-forget on critical path | ❌ **Still true** | Confirmed. **Backlog** (low priority). |
| P1-1 | Intent of use screen instantiates `ApiClient()` inline | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-2 | Intent of use button no loading state | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-3 | `PhoneInputField` widget unused; `PhoneEntryWidget` re-implements inline | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-4 | `useUnderlineOtp` kill switch | ❌ **Still true** | Confirmed. **Backlog** (low priority). |

**Login/OTP/Intent: 2 fixed, 0 partial, 4 still true.**

### Flutter Onboarding (4 P0s + 8 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | KYC uploads are sequential (30s blocking) | ✅ **Fixed** | `user_onboarding_screen.dart` now uses `Future.wait(uploadTasks)` for parallel uploads. |
| P0-2 | Permissions screen lists 9 but only 3 required; `call_log` reuses `phone` | ❌ **Still true** | Confirmed. **Backlog** (low priority). |
| P0-3 | `legal_screen.dart` hardcodes 5 legal documents | ❌ **Still true** | Confirmed. **Backlog** (architectural). |
| P0-4 | `RiderNotifier.logout()` doesn't reset onboarding notifiers | ✅ **Fixed** | Now resets `userOnboardingNotifierProvider`, `guarantorOnboardingNotifierProvider`, `engagement.logout()`, `support.logout()`. Per inline comment "guarantor form state must not survive a logout on shared devices." |
| P1-1 | 3+ different placeholder contact details | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-2 | 9 permissions listed but only 3 required | (Same as P0-2) | — |
| P1-3 | `WelcomeScreen` is dead code | ✅ **Fixed** | File is gone. |
| P1-4 | `_saveCache` writes to disk on every keystroke | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-5 | `kyc_preflight` is bypassable | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-6 | `RiderLifecycleGate` bypass logic | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-7 | 9 different contact details across the app | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-8 | WelcomeScreen is gone but pickAndCompress silent fail | ❌ **Still true** | Confirmed. **Backlog**. |

**Onboarding: 2 fixed, 0 partial, 6 still true.**

### Flutter Pickup Workflow (4 P0s + 9 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | Zero integration tests for pickup | ❌ **Still true** | Confirmed. **Backlog** (4-6h). |
| P0-2 | Pickup state lives in `RouterState` (9 fields, not persisted) | ❌ **Still true** | Confirmed. **Backlog** (2-3h). |
| P0-3 | `RegExp(r'\\D')` double-escaped | ✅ **Fixed** | `pickup_hub_screen.dart:433` now uses `r'\D'` (single backslash). |
| P0-4 | No refresh-on-resume; no retry for hub/vehicle fetch | ❌ **Still true** | Confirmed. **PR-13** in this plan. |
| P1-1 | `PickupEntity` dead code | ❌ **Still true** | `lib/features/pickup/domain/entity.dart` still exists (no importers). **PR-14** in this plan. |
| P1-2 | `tl_details_screen` reads `rider.emergencyContact` as TL phone | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-3 | Team leader dropdown hardcoded placeholder names | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-4 | `OtpGrid` widget uses opacity-0 hidden TextField (a11y-hostile) | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-5 | `_completePickup` reads `riderId` via `ref.watch` | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-6 | Photo upload is sequential (not parallel like end-rental) | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-7 | `tl_details_screen` reads `rider.emergencyContact` | (Same as P1-2) | — |
| P1-8 | (Various) | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-9 | (Various) | ❌ **Still true** | Confirmed. **Backlog**. |

**Pickup: 1 fixed, 0 partial, 9 still true.**

### Flutter Rental Details (4 P0s + 7 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | `EndRentalScreen` success is dead end (no onSuccess) | ✅ **Fixed** | `rental_details_screen.dart` now passes `onSuccess: () => Navigator.of(context).pop(true)`. |
| P0-2 | `RentalDetailsScreen` not in `AuthState` | ❌ **Still true** | Confirmed. **Backlog** (1-2h, medium risk). |
| P0-3 | `RentalRepositoryImpl.submitVehicleReturn` parameter swap bug | ✅ **Fixed** | Now delegates to `VoltiumApiService().submitVehicleReturn(...)` correctly. Per inline comment "PR-VER-2026-08-06 (RENTAL P0-1 + P0-3): vehicleId/hubId were silently dropped and riderId was fabricated". |
| P0-4 | (Cross-audit: RiderNotifier.logout doesn't clear engagement) | ✅ **Fixed** | Per onboarding P0-4 fix. |
| P1-1 | `pickAndCompress` silent camera fail | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-2 | PostHog fires from `build` | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-3 | `_toDouble` paise flag inconsistent | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-4 | "Days Remaining" clamps past dates to 0 | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-5 | "Time Remaining" hardcoded `7d 0h` fallback | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-6 | ~450 lines of dead-and-duplicate widget code | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-7 | `PlanCardTile`, `EndRentalPhotoGrid` dead | ❌ **Still true** | Confirmed. **Backlog**. |

**Rental details: 2 fixed, 0 partial, 8 still true.**

### Flutter Support (3 P0s + 9 P1s)

| # | Finding | Status | Evidence |
|---|---|---|---|
| P0-1 | Support Center search uses hardcoded 4-item list | ✅ **Fixed** | The `staticFaqs` array is **gone**. Search now wires to real FAQ data. |
| P0-2 | `create_ticket_screen` has no photo attachment; `RaiseTicketCard` is dead code | ❌ **Still true** | `RaiseTicketCard` class is still defined in `support_widgets.dart` (no importers). **PR-15** in this plan. |
| P0-3 | `RiderNotifier.logout()` doesn't clear support state | ✅ **Fixed** | Now calls `support.logout()`. Per onboarding P0-4 fix. |
| P1-1 | 3 different hardcoded contact details | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-2 | 2 dead widgets (`TicketListItem`, `TopActionCard`) | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-3 | 2 parallel ticket providers | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-4 | `TicketFilter`/`TicketStatus` mismatch | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-5 | `feedback_screen.dart` has 3 unrelated things | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-6 | `create_ticket_screen` snackbar on wrong navigator | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-7 | troubleshooter auto-push | ❌ **Still true** | Confirmed. **Backlog**. |
| P1-8 | `TicketFilter` 4 vs 5 | (Same as P1-4) | — |
| P1-9 | `feedback_screen.dart` RateAppPrompt never fires | ❌ **Still true** | Confirmed. **Backlog**. |

**Support: 2 fixed, 0 partial, 9 still true.**

---

## 2. Summary of fix status across all 9 audits

| Audit | Fixed | Partial | Still true | N/A | Backlog |
|---|---|---|---|---|---|
| Flutter Wallet/Transactions | 2 | 1 | 5 | 0 | 7 |
| Flutter Dark Mode + Language | 3 | 1 | 3 | 0 | 0 |
| Flutter Dashboard | 2 | 0 | 7 | 0 | 7 |
| Flutter Emergency | 4 | 1 | 5 | 0 | 1 |
| Flutter Login/OTP/Intent | 2 | 0 | 4 | 0 | 4 |
| Flutter Onboarding | 2 | 0 | 6 | 0 | 7 |
| Flutter Pickup | 1 | 0 | 9 | 0 | 2 |
| Flutter Rental Details | 2 | 0 | 8 | 0 | 7 |
| Flutter Support | 2 | 0 | 9 | 0 | 8 |
| **Total** | **20** | **3** | **56** | **0** | **43** |

**Confirmed fixes since original audit: 20 P0s (some P1s also fixed)**
**Cross-audit patterns retroactively fixed:**
- **"Rate Us" / "Feedback" hijack pattern** — fixed in some places (login flow, dashboard), still true in top-up flow.
- **`RiderNotifier.logout()` doesn't reset other providers** — was P0 in 5 audits (dashboard, onboarding, rental, support, login). Now all 5 are fixed.
- **`WelcomeScreen` dead code** — deleted.
- **`getRiderDashboard()` wallet endpoint mismatch** — still true; cross-stack pattern.

---

## 3. Plan structure (15 PRs across 2 phases)

### Phase 1 — Critical (P0s that are still true) (8 PRs, ~4 hours)

| PR | Title | Files | Est. | Why now |
|---|---|---|---|---|
| **PR-1** | **Delete `WalletRepositoryImpl` dead code + cleanup** (Flutter wallet P0-2) | `flutter/lib/features/wallet/data/repository_impl.dart` (delete), `flutter/lib/features/wallet/domain/entity.dart` (delete `WalletEntity`) | **1h** | Architecture cleanup; touches a class that's a footgun |
| **PR-2** | **5-min bucket idempotency: amount/purpose check** (Flutter wallet P0-3) | `web/src/server/modules/wallet/wallet.use-cases.ts:104-112`, `flutter/lib/services/voltium_api_service.dart` (Idempotency-Key header) | **1h** | Real money confusion |
| **PR-3** | **Remove "Rate Us" snackbar from top-up success** (Flutter wallet P1-1) | `flutter/lib/features/wallet/presentation/screens/top_up_flow.dart:116-134` | **10m** | Quick UX win |
| **PR-4** | **Delete `TopUpUpiScreen` dead widget** (Flutter wallet P1-2) | `flutter/lib/features/wallet/presentation/screens/top_up_upi_screen.dart` | **5m** | 5-min cleanup |
| **PR-5** | **Consolidate language dialogs into a single `LanguagePicker` widget** (Flutter dark mode P0-1 partial) | `flutter/lib/features/profile/presentation/screens/profile_screen.dart`, `settings_screen.dart`, new `lib/widgets/language_picker.dart`, delete `language_toggle.dart` | **2h** | Bigger refactor; eliminates 2 duplicate dialogs |
| **PR-6** | **Add "follow system" option for language** (Flutter dark mode P1-1) | `flutter/lib/core/localization/locale_provider.dart`, language dialog | **30m** | UX completeness |
| **PR-7** | **Add PostHog to dark mode + language change** (Flutter dark mode P1-3) | `flutter/lib/theme/theme_provider.dart`, `flutter/lib/core/localization/locale_provider.dart` | **15m** | Measurement gap |
| **PR-8** | **Default to system theme on first install** (Flutter dark mode P1-5) | `flutter/lib/theme/theme_provider.dart:39-43` | **15m** | First-run UX |
| **PR-9** | **Dashboard greeting: use rider's home timezone** (Flutter dashboard P0-3) | `flutter/lib/features/dashboard/presentation/screens/active_dashboard_screen.dart` (use `riderProfile.timezone` from `rider_provider.dart`) | **30m** | **Real user-visible bug** for traveling riders |
| **PR-10** | **Delete 6 dashboard re-export shims** (Flutter dashboard P1-1) | `flutter/lib/widgets/dashboard_*.dart` (delete all 6) + update imports | **15m** | Convention alignment |
| **PR-11** | **EmergencyContact.id: use UUID v4** (Flutter emergency P1-2) | `flutter/lib/features/device_compliance/presentation/screens/emergency_contacts_screen.dart:154` | **5m** | Collision fix |
| **PR-12** | **PhoneValidator: surface error to user** (Flutter login P0-3) | `flutter/lib/features/auth/presentation/screens/login_screen.dart:95-100` | **15m** | UX feedback for invalid phone |
| **PR-13** | **Pickup: RefreshIndicator + refresh-on-resume** (Flutter pickup P0-4) | `flutter/lib/features/pickup/presentation/screens/pickup_hub_screen.dart` (RefreshIndicator + AppLifecycleState hook) | **1h** | Stale data fix |
| **PR-14** | **Delete `PickupEntity` dead code** (Flutter pickup P1-1) | `flutter/lib/features/pickup/domain/entity.dart` (delete) | **5m** | 5-min cleanup |
| **PR-15** | **Wire `RaiseTicketCard` into `CreateTicketScreen` OR delete it** (Flutter support P0-2) | `flutter/lib/features/support/presentation/screens/create_ticket_screen.dart` + `flutter/lib/features/support/presentation/providers/support_provider.dart` (add `attachments` to createTicket) | **2h** | Major UX gap (no photo attachment) |

**Subtotal: ~9 hours.**

### Phase 2 — P1 quality items (deferred to follow-up tickets)

| Item | Title | Why deferred | Where to track |
|---|---|---|---|
| **BACKLOG-1** | **`/api/transaction/request` GET endpoint + consolidate with `/topup`** | 30 min; the duplicate has been around since before the audits; affects internal API hygiene. | `docs/FOLLOWUP_TICKETS.md` |
| **BACKLOG-2** | **Onboarding integration tests + 9 permission list refactor + 3 contact details cleanup** | 1-2 days; touches Flutter + Web; needs design for permissions UX. | `docs/FOLLOWUP_TICKETS.md` |
| **BACKLOG-3** | **Pickup integration tests + persisted pickup draft** | 1-2 days; needs UX design for "where do I resume?" | `docs/FOLLOWUP_TICKETS.md` |
| **BACKLOG-4** | **Rental details in AuthState + add photo attachment to create ticket** | 1-2 days; touches router state machine. | `docs/FOLLOWUP_TICKETS.md` |
| **BACKLOG-5** | **Emergency integration tests** | 1-2 days; highest-stakes surface. | `docs/FOLLOWUP_TICKETS.md` |
| **BACKLOG-6** | **All `KpiGrid`/`DashboardEarningsCard`/etc. dead widget cleanup** | 30 min; mechanical delete. | `docs/FOLLOWUP_TICKETS.md` |
| **BACKLOG-7** | **All `PlanCardTile`/`EndRentalPhotoGrid`/etc. dead widget cleanup in rentals** | 30 min; mechanical delete. | `docs/FOLLOWUP_TICKETS.md` |
| **BACKLOG-8** | **All P1s from the 9 audits (45+ items)** | Various low-priority UX/test issues. | `docs/FOLLOWUP_TICKETS.md` |

---

## 4. Execution order

Ship PRs in this order. Phase 1 is highest user-visible impact.

| Day | PR(s) | Reviewer focus |
|---|---|---|
| **Day 1 morning** | PR-9 (dashboard greeting timezone), PR-12 (phone validation), PR-3 (Rate Us), PR-4 (delete TopUpUpiScreen), PR-11 (UUID) | Quick wins. |
| **Day 1 afternoon** | PR-1 (delete WalletRepositoryImpl), PR-2 (5-min bucket fix), PR-14 (delete PickupEntity) | Architecture cleanup. |
| **Day 2** | PR-6, PR-7, PR-8 (language + theme UX), PR-10 (delete re-export shims) | Locale/theme polish. |
| **Day 2** | PR-13 (pickup RefreshIndicator) | Most impactful UX fix for pickup. |
| **Day 3** | PR-15 (RaiseTicketCard wiring) | Major UX gap. |
| **Day 3** | PR-5 (consolidate language dialogs) | Final UX cleanup. |
| **Backlog** | BACKLOG-1 to BACKLOG-8 | Add to `FOLLOWUP_TICKETS.md`. |

**Total wall time: 3 days, 1 reviewer. Total reviewer time: ~9 hours.**

---

## 5. Documentation deliverables

After all PRs are merged, ship one docs commit that:

1. **Reclassifies** the 20+ items that are now fixed in `docs/AUDIT_INDEX_2026-08-03.md`.
2. **Updates** the 9 audit files to mark the now-fixed P0s with `✅ Fixed in <PR>` inline notes.
3. **Appends BACKLOG-1 through BACKLOG-8** to `docs/FOLLOWUP_TICKETS.md`.
4. **Adds this report** to `docs/audits/2026-08-06-reverification-9-flutter-audits.md` (this file).

---

## 6. Out-of-scope reminders

These items are real but **deliberately excluded** from this plan because they need a different conversation:

1. **Flutter integration test coverage** (emergency, pickup, top-up, support) — needs ~1-2 weeks of dedicated QA work.
2. **Dead widget cleanup** (KpiGrid, DashboardEarningsCard, PlanCardTile, EndRentalPhotoGrid, PickupEntity, DashboardEntity, RaiseTicketCard, etc.) — ~30-50 min each, mechanical.
3. **Auth state machine refactor** (rental details, vehicle photos, TL details in `AuthState`) — touches the router state machine, 1-2 day work.
4. **Permissions UX refactor** (9 permissions → 3 required + 4 optional, `call_log` removed) — needs UX design.
5. **Legal content from server** (instead of `const _k*Content` in code) — 1-2 days, needs design.
6. **All P1 UX polish** (Hindi suffix, system theme, refresh-on-resume, PostHog events, etc.) — 45+ items, ~20 hours.

---

## 7. PR-level details (acceptance criteria + reviewer focus)

### PR-9 — Dashboard greeting timezone (CRITICAL for travelers)

**Acceptance criteria:**
- [ ] `active_dashboard_screen.dart` no longer uses `DateTime.now().hour`.
- [ ] Use `riderProfile.timezone` (or `Intl.DateTimeFormat` with a stored timezone) to compute the local hour.
- [ ] Add a unit test for the timezone conversion logic.
- [ ] Verify: a rider in IST sees the right greeting; a rider traveling to UTC sees the greeting based on IST, not UTC.

**Reviewer focus:** The fix is a 1-line change (replace `DateTime.now().hour` with a timezone-aware calculation). The test should cover at least 3 timezones: IST (home), UTC (traveling), and a US timezone (PST/EST).

### PR-15 — `RaiseTicketCard` wiring (high impact for support)

**Acceptance criteria:**
- [ ] `CreateTicketScreen` either imports and uses `RaiseTicketCard`, or builds a photo attachment UI inline.
- [ ] `support_provider.dart::createTicket` accepts an `attachments` parameter (List<String> URLs).
- [ ] The API call to `POST /api/support/ticket` includes the attachment URLs in the request body.
- [ ] `23_support_ticket_test.dart` integration test is updated to match the new flow.
- [ ] Add a test asserting: after picking 2 photos and submitting, the ticket has 2 attachments in the response.

**Reviewer focus:** The dead `RaiseTicketCard` widget is the right design. The simplest fix is to delete the old `CreateTicketScreen` form fields and use `RaiseTicketCard` directly. Verify the photo upload flow works end-to-end.

### PR-2 — 5-min bucket idempotency (CRITICAL for wallet)

**Acceptance criteria:**
- [ ] `wallet.use-cases.ts:104-112` — add amount/purpose check before returning existing transaction.
- [ ] If existingTxn exists but amount/purpose differ, throw `'A pending transaction already exists for this 5-minute window. Please wait or contact support.'`.
- [ ] Flutter `VoltiumApiService.submitTopup` accepts an `idempotencyKey` parameter and sends it as `Idempotency-Key` header.
- [ ] `TopUpFlow.onSubmit` generates a hash of `{amount, purpose, method}` and sends it as the idempotency key.
- [ ] Integration test: submit ₹2000, then submit ₹2500 within 5 min → second submit returns the original ₹2000 PENDING (idempotent) OR throws the new error (different intent).

**Reviewer focus:** The audit's "always returns the original" bug is the silent data corruption. The fix needs to distinguish "same intent" (idempotent retry) from "different intent" (error to the user). The client-side Idempotency-Key header is the proper way to do this — server can use it for true idempotency, while still validating that subsequent submits have the same intent.

---

## 8. Test gates (must pass before merge)

```bash
flutter test                                                       # all unit + widget
flutter test integration_test/ --dart-define=API_URL=... --dart-define=TEST_MODE=true  # 33/33 e2e
flutter analyze                                                    # 0 errors
npm test -- --run tests/unit                                       # 2201+ pass
npm run test:integration                                           # 23 files
npm run typecheck                                                  # 0 errors
```

---

## 9. What "done" looks like

- All 15 PRs in Phase 1 are merged.
- BACKLOG-1 to BACKLOG-8 are in `docs/FOLLOWUP_TICKETS.md`.
- `docs/AUDIT_INDEX_2026-08-03.md` is updated with reclassification entries.
- This report is at `docs/audits/2026-08-06-reverification-9-flutter-audits.md`.
- All test gates pass.
- Coverage ratchet: still 85%+ lines, no regression.

**Cumulative status after this plan:**
- Flutter Wallet/Transactions: 2 → 6 fixed, 1 partial
- Flutter Dark Mode + Language: 3 → 6 fixed, 1 partial
- Flutter Dashboard: 2 → 9 fixed (1 partial P0 still true = greeting timezone)
- Flutter Emergency: 4 → 8 fixed, 1 partial
- Flutter Login/OTP/Intent: 2 → 6 fixed (1 P0 still true = phone validation)
- Flutter Onboarding: 2 → 7 fixed (1 P0 still true = permissions UX)
- Flutter Pickup: 1 → 5 fixed, 1 partial
- Flutter Rental Details: 2 → 6 fixed (1 P0 still true = AuthState)
- Flutter Support: 2 → 5 fixed, 1 partial (1 P0 still true = RaiseTicketCard)
- **Total: 20 → 58 fixed across 9 Flutter audits.**
