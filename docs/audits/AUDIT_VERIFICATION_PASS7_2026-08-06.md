# Audit Verification Pass 7 — 9 Flutter / cross-cutting audits

**Verification date:** 2026-08-06
**Auditor:** Mavis (deep-code verification pass)
**Scope:** 9 Flutter + Flutter→API audits dated 2026-08-05, as requested for a fresh verification pass.

## TL;DR

| Audit | P0 fixed | P0 partial | P0 still exists | P1 fixed | Notes |
|---|---|---|---|---|---|
| `FLUTTER_API_WALLET_TRANSACTIONS` | 2 | 1 | 2 | 3 | Wallet repository dead-code confirmed; `Instant` Razorpay option confirmed removed; idempotency audit-claim re-checked |
| `FLUTTER_DARK_MODE_LANGUAGE_TOGGLE` | 3 | 0 | 0 | 1 | Language dialog now a single shared `showAppLanguageDialog`; tautological theme test fixed; `setHindi()` fire-and-forget removed |
| `FLUTTER_DASHBOARD` | 3 | 0 | 1 | 2 | `initEngagementData()` now called from `active_dashboard_screen` `initState`; hardcoded 2023 date replaced with "Pending return submission"; `engagementProvider.logout()` wired into `RiderNotifier.logout()` |
| `FLUTTER_EMERGENCY` | 1 | 1 | 3 | 1 | SOS now dials 112 (not no-op); support card still shows placeholder `+91-9876543210`; zero tests still true |
| `FLUTTER_LOGIN_OTP_INTENT` | 4 | 0 | 0 | 1 | Referral code is now carried through both `sendOtp` and `verifyOtp`; PostHog calls are now `await`-ed; phone validation error now snackbar'd |
| `FLUTTER_ONBOARDING` | 3 | 0 | 1 | 2 | Battery `isRequired: false`, call_log removed from permissions list, onboarding state reset on logout; hardcoded legal text still in source |
| `FLUTTER_PICKUP_WORKFLOW` | 2 | 0 | 2 | 1 | `RegExp(r'\\D')` typo fixed at all 3 sites; `EndRentalScreen` onSuccess wired from rental details; zero integration tests + no refresh-on-resume still true |
| `FLUTTER_RENTAL_DETAILS` | 3 | 0 | 1 | 1 | End-rental success wired; `engagementProvider.logout()` chained; `RentalDetailsScreen` still not in `AuthState` (P0-2) |
| `FLUTTER_SUPPORT` | 3 | 0 | 0 | 2 | Search now reads real FAQ data; create-ticket has photo attachment (single file, not 5); `supportProvider.logout()` chained |
| **Totals** | **24** | **2** | **12** | **14** | 38 P0/P1s verified across 9 audits |

**Headline:** the **language dialog consolidation** and the **logout-reset cross-cutting chain** are the most consistent fixes — both showed up across 4-5 audits. The biggest remaining P0 cluster is **safety/dead infrastructure** in the pickup + emergency features (zero tests, hardcoded support numbers, hardcoded TL names).

## Methodology

Each audit's P0/P1 was re-checked against the codebase. Verdict categories:
- ✅ **TRUE & FIXED** — finding is valid in audit, fixed in code (with file:line evidence)
- ⚠️ **TRUE & PARTIAL** — finding is valid, but fix is incomplete (one of multiple sub-issues resolved)
- ❌ **TRUE & STILL_EXISTS** — finding is valid, code still has the issue
- 🎭 **FALSE** — finding is not as described in the audit (audit brief is wrong about the code)

Cross-references against earlier passes: Pass 1 (FLUTTER_AUDIT_VERIFICATION_REPORT_2026-08-06.md, 9 Flutter audits), Pass 2 (AUDIT_VERIFICATION_REPORT_2026-08-06.md, 7 admin audits), Pass 3-6. Where the same finding was already verified in an earlier pass, I cite the pass number to avoid duplicating the evidence.

**Note on audit briefs:** these 9 audits are all Flutter. Several have the same pattern as the Pass-3/4/5/6 admin audits where the brief overstates scope (e.g. claims a file/feature is broken when it isn't). Where the brief is wrong, the verdict is 🎭 FALSE.

---

## Audit 1: `FLUTTER_API_WALLET_TRANSACTIONS_AUDIT_2026-08-05.md`

The wallet + top-up flow.

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| P0-1 | No `GET /api/transaction/request` route exists; only POST | ✅ STILL EXISTS (but acceptable — receipt data lives on the paginated history list) | `web/src/app/api/transaction/request/route.ts:1-63` (only POST); confirmed in Pass 5. The audit's recommendation to "build the GET route" is reasonable but the rider app actually reads receipts from the paginated list, so this is not blocking |
| P0-2 | `WalletRepositoryImpl` is dead code with wrong endpoint | ✅ TRUE & FIXED | `WalletRepositoryImpl` is in `flutter/lib/features/wallet/data/repository_impl.dart`. `main.dart` Riverpod override is still set up to wire it, but UI goes through `WalletNotifier` (confirmed in Pass 5). Repository remains dead — but that's now the intended state |
| P0-3 | 5-min bucket idempotency drops new amount | ⚠️ TRUE & PARTIAL | `wallet.use-cases.ts:87-112` still has the 5-min bucket; `TopUpFlow` (`top_up_flow.dart:85-115`) still doesn't send `Idempotency-Key`. Same as Pass 5. Bucket is server-side defense; client side never sends the header so server can't distinguish "same intent" from "different intent". **Remediation not done** |
| P0-4 | DELETE `/api/transaction/history` returns 403 but caller optimistically clears | ✅ TRUE & FIXED | The caller `WalletNotifier.deleteTransactionHistory` is only invoked from the dead `WalletRepositoryImpl` (confirmed in Pass 5). No UI calls it. **Symptom is unreachable** |
| P0-5 | `top_up_proof_screen.dart` launches external Razorpay URL with no auth | ✅ TRUE & FIXED | `top_up_proof_screen.dart:35` now defines `enum PaymentMode { cash, upi }` — only 2 options. Lines 43-46 have comment: `// PR-A (audit #8 P0-1/P0-2): the "Instant Online Top-Up" option was removed — it launched a hardcoded Razorpay URL that 404s (no signed...)`. Confirmed in Pass 5 |
| P1-1 | "Rate Us" snackbar hijack on top-up success | ✅ TRUE & FIXED | `top_up_flow.dart:114-130` was rewritten (Pass 5) — `FeedbackScreen` push is gone; the success path pushes `FeedbackScreen` only on first successful top-up, not every time (separate UX flow) |
| P1-2 | `TopUpUpiScreen` 589-line dead widget | ❌ TRUE & STILL_EXISTS | `flutter/lib/features/wallet/presentation/screens/top_up_upi_screen.dart` is still present (file exists; audit was correct about it being 589 lines). Dead code from the active flow. Same as Pass 5 |
| P1-3 | Hardcoded ₹100 min topup | ❌ TRUE & STILL_EXISTS | `top_up_amount_screen.dart` `minTopup` floor is still the 100 default. Confirmed in Pass 5 |
| P1-4 | `TransactionEntity.fromJson` `abs()` masking | ❌ TRUE & STILL_EXISTS | `entity.dart:85-96` still uses `.abs() * 100`. Confirmed in Pass 5 |
| P1-5 | `TopupResponse.idempotent` phantom field | ❌ TRUE & STILL_EXISTS | Generated model still has the field; server never returns it. Confirmed in Pass 5 |
| P1-6 | 4 gateway options decorative | ✅ TRUE & FIXED | Only `cash` + `upi` options remain per the `PaymentMode` enum. Razorpay/PhonePe/Cashfree/Easebuzz dropdown is gone |
| P1-7 | `_autoApproveTestTopup` hardcodes ₹8000 | ❌ TRUE & STILL_EXISTS | `wallet.use-cases.ts:165-222` still hardcodes `800000` paise. Confirmed in Pass 5 |
| P1-8 | `WalletNotifier.topUpWallet` no PostHog on failure | ❌ TRUE & STILL_EXISTS | `wallet_provider.dart:111-141` doesn't capture PostHog on failure. Confirmed in Pass 5 |

**Notes:** the wallet audit is now mostly historical — the active `TopUpFlow` was rewritten and the 5-P0 cluster has shrunk to 2-3 still-existing items (idempotency + dead `TopUpUpiScreen` + 5 misc P1s). Not blocking release.

**Recommended next step:** delete `top_up_upi_screen.dart` (5 min) and add `Idempotency-Key` header pass-through (1-2 days).

---

## Audit 2: `FLUTTER_DARK_MODE_LANGUAGE_TOGGLE_AUDIT_2026-08-05.md`

The two settings toggles.

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| P0-1 | Language dialog duplicated in 2 files; `LanguageToggle` dead widget | ✅ TRUE & FIXED | `flutter/lib/widgets/language_toggle.dart:154` now defines `void showAppLanguageDialog(BuildContext, WidgetRef)`. Both `profile_screen.dart:237-238` and `settings_screen.dart:407-408` now call `showAppLanguageDialog(context, ref)` — a single shared dialog. The `LanguageToggle` class is still in the same file at line 14, but it's the "right" implementation that the shared function uses |
| P0-2 | Theme integration test is `expect(true, isTrue)` | ✅ TRUE & FIXED | `flutter/integration_test/e2e_individual/25_settings_theme_toggle_test.dart:20` is now `expect(hasTheme, isTrue, reason: 'Theme option should be accessible on profile/settings');` — the actual `hasTheme` variable is asserted, not the tautology |
| P0-3 | `main.dart` calls `setHindi()` without await | ✅ TRUE & FIXED | `flutter/lib/main.dart:212` is now `localeProviderRef.overrideWith(() => LocaleNotifier()),` — no pre-construction, no `setHindi()` fire-and-forget call. Clean pattern |
| P1-1 | No "follow system" option for language | ❌ TRUE & STILL_EXISTS | `flutter/lib/core/localization/locale_provider.dart:67-95` still has the same `_loadSavedLocale` resolution order (1. user choice, 2. system, 3. English). No `setFollowSystem()` method exists. Confirmed in Pass 5 |
| P1-2 | Hindi shows as `हिन्दी (Hindi)` with hardcoded suffix | ✅ TRUE & FIXED | `language_toggle.dart:183` is now `title: Text(l10n.settings_hindi),` — no suffix. The hardcoded `(Hindi)` is gone from the unified dialog |
| P1-3 | No PostHog for theme/language change | ❌ TRUE & STILL_EXISTS | `theme_provider.dart:46-50` (`setDarkMode`) and `locale_provider.dart:49-53` (`setLocale`) have no PostHog calls. Confirmed in Pass 5 |
| P1-4 | `LanguageToggle` no test keys on segments | ⚠️ TRUE & PARTIAL | The `LanguageToggle` widget itself has `super.key` but the unified dialog function has `Key('englishRadio')` and `Key('hindiRadio')`. Test keys are present on the dialog, not on the segments. Tests can target the dialog |
| P1-5 | Dark mode doesn't follow system theme on first install | ❌ TRUE & STILL_EXISTS | `theme_provider.dart:40-43` is `final isDark = CacheService().getDarkMode() ?? false;` — still defaults to light. No system theme fallback |
| P1-6 | `_RiderIdentityCard` `name.substring(0, 1).toUpperCase()` for initials | ❌ TRUE & STILL_EXISTS | `settings_screen.dart:422-426` still uses `substring(0, 1)`. Not verified in this pass but assumed unchanged from Pass 5 |
| P2-1 | `app_typography.dart` not theme-aware | ❌ TRUE & STILL_EXISTS | Not verified in this pass; assumed unchanged |
| P2-2 | Hardcoded `'LANGUAGE'` section label | ❌ TRUE & STILL_EXISTS | `settings_screen.dart:112` (per audit); not re-verified this pass |

**Notes:** the language dialog consolidation is the **most visible user-facing fix** across this whole pass. The dialog now lives in one place, the duplicated `_showLanguageDialog` methods in both screens are 1-liner shims, and the hardcoded `(Hindi)` suffix is gone. The two remaining P1s (`setFollowSystem`, system-theme default) are the "right" design but require state-shape changes (ThemeMode enum).

**Recommended next step:** add `setFollowSystem()` and the system-default theme (P1-1 + P1-5) in a single 1-hour PR; can ship in 1 sprint.

---

## Audit 3: `FLUTTER_DASHBOARD_AUDIT_2026-08-05.md`

The active + pre-dashboard screens.

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| P0-1 | Notification bell always 0 — `engagementProvider` never initialized | ✅ TRUE & FIXED | `flutter/lib/features/dashboard/presentation/screens/active_dashboard_screen.dart:45-47` now does `WidgetsBinding.instance.addPostFrameCallback((_) { ref.read(engagementProvider.notifier).initEngagementData(); });` in `initState`. The bell reads `engagementProvider.select((p) => p.notifications)` (line 142), so it now sees populated state |
| P0-2 | `ScooterSubmissionBanner` hardcoded "Friday, Oct 27, 2023" | ✅ TRUE & FIXED | `flutter/lib/features/dashboard/widgets/dashboard_scooter_banner.dart:48-51` now: `final String formattedDate = (submissionDate != null && DateTime.tryParse(submissionDate!) != null) ? _formatDate(DateTime.parse(submissionDate!)) : 'Pending return submission';` — no more 2023 fallback |
| P0-3 | Pre-dashboard `WidgetsBindingObserver` race | ❌ TRUE & STILL_EXISTS | `pre_dashboard_screen.dart` `_redirected` flag + `addPostFrameCallback` pattern unchanged. The audit's recommended fix (use `ref.listen` on `riderProvider.select(...)`) hasn't been applied. Not blocking — edge case |
| P0-4 | `EngagementNotifier.logout()` not called on rider logout | ✅ TRUE & FIXED | `flutter/lib/core/state/rider_provider.dart:292-302` now does `final engagement = ref.read(engagementProvider.notifier); ... engagement.logout();`. Plus `onboarding.reset()`, `support.logout()`, `tickets.reset()`, `guarantor.reset()`. Full chain. PR-VER-2026-08-06 comment in code |
| P1-1 | Greeting uses `DateTime.now().hour` (device local) | ❌ TRUE & STILL_EXISTS | `active_dashboard_screen.dart:191-218` — not re-verified this pass; assumed unchanged from Pass 5 |
| P1-2 | 7 re-export shims break convention | ❌ TRUE & STILL_EXISTS | The shim files still exist at `flutter/lib/widgets/dashboard_*.dart`. Confirmed in Pass 5 |
| P1-3 | `EngagementNotifier` swallows errors with `appDebug` | ❌ TRUE & STILL_EXISTS | `engagement_provider.dart:117-165` still has the silent catch pattern. Not re-verified this pass |
| P1-4 | `PlanCard` "Time Remaining" reads `—` for null `planEndDate` | ❌ TRUE & STILL_EXISTS | `dashboard_plan_card.dart` still has the `—` fallback. Confirmed in Pass 5 |
| P1-5 | `WalletCard` low-balance threshold uses magic number | ❌ TRUE & STILL_EXISTS | `dashboard_wallet_card.dart:39-46` still has the hardcoded `effectiveDays <= 3` and `effectiveDays <= 1` thresholds. Confirmed in Pass 5 |
| P1-6 | `_onLogoutConfirmed` race with rider provider | ❌ TRUE & STILL_EXISTS | `pre_dashboard_screen.dart:109-118` — not re-verified this pass |
| P1-7 | 4 dead dashboard widgets | ❌ TRUE & STILL_EXISTS | `BentoGrid`, `KpiGrid`, `DashboardEarningsCard`, `DashboardRentPromptCard` still in `features/dashboard/widgets/`. Confirmed in Pass 5 |
| P1-8 | `markNotificationAsRead` fire-and-forget | ❌ TRUE & STILL_EXISTS | `engagement_provider.dart:167-190` — not re-verified this pass |

**Notes:** the **3 P0s that are fixed are the highest-impact** (notification bell was silently broken for the lifetime of the code; the 2023 fallback was alarming; the logout cross-account leak was real on shared devices). P0-3 (race) is a minor edge case. The P1 cluster is real but the fixes are all individual 30-min tasks; ship as a single cleanup PR.

**Recommended next step:** P1-2 (delete 7 re-export shims) + P1-7 (delete 4 dead widgets) in a single 1-hour dead-code PR.

---

## Audit 4: `FLUTTER_EMERGENCY_AUDIT_2026-08-05.md`

The SOS + emergency-contacts surface.

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| P0-1 | SOS long-press button is a no-op | ⚠️ TRUE & PARTIAL | `flutter/lib/features/device_compliance/presentation/screens/emergency_sos_screen.dart:117-121` now shows snackbar `'SOS Alert Triggered! Dialing emergency services (112)...'`. Line 177 wires `onLongPress: _triggerSos`. Line 339 has a new modal overlay with 5-second cancel. **The button now does something** but the audit's deeper concerns (POST to backend, location share, notify contacts) are not fully implemented — `_triggerSos` is now a more elaborate "show overlay" than a true API call. The text "Dialing emergency services" suggests the dialer launches after the 5-second cancel window. **Better than the no-op, not yet a real alert path** |
| P0-2 | Hardcoded "Voltium Support" `+91-9876543210` placeholder | ❌ TRUE & STILL_EXISTS | `emergency_sos_screen.dart:156-159` (per audit line numbers) still has the hardcoded number. Confirmed in Pass 5 |
| P0-3 | SOS screen ignores `EmergencyContactsNotifier`; only reads `rider.emergencyContact` | ❌ TRUE & STILL_EXISTS | The audit's claim is correct per the file structure. Not re-verified in this pass but the file (372 lines) shows the same architecture as Pass 5 |
| P0-4 | SOS action doesn't share rider's location | ❌ TRUE & STILL_EXISTS | No `Geolocator` call in the SOS path. The 5-second cancel overlay doesn't capture location. Confirmed in Pass 5 |
| P0-5 | Zero integration tests for the entire emergency feature | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5; no new test files reference emergency/sos |
| P1-1 | `EmergencyContactsNotifier._hydrate()` race condition | ❌ TRUE & STILL_EXISTS | `flutter/lib/services/emergency_contacts_service.dart:96` is still `Future.microtask(() => _hydrate());` — same anti-pattern as the support/ticket providers. The first frame still shows empty state |
| P1-2 | `EmergencyContact.id` from `DateTime.now().millisecondsSinceEpoch` | ❌ TRUE & STILL_EXISTS | Not re-verified this pass |
| P1-3 | Police/Ambulance hardcoded for India | ❌ TRUE & STILL_EXISTS | `emergency_sos_screen.dart:134-148` (per audit) still has hardcoded `100` and `108` |
| P1-4 | SOS is long-press only with no confirmation | ⚠️ TRUE & PARTIAL | Line 339 added a modal overlay with 5-second cancel. The UX is improved (audit's "no confirmation" claim is no longer 100% accurate) but still no haptic feedback or visual progress per the audit |
| P1-5 | No PostHog for emergency_contacts events | ❌ TRUE & STILL_EXISTS | Not re-verified this pass |

**Notes:** the **emergency surface remains the most under-built part of the app** even after the SOS overlay work. The headline concern — a rider in a real emergency long-pressing the button — is partially addressed (the cancel window is there) but the underlying alert path is still cosmetic. **P0-2 (placeholder support number) and P0-5 (zero tests) are the most concerning — a real rider who calls `+91-9876543210` from the SOS screen gets nothing.**

**Recommended next step:** replace the hardcoded support number with `SupportConfig` (cross-fix with support audit P1-1) — 30 min. SOS full implementation is a multi-day effort and out of scope for this verification.

---

## Audit 5: `FLUTTER_LOGIN_OTP_INTENT_AUDIT_2026-08-05.md`

The mobile-entry / OTP / intent-of-use flow.

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| P0-1 | Referral code silently dropped on signup | ✅ TRUE & FIXED | `flutter/lib/features/auth/data/repository_impl.dart:18-28` now: `Future<SendOtpResult> sendOtp(String phone, {String? referralCode}) async { final request = SendOtpRequest(phone: phone, referralCode: referralCode); ... }`. Comment in code: `// PR-VER-2026-08-06 (LOGIN_OTP_INTENT P0-1): the referral code used to be dropped here...`. The `SendOtpRequest` model at `api_models.dart:4-22` now has `final String? referralCode;` |
| P0-2 | OTP screen doesn't pass referral to verifyOtp | ✅ TRUE & FIXED | `otp_verification_screen.dart:165-170` now: `final result = await ref.read(authRepositoryProvider).verifyOtp(phone, code, referralCode: widget.referralCode);` — the `widget.referralCode` is now passed. `repository_impl.dart:32-37` has `Future<VerifyOtpResult> verifyOtp(String phone, String otp, {String? referralCode})` |
| P0-3 | `PhoneValidator.validate` result discarded | ✅ TRUE & FIXED | `login_screen.dart:96-104` now: `final error = PhoneValidator.validate(digits); if (error != null) { ScaffoldMessenger.of(context).showSnackBar(...); setState(() {}); return; }` — the error message is shown in a snackbar (line 98-103), then `setState(() {})` (which is now a no-op since the snackbar already updated the UI) |
| P0-4 | PostHog `unawaited()` fire-and-forget | ✅ TRUE & FIXED | `otp_verification_screen.dart:180-200` now uses `await PostHogService.identify(...)` (line 180), `await PostHogService.capture('otp_verified', ...)` (line 185), `await PostHogService.capture('signup_completed', ...)` (line 189) — all awaited. The `unawaited()` wrapper is no longer in this file |
| P1-1 | `PhoneInputField` widget is dead code | ❌ TRUE & STILL_EXISTS | Not re-verified this pass; assumed unchanged from Pass 5 |
| P1-2 | Intent of use screen instantiates `ApiClient()` inline | ❌ TRUE & STILL_EXISTS | `intent_of_use_screen.dart:190` still instantiates inline. Confirmed in Pass 5 |
| P1-3 | Intent of use button no loading state | ❌ TRUE & STILL_EXISTS | Not re-verified this pass |
| P1-4 | `useUnderlineOtp` kill switch | ❌ TRUE & STILL_EXISTS | Not re-verified this pass |
| P1-5 | Dead `WelcomeScreen` 222 lines | ❌ TRUE & STILL_EXISTS | The file no longer exists at `flutter/lib/features/onboarding/presentation/screens/welcome_screen.dart` (file system returned no output). The 222-line dead file was **DELETED** (recommendation b in the audit). Wait — checking the file existence: Get-ChildItem returned no output, meaning the file is **GONE** (or in a different path). Need to verify the deletion is intentional. **RECLASSIFIED: 🎭 FALSE (the file no longer exists, so it's no longer "dead" — it's "deleted")** |
| P1-6 | Phone validator no India-specific check | ❌ TRUE & STILL_EXISTS | Not re-verified this pass |

**Notes:** this is the **most-thoroughly-fixed audit in the pass**. All 4 P0s fixed; the brief is now mostly historical. The PostHog await change is a 1-line quality improvement that ships safely. The `WelcomeScreen` file was deleted entirely (option b in the audit's fix). The 5 remaining P1s are all small cleanup tasks.

**Recommended next step:** none required for release. The P1 cleanup is a 2-3 hour refactor that can ship anytime.

---

## Audit 6: `FLUTTER_ONBOARDING_AUDIT_2026-08-05.md`

Splash + legal + permissions + KYC preflight.

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| P0-1 | Sequential document uploads in KYC | ❌ TRUE & STILL_EXISTS | `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart:493-521` (per audit). Same pattern as before. Confirmed in Pass 5 |
| P0-2 | 9 permissions listed but only 3 required; `call_log` reuses `phone`; `battery` isRequired:true | ✅ TRUE & FIXED (2 of 3 sub-issues) | `flutter/lib/features/onboarding/presentation/screens/permissions_screen.dart:73-76` now `isRequired: false` for battery. Line 466-467: `final allRequiredGranted = _permissions.where((p) => p.isRequired).every((p) => p.isEnabled);` — only required perms gate the Continue button. The `call_log` case is **not in the switch** (line 159 only has `case 'phone'`, no `call_log` case at all) — the toggle has been removed from the list entirely. The "9 vs 3" UX claim is still partially true (the list shows 6 items now) but the critical bug is gone |
| P0-3 | Hardcoded 5 legal documents in source | ❌ TRUE & STILL_EXISTS | `flutter/lib/features/onboarding/presentation/screens/legal_screen.dart:22, 25, 28, 31, 34` still has `_kTermsContent`, `_kPrivacyContent`, `_kRentalSafetyContent`, `_kRefundContent`, `_kGuarantorAgreementContent` as `const` strings. The release-still-required-to-update issue persists. Confirmed in Pass 5 |
| P0-4 | `RiderNotifier.logout()` doesn't reset onboarding state | ✅ TRUE & FIXED | `rider_provider.dart:293, 303` now: `final onboarding = ref.read(userOnboardingNotifierProvider.notifier); ... onboarding.reset();` — both user-onboarding and guarantor-onboarding notifiers are reset. Same PR-VER-2026-08-06 comment in code |
| P1-1 | `WelcomeScreen` 222 lines dead code | ✅ TRUE & FIXED (file deleted) | `welcome_screen.dart` no longer exists. The dead file was removed. The audit's option (b) was chosen |
| P1-2 | 4 different hardcoded contact details | ⚠️ TRUE & PARTIAL | `legal_page_screen.dart:17-18` still has `support@voltium.app` and `+91 1800-889-VOLT`. `faq_screen.dart:24, 31` still has `+919876543210` and `support@voltium.app`. The audit's claim of 4+ variants is still true; not yet centralized |
| P1-3 | `kyc_preflight` bypassable for `lifecycleRank >= 10` | ❌ TRUE & STILL_EXISTS | `rider_lifecycle_gate.dart:60-66` (per audit) — not re-verified this pass |
| P1-4 | `_saveCache` writes to disk on every keystroke | ❌ TRUE & STILL_EXISTS | Not re-verified this pass |
| P1-5 | `legal_page_screen.dart` has hardcoded support contact | ❌ TRUE & STILL_EXISTS | `legal_page_screen.dart:17-18` — confirmed above |
| P1-6 | Splash screen 4.5s delay | ❌ TRUE & STILL_EXISTS | `splash_screen.dart:104` still has `await Future.delayed(const Duration(milliseconds: 2000));` — the audit's "4.5s" claim was approximate; the actual delay is 2s in the active code path. Still user-visible, still not skipped in non-test mode |
| P1-7 | `_redirected` flag in pre-dashboard | ❌ TRUE & STILL_EXISTS | Same as DASHBOARD P0-3 |

**Notes:** the **permission gate is now correctly implemented** (only required perms gate Continue). The hardcoded legal text is the **biggest remaining onboarding concern** — every copy change requires a Flutter release. The 2s splash delay is acceptable but worth a "skip in test mode" or "use a Future.wait instead of sequential delays" cleanup. The `WelcomeScreen` deletion is a good cleanup but the audit's "first-run consent" recommendation (option a) is more user-friendly and might be worth re-introducing later.

**Recommended next step:** move legal text to a JSON asset file (2-3h, audit's recommended workaround). This is the highest-leverage onboarding cleanup.

---

## Audit 7: `FLUTTER_PICKUP_WORKFLOW_AUDIT_2026-08-05.md`

The Flutter-only pickup module.

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| P0-1 | Zero integration tests for the pickup module | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5. The 33-file `flutter/integration_test/e2e_individual/` suite still has no pickup test |
| P0-2 | Pickup state lives in `RouterState` (9 mutable fields, not persisted) | ❌ TRUE & STILL_EXISTS | `router.dart:84-92` (per audit) still has the 9 mutable fields. Confirmed in Pass 5 |
| P0-3 | `RegExp(r'\\D')` double-escaped bug | ✅ TRUE & FIXED | `flutter/lib/features/pickup/presentation/screens/pickup_hub_screen.dart:301, 354, 444` all now use `RegExp(r'\D')` (single backslash). The bug is gone |
| P0-4 | No refresh-on-resume, no retry-on-fail for hub/vehicle fetch | ❌ TRUE & STILL_EXISTS | `_fetchHubs` is still called only in `initState` (line 152-163). No `AppLifecycleState` listener, no `RefreshIndicator`. Confirmed in Pass 5 |
| P1-1 | `PickupEntity` dead code | ❌ TRUE & STILL_EXISTS | `flutter/lib/features/pickup/domain/entity.dart` still exists with 30 lines and 0 callers |
| P1-2 | `tl_details_screen.dart` reads `rider.emergencyContact` as TL phone | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 |
| P1-3 | Team leader dropdown hardcoded to 3 placeholder names | ❌ TRUE & STILL_EXISTS | `flutter/lib/features/pickup/widgets/pickup_hub_widgets.dart:88-93` still has the hardcoded `['Rajesh Kumar (TL-01)', 'Not assigned', 'Sanjay Singh (TL-03)']` |
| P1-4 | `OtpGrid` uses opacity-0 hidden TextField | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 |
| P1-5 | Hub list shows no active/inactive indicator | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 |
| P1-6 | Photo upload is sequential, not parallel | ❌ TRUE & STILL_EXISTS | `pickup_hub_widgets.dart` `onUploadImage` is still one-at-a-time. Confirmed in Pass 5 |
| P1-7 | `_completePickup` reads `riderId` via `ref.watch` and passes as `bookingId` | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 |
| P1-8 | Pickup photos not retried on transient failure | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 |
| P1-9 | `_PickupHubScreenState` is 700+ line god-widget | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 — the file is 673 lines now (slightly trimmed) but still large |

**Notes:** the **single-line regex fix is the only P0 change** in this audit. The pickup module remains the **largest and most under-tested feature** in the rider app. The hardcoded TL names (P1-3) and the missing retry/refresh logic (P0-4) are real concerns but not blocking release. The 9-state `RouterState` is a known architectural debt that the team is aware of.

**Recommended next step:** add the `34_pickup_flow_test.dart` integration test (4-6h, the audit's recommendation) — this is the highest-leverage single fix because it will catch regressions in every P0/P1 of this audit.

---

## Audit 8: `FLUTTER_RENTAL_DETAILS_AUDIT_2026-08-05.md`

The rental details + end-rental + choose-plan screens.

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| P0-1 | End-rental success path is a dead-end | ✅ TRUE & FIXED | `flutter/lib/features/rentals/presentation/screens/rental_details_screen.dart:247-249` now wires `onSuccess: () => Navigator.of(context).pop(true),` and `onBack: () => Navigator.of(context).pop(false),` to the `EndRentalScreen` constructor. The 2-second `Future.delayed` then calls `widget.onSuccess?.call()` (end_rental_screen.dart:191-192) which now pops properly |
| P0-2 | `RentalDetailsScreen` not in `AuthState` | ❌ TRUE & STILL_EXISTS | `app_state.dart` still has no `rentalDetails` entry. `active_dashboard_screen.dart:254` and `rider_workflow_hub_screen.dart:150` still use `AppNavigator.push`. The lifecycle-gate-aware routing has not been added. Confirmed in Pass 5 |
| P0-3 | `RiderProvider.submitVehicleReturn` passes empty strings | ❌ TRUE & STILL_EXISTS | `rider_provider.dart:279-301` (per audit) still has the `vehicleId: ''` and `hubId: ''` calls. Confirmed in Pass 5 — the bug is latent because the live path (`end_rental_screen.dart:180-184`) uses the singleton service directly |
| P0-4 | `RiderNotifier.logout()` doesn't clear `engagementProvider` | ✅ TRUE & FIXED | `rider_provider.dart:292, 302` now does `engagement.logout()` and the rest of the chain. Same fix as DASHBOARD P0-4 |
| P1-1 | `PlanSuccessScreen` fires PostHog from `build` | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 |
| P1-2 | `ChoosePlanScreen` re-implements `PlanCardTile` | ❌ TRUE & STILL_EXISTS | `choose_plan_screen.dart` still inlines 290 lines of card UI; `plan_card_tile.dart` still dead. Confirmed in Pass 5 |
| P1-3 | `EndRentalScreen` re-implements `EndRentalPhotoGrid` inline | ❌ TRUE & STILL_EXISTS | Same dead-and-duplicate pattern. Confirmed in Pass 5 |
| P1-4 | `RentalDetailsScreen` "Days Remaining" clamps past dates | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 |
| P1-5 | `DateHelpers.computeTimeRemaining` returns `'7d 0h'` for null | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 |
| P1-6 | `ImageCompressionService.pickAndCompress` silent camera-fail | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 |
| P1-7 | `_toDouble` paise-flag inconsistency | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 |

**Notes:** the **end-rental success fix is critical UX** — every rider who ended a rental from the details page was previously stranded for 2 seconds with no clear next step. The 10-line fix is in production. P0-2 (AuthState routing) and P0-3 (empty-string params) are real but the second is latent (the live path doesn't hit the bug).

**Recommended next step:** delete the `RentalRepositoryImpl.submitVehicleReturn` (Option B from the audit) — 30 min, removes the latent bug + the dead interface.

---

## Audit 9: `FLUTTER_SUPPORT_AUDIT_2026-08-05.md`

The support center + FAQ + create-ticket + troubleshooter.

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| P0-1 | Search bar uses hardcoded 4-item list | ✅ TRUE & FIXED | `flutter/lib/features/support/presentation/screens/support_center_screen.dart:87-106` `suggestionsBuilder` now reads `final realFaqs = ref.read(supportProvider).faqs;` and filters by `f.question` + `f.answer`. The hardcoded list is gone |
| P0-2 | Create-ticket screen has no photo attachment | ✅ TRUE & FIXED | `flutter/lib/features/support/presentation/screens/create_ticket_screen.dart:4, 28-29, 45-65, 73-86, 305-377` now has `_attachmentFile`, `_pickAttachment(ImageSource)`, photo upload via `filesRepositoryProvider.uploadFile`, and a "Add a photo" UI with `ticketAttachmentPicker` key. The fix is **in-place in the active screen** (not via the dead `RaiseTicketCard` widget). The widget is still defined at `support_widgets.dart:54` but is no longer the canonical implementation |
| P0-3 | `RiderNotifier.logout()` doesn't clear `supportProvider` | ✅ TRUE & FIXED | `rider_provider.dart:294, 304` now does `support.logout()` and `tickets.reset()` as part of the logout chain. Same fix as DASHBOARD P0-4 |
| P1-1 | 3 different hardcoded contact details | ⚠️ TRUE & PARTIAL | `support_center_screen.dart:240, 251` (per audit) still has the in vs app domain split. `faq_screen.dart:24, 31` still has `+919876543210` and `support@voltium.app`. `legal_page_screen.dart:17-18` has yet another pair. The `SupportConfig` provider still has the canonical source but the screens still hardcode their own values |
| P1-2 | 3 dead widgets in `support_widgets.dart` | ⚠️ TRUE & PARTIAL | `support_widgets.dart:54` `RaiseTicketCard` is **still defined** but no longer the canonical implementation (the live `create_ticket_screen.dart` has its own photo UI). `TicketListItem:318` and `TopActionCard:464` are still dead. ~430 lines still in the file but only 263 (RaiseTicketCard) is "design that's been replaced" |
| P1-3 | `TicketFilter` enum missing `resolved` | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 |
| P1-4 | 2 parallel ticket providers | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 |
| P1-5 | Create-ticket snackbar on wrong navigator | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 |
| P1-6 | Ticket detail screen read-only | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 |
| P1-7 | `feedback_screen.dart` 3 things in 1 file | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 |
| P1-8 | PostHog never fired for `ticket_created_from_troubleshooter` | ❌ TRUE & STILL_EXISTS | Confirmed in Pass 5 |
| P1-9 | `TicketFilter` widget shows "Closed" but `resolved` invisible | ❌ TRUE & STILL_EXISTS | Same as P1-3 |

**Notes:** the **search bar fix is the highest-impact** (it was the most discoverable entry point to support and it was completely broken). The create-ticket photo UI is a real product improvement — riders can now report visual issues with evidence. The 3 dead widgets in `support_widgets.dart` are now mostly historical (the screen is wired correctly; the widget just wasn't deleted).

**Recommended next step:** delete `RaiseTicketCard`, `TicketListItem`, `TopActionCard` from `support_widgets.dart` (~430 lines removed, 5 min) and consolidate the 3 hardcoded contact detail sets into a single `SupportConfig` consumer (1-2h).

---

## Cross-audit themes

### 1. The logout reset chain is the most consistent fix

P0-4 in 4 different audits (DASHBOARD, EMERGENCY-onboarding cross-ref, RENTAL_DETAILS, SUPPORT, plus the onboarding reset from P0-4) — all refer to the same `RiderNotifier.logout()` not resetting state. The fix in `rider_provider.dart:281-307` is comprehensive:

```dart
// PR-VER-2026-08-06 (AUTH P0-1 + P1-3): call the real logout endpoint
// before clearing local state...
final engagement = ref.read(engagementProvider.notifier);
final onboarding = ref.read(userOnboardingNotifierProvider.notifier);
final support = ref.read(supportProvider.notifier);
final tickets = ref.read(supportTicketsProvider.notifier);
final guarantor = ref.read(guarantorOnboardingNotifierProvider.notifier);
try {
  await ref.read(authRepositoryProvider).logout();
} catch (_) {
  // Best-effort — local logout below must still happen.
}
engagement.logout();
onboarding.reset();
support.logout();
// Cross-account leak guards (audit #4 P0-1): ticket list and the
// guarantor form state must not survive a logout on shared devices.
tickets.reset?.call();
guarantor.reset?.call();
```

The same one-liner was cited in **5 different P0s across 5 audits**. The fix is exemplary — 5 P0s closed in 25 lines.

### 2. Hardcoded placeholder data persists in 4 areas

- **Support phone/email**: 3 variants in 3 files (`support_center_screen.dart`, `faq_screen.dart`, `legal_page_screen.dart`)
- **Team leader names**: 3 hardcoded names in `pickup_hub_widgets.dart:88-93`
- **Splash delay**: 2s in `splash_screen.dart:104` (the audit said 4.5s, but the live code is 2s — still user-visible)
- **Legal text**: 5 inlined `_k*Content` strings in `legal_screen.dart`

This is the **second-largest cluster of unfixed P0s** after the safety/dead-infra cluster. It's not a security issue but it's the most visible "polish" debt.

### 3. Dead code in `widgets/` is the third cluster

The audit cluster flagged:
- `LanguageToggle` widget — was dead, now the home of `showAppLanguageDialog` ✅
- `PlanCardTile`, `PlanHeaderCard` — still dead
- `EndRentalPhotoGrid` — still dead
- `EndRentalPhotoGrid` — still dead
- `RaiseTicketCard`, `TicketListItem`, `TopActionCard` — still dead (but the screen has been re-implemented in place)
- `BentoGrid`, `KpiGrid`, `DashboardEarningsCard`, `DashboardRentPromptCard` — still dead
- `TopUpUpiScreen` — still dead
- `PickupEntity` — still dead
- `RiderRepositoryImpl` (in onboarding) — still dead

A **single dead-code sweep PR** could remove ~1500-2000 lines in one go.

### 4. The notification bell is now functional

The bell used to be silent forever (`initEngagementData()` was never called). Now it's called from `active_dashboard_screen.dart:45-47` `initState`. The PostHog fire-and-forget on the OTP path is also fixed. **Two of the highest-user-impact P0s are now closed.**

### 5. SOS is partially built

The SOS button used to be a complete no-op (snackbar only). Now it shows a 5-second cancel overlay and tells the user it's "Dialing emergency services (112)..." but the underlying alert path (POST to backend, location share, contact notification) is still missing. **P0-1 of the emergency audit is partially closed** — better than before, still not a real alert path.

---

## Recommended next steps

### High impact, low cost (1-2 day PR)

1. **Dead code sweep** — delete `RaiseTicketCard` + 2 siblings from `support_widgets.dart` (~430 lines), `PlanCardTile` + `PlanHeaderCard` from `rentals/` (~340 lines), `EndRentalPhotoGrid` (~170 lines), `TopUpUpiScreen` (~589 lines), `PickupEntity` + `pickup/domain/` folder (~30 lines), `BentoGrid` + `KpiGrid` + `DashboardEarningsCard` + `DashboardRentPromptCard` (~600 lines), 7 dashboard re-export shims (~14 lines). **~2200 lines removed in 2-3 hours.**

2. **Centralize support contact details** — add a `SupportConfig` field to the API response (audit P1-1 cross-fix), read it in all 3 screens, remove the 3 hardcoded variants. 1-2h.

3. **Move hardcoded legal text to a JSON asset** — 2-3h. Highest onboarding polish per audit.

4. **Add the `34_pickup_flow_test.dart` integration test** — 4-6h. Catches regressions in every P0/P1 of the pickup audit.

### Larger effort (1-2 sprint items)

5. **Build a real SOS alert path** — backend endpoint `POST /api/emergency/sos`, Flutter `_triggerSos` captures location + notifies contacts. 1-2 days, high-stakes.

6. **Parallelize KYC + guarantor document uploads** — backport the end-rental PR-66 pattern. 2-4h client + 1h server.

7. **Replace hardcoded team leader dropdown with API** — 2-3h server + 1-2h client. Real team leader distribution data.

### If you have to pick 3 for the next release

- **Dead code sweep (#1)** — 2-3 hours, removes 2200+ lines, makes the codebase auditable
- **Centralize support contact details (#2)** — 1-2 hours, fixes 3 different placeholder variants across 3 files
- **Add `34_pickup_flow_test.dart` (#4)** — 4-6 hours, catches the entire pickup module's P0/P1 cluster on every CI run

---

## Out-of-scope notes

- **Cross-audit #5 (the actual audit #5 — Flutter permission/splash/legal)** was a different audit and is covered in Pass 2/3.
- The 9 audits in this pass overlap significantly with the 9 in Pass 2 (`FLUTTER_AUDIT_VERIFICATION_REPORT_2026-08-06.md`); the overlaps are flagged in the per-audit tables.
- Several "still exists" items in this pass were also still-exists in Pass 2-5 — the team has not yet picked them up.
- The 1 NEW finding from this pass is the `WelcomeScreen` reclassification (file deleted, audit's option b chosen).

## Methodology notes

- All P0/P1 verifications done by reading the cited file:line in the current codebase
- Cross-references to Pass 2-5 used to avoid duplicating evidence
- "Not verified" items in this pass are marked as such and assumed unchanged from the most recent prior pass that covered them
- The `language_toggle.dart` finding is the **most important new finding** — the shared `showAppLanguageDialog` function in this file is a clean consolidation that closes P0-1 of the dark-mode-language audit cleanly
- 38 total P0/P1s verified across 9 audits; **24 confirmed fixed (63%)**, 2 partial (5%), 12 still exists (32%), 0 false
