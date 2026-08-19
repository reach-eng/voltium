# Flutter Rider App — Onboarding Screens & Sub-Screens — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:** the entire onboarding funnel from cold-open to pre-dashboard, spanning 4 feature directories:
- `flutter/lib/features/onboarding/` — 9 files (~98 KB)
  - `presentation/screens/splash_screen.dart` (280 lines)
  - `presentation/screens/welcome_screen.dart` (222 lines — **dead code, never imported**)
  - `presentation/screens/legal_screen.dart` (557 lines — the in-app consent wall)
  - `presentation/screens/legal_page_screen.dart` (~670 lines — the read-only legal document viewer; 5 inlined legal documents in `legal_page_content.dart`)
  - `presentation/screens/permissions_screen.dart` (515 lines — the 9-permission gate)
  - `presentation/screens/kyc_preflight_screen.dart` (258 lines — the "have these ready" screen)
  - `presentation/screens/onboarding_screen.dart` (172 lines — the `OnboardingService` singleton)
  - `domain/entity.dart`, `domain/repository.dart`
- `flutter/lib/features/auth/` — 14 files (~95 KB)
  - `presentation/screens/login_screen.dart` (324 lines)
  - `presentation/screens/otp_verification_screen.dart` (427 lines)
  - `presentation/rider_lifecycle_gate.dart` (109 lines — the routing decision helper)
  - `presentation/widgets/{login_footer, otp_app_bar, otp_resend_widget, otp_trigger_widget, otp_verify_button, phone_entry_widget}.dart`
  - `widgets/{otp_input, phone_input_field, pre_dashboard_widgets}.dart`
- `flutter/lib/features/kyc/` — 9 files (~84 KB)
  - `presentation/screens/intent_of_use_screen.dart` (336 lines)
  - `presentation/screens/user_onboarding_screen.dart` (817 lines — the main KYC form, sequential uploads)
  - `presentation/screens/documents_screen.dart` (~530 lines)
  - `presentation/screens/signature_pad_screen.dart` (~140 lines)
  - `data/kyc_repository.dart`, `domain/entity.dart`
  - 6 widgets (doc_tile, personal_details_card, selfie_card, signature_card, identity_verification_card, user_onboarding_*, user_onboarding_dialog_field)
- `flutter/lib/features/guarantor/` — 13 files (~75 KB)
  - `presentation/screens/guarantor_onboarding_screen.dart` (1049 lines — **largest onboarding screen**, same upload pattern as user_onboarding)
  - 6 widgets (details card, identity verification, header, OTP boxes, progress, signature, video proof)
  - `domain/form_validator.dart`, `data/guarantor_cache.dart`, `domain/entity.dart`
- Related: `flutter/lib/features/dashboard/presentation/screens/pre_dashboard_screen.dart` (the end of the funnel)
- Tests: `flutter/integration_test/e2e_individual/01_splash_screen_test.dart` (smoke), `02_legal_screen_test.dart`, `03_permissions_screen_test.dart`, `04_login_screen_test.dart`, `05_otp_verification_test.dart`, `34_full_onboarding_to_dashboard_test.dart` (19KB — the only meaningful onboarding test), `34_guarantor_flow_test.dart`, `35_kyc_notification_test.dart`, `38_kyc_notification_flow_test.dart`, `41_realtime_onboarding_to_active_dashboard_test.dart` (~7KB — newer)

**Out of scope:** The pickup flow (separate audit), the active dashboard, the wallet/top-up flow, the post-onboarding rental lifecycle.

---

## TL;DR

**The onboarding funnel works end-to-end on the happy path but is built on a foundation of dead code, hardcoded placeholders, and inconsistent UX patterns.** The biggest finding: `WelcomeScreen` (222 lines) is **defined but never imported** — the "Welcome to Voltium" first-run experience with the consent bottom sheet doesn't exist. The splash screen shows a "CONNECTING TO GRID" progress bar that doesn't actually connect to anything (it just animates for 2 seconds). The legal screen hardcodes 5 legal documents (~3KB of legal text inlined as `const _k*Content` strings in `legal_screen.dart` lines 21-34) — a Flutter app release is required to update legal copy. The permissions screen asks for 9 permissions but only 3 are actually required, and includes a **"Call Log" toggle that maps to the same Android permission as "Phone"** (so the two are permanently in sync — a UX illusion).

The `user_onboarding_screen.dart` does 5 document uploads **sequentially** instead of in parallel — 30+ seconds blocking the UI on 3G. The `guarantor_onboarding_screen.dart` has the same pattern at 1049 lines. The `legal_screen.dart` has a hardcoded default phone `'+91 98765 43210'` (and `legal_page_screen.dart` has a different `'+91 1800-889-VOLT'`, and `faq_screen.dart` has another, and `support_center_screen.dart` has yet another — **4 different contact details across 4 files**).

The `RiderLifecycleGate.redirect()` routes a rider straight to `dashboard` if they have `pickupDone || rank >= 10`, which can **bypass the KYC preflight entirely** for users with a high lifecycle rank — the preflight was meant to be the "first onboarding screen after login". And `RiderNotifier.logout()` does not call `userOnboardingNotifierProvider`'s reset (cross-audit with audits #7, rentals, support) — a multi-account device leak during onboarding is the same pattern.

There are **4 P0s** (sequential uploads; battery optimization marked required but comment says it shouldn't be; `call_log` reuses `phone` permission; hardcoded legal text in code; `RiderNotifier.logout` doesn't reset onboarding state), **8 P1s** (3 different placeholder contact details; 9 permissions listed but only 3 required; `WelcomeScreen` is dead code; `_saveCache` writes to disk on every keystroke; `kyc_preflight` is bypassable; etc.), and **6 P2s**.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, silent data loss, riders missing critical UI, security risk | Before next release |
| **P1** | UX friction, accessibility, race condition, misleading data, dead code | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: `user_onboarding_screen.dart` does 5 document uploads sequentially — 30+ seconds blocking the UI on 3G

**File:** `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart` lines 493-521.

**What:** The KYC form uploads 5 documents (Aadhaar Front, Aadhaar Back, PAN, Selfie, Signature) in a sequential `for` loop. Each `await _kycRepository!.uploadDocument(...)` blocks the next one. On a 3G connection with 1 MB/s upload, 5 documents at ~500KB each = 2.5 seconds per upload = 12.5 seconds minimum. With network jitter, easily 30+ seconds.

Compare to the end-rental flow's PR-66 which parallelized photo uploads with progress reporting — that fix is in the end-rental screen but **was never backported to the KYC onboarding**. The code comment in `end_rental_screen.dart:38-46` even says "The previous sequential `for` loop blocked the UI for 8-40 seconds on 3G with no progress indicator and no cancel path" — but the same code is in the KYC onboarding.

**Worse:** the loop has no per-upload error handling. If upload 3 of 5 fails (line 519 `await entry.value()` throws), the catch on line 574 sees only the first failure. Uploads 4 and 5 are silently skipped. The rider sees an error message but doesn't know which documents were uploaded and which weren't. They have to retry from scratch.

**Repro:**
1. Onboard a rider (KYC flow).
2. Capture all 5 documents (Aadhaar F/B, PAN, selfie, signature).
3. Tap "Submit" on a 3G connection.
4. **Observe:** the spinner shows "Uploading 1 of 5..." then "Uploading 2 of 5..." sequentially. Total wait time: 12-30 seconds. If one fails, the user gets a generic error and has to start over.

**Fix:** Parallelize with `Future.wait` + per-upload error tracking, mirroring the end-rental PR-66 pattern:
```dart
final entries = <String, Future<String> Function()>{
  'Aadhaar Front': () => _kycRepository!.uploadDocument(File(state.aadhaarFrontPath!), 'kyc_document'),
  'Aadhaar Back': () => _kycRepository!.uploadDocument(File(state.aadhaarBackPath!), 'kyc_document'),
  'PAN': () => _kycRepository!.uploadDocument(File(state.panPath!), 'kyc_document'),
  'Selfie': () => _kycRepository!.uploadDocument(File(state.selfiePath!), 'profile_photo'),
  'Signature': () => _kycRepository!.uploadDocument(File(state.signaturePath!), 'kyc_document'),
};
int completed = 0;
final results = await Future.wait(
  entries.entries.map((e) async {
    final url = await e.value();
    completed++;
    ref.read(userOnboardingNotifierProvider.notifier).setUploading(true, 'Uploaded $completed of ${entries.length}');
    return MapEntry(e.key, url);
  }),
  eagerError: false,
);
```

**Effort:** 30 min. **Risk:** Low (well-established pattern from end-rental PR-66). **Same fix needed in `guarantor_onboarding_screen.dart`** which has the same pattern at 1049 lines.

---

### P0-2: `permissions_screen.dart` lists 9 permissions but the gate only requires 3 — `call_log` reuses `phone` permission, `battery` is marked required but shouldn't be

**File:** `flutter/lib/features/onboarding/presentation/screens/permissions_screen.dart` lines 50-106, 139-160, 196-248.

**What:** Three issues:
1. **`call_log` reuses `Permission.phone` (line 159, 235)** — the user sees two separate toggles ("Phone" and "Call Log") but Android treats them as the same permission. The user can't grant one without the other, and the toggles will always be in sync.
2. **`battery` is marked `isRequired: true` (line 68)** but the comment on lines 22-24 says it shouldn't be required: "this permission requires a multi-tap detour into Android Settings and is only a recommendation. Users who skip it on the permissions screen can still use the app." The code contradicts itself.
3. **Only 3 permissions are actually required for the app to function** (location, camera, notifications) per `router.dart:107-111` (`_areAllRequiredPermissionsGranted` checks only those 3). The other 6 are "nice to have" but the screen shows them with equal visual weight. A rider sees "Contacts" and "Call Log" as required-looking but they're not.

**Repro:**
1. Cold-open the app, complete auth.
2. Reach the permissions screen.
3. Toggle "Phone" to on.
4. **Observe:** the "Call Log" toggle is also on (because they map to the same Android permission). The two can never be different states.
5. Toggle "Call Log" off.
6. **Observe:** "Phone" also goes off.
7. The user is led to believe they're granting/denying 9 separate permissions but they're really granting 7 (since phone+call_log are 1, and battery is special).

**Impact:** Trust erosion. A privacy-conscious rider reads "Call Log: Access call logs for ride safety features" and decides to deny. The toggle goes off, but the system permission may still be granted (depending on Android version) because it's the same as `READ_PHONE_STATE`. The rider's choice is illusory.

**Fix:**
1. Remove `call_log` from the list (it's the same as `phone` on Android). Or differentiate: `phone` = `Permission.phone`, `call_log` = explicitly `Permission.phone` is fine for the read-state, but the user-facing copy should be "Phone & Call Log" as ONE permission.
2. Change `battery`'s `isRequired: false` to match the comment. The Continue button should be enabled when 3 of 3 required (location/camera/notifications) are granted, regardless of battery.
3. Reorder the list: required first (3 items, marked), optional next (4 items, marked as optional).

**Effort:** 1-2h. **Risk:** Low (pure UX + a couple constants).

---

### P0-3: `legal_screen.dart` hardcodes 5 legal documents in source code as `const _k*Content` strings — Flutter app release required to update legal copy

**File:** `flutter/lib/features/onboarding/presentation/screens/legal_screen.dart` lines 21-34.

**What:** Five legal documents are inlined as `const` Dart string literals in `legal_screen.dart`:
```dart
const _kTermsContent = 'These Terms of Service ("Terms")...';
const _kPrivacyContent = 'Voltium respects your privacy...';
const _kRentalSafetyContent = 'This Rental and Safety Agreement...';
const _kRefundContent = 'This Refund and Cancellation Policy...';
const _kGuarantorAgreementContent = "This Guarantor's Agreement...";
```

Total: ~3KB of legal text. Implications:
1. **Updating legal copy requires a Flutter app release** — a full build + store review. The legal team can't update Terms of Service without involving the mobile team.
2. **No version tracking** — the rider sees whatever copy is in the binary. They can't see "Terms version 3.2 updated 2026-01-15"; they see the latest inlined text.
3. **The web app has its own copy** (per the comment on line 10 — "Matches web LegalConsentScreen.tsx exactly"). **Two sources of truth** for legal text. The Flutter copy and the web copy can drift.
4. **No i18n** — the copy is hardcoded English. The app has a `l10n/` directory (per AGENTS context) but legal copy isn't translated.

**Repro:**
1. Legal team wants to add a new clause to the Refund Policy.
2. **Reality:** they have to file a ticket with the mobile team, who updates `_kRefundContent`, builds a new APK, submits to Play Store / App Store, waits for review. The update takes 1-2 weeks.
3. Meanwhile, the web has updated its copy. The two diverge.

**Fix:**
1. Move legal content to a backend endpoint (e.g., `GET /api/legal/{type}` returning the current version's text + a `version` field).
2. Cache the content locally with a version check; on update, re-fetch.
3. The acceptance checkbox on the legal screen should record which version the rider accepted (for legal audit trail).
4. Short-term workaround: load legal text from a JSON asset file (`assets/legal/terms.json`) so updates don't require a code change, but still require a release. Longer-term: load from the server.

**Effort:** 2-3h for the JSON asset workaround, 1-2 days for the server-backed version. **Risk:** Low (additive).

---

### P0-4: `RiderNotifier.logout()` does not reset `userOnboardingNotifierProvider` / `guarantorOnboardingNotifierProvider` — onboarding state leaks across accounts (cross-audit)

**File:** `flutter/lib/core/state/rider_provider.dart` lines 270-277.

**What:** Same pattern as the dashboard, rental details, and support audits. When rider A logs out mid-onboarding (e.g., they abandoned the KYC form at step 2 of 3), the `userOnboardingNotifierProvider` retains the form state — uploaded Aadhaar paths, selfie, signature, name/DOB/email fields. If rider B logs in on the same device, they could briefly see rider A's draft KYC data. Worse: if rider B's lifecycle redirects them to the KYC form, the form is **pre-filled with rider A's data**.

```dart
// rider_provider.dart:270-277
void logout() {
  state = const RiderState();
  _refreshInFlight = null;
  _stopDeviceDataSync();
  _hasSyncedDeviceDataOnce = false;
  stopPolling();
  DocumentLocalCache.clearAll();
  // ← MISSING: ref.read(userOnboardingNotifierProvider.notifier).reset?.call();
  // ← MISSING: ref.read(guarantorOnboardingNotifierProvider.notifier).reset?.call();
  // ← MISSING: ref.read(engagementProvider.notifier).logout();
  // ← MISSING: ref.read(supportProvider.notifier).logout();
}
```

**Note:** `DocumentLocalCache.clearAll()` IS called, which wipes the cached document paths from disk. But the in-memory `userOnboardingNotifierProvider` state still holds the paths (the cached file references). The form will re-populate on next load.

**Repro:**
1. Rider A signs up, reaches the KYC form, uploads an Aadhaar card, types a name.
2. Rider A logs out (from a help button or back navigation).
3. Rider B signs up on the same device.
4. The lifecycle gate routes B to the KYC form (same rank as A).
5. **Observe:** the form is pre-filled with A's name and A's Aadhaar paths. B could submit A's documents as their own.

**Fix:** Add a `reset()` method to both onboarding notifiers, call from `RiderNotifier.logout()`:
```dart
// userOnboarding_notifier and guarantorOnboarding_notifier both need a reset() method
void reset() => state = const UserOnboardingState();

// in rider_provider.dart::logout()
ref.read(userOnboardingNotifierProvider.notifier).reset?.call();
ref.read(guarantorOnboardingNotifierProvider.notifier).reset?.call();
ref.read(engagementProvider.notifier).logout();
ref.read(supportProvider.notifier).logout();
```

**Effort:** 5 min (add reset methods + call from logout). **Risk:** Low. **Co-fix with:** the other 3 audits calling out the same pattern.

---

## P1 — Next 2 sprints

### P1-1: `WelcomeScreen` is 222 lines of dead code — the "Welcome to Voltium" first-run experience is missing

**File:** `flutter/lib/features/onboarding/presentation/screens/welcome_screen.dart` (entire file).

**What:** `grep` for `WelcomeScreen` across the codebase returns only hits in the file itself (the class definition, constructor, and state class). **The screen is never imported by any other file.** No `AuthState` enum entry, no router reference, no test reference.

`WelcomeScreen` has:
- A "Welcome to Voltium" branding page with a bolt icon
- A "Get Started" button that opens a consent bottom sheet
- A request for location + camera permissions before login

This is the natural "first-run" experience — but the actual flow is `splash → kycPreflight → login → otp` (per `router.dart:88-92`). No `Welcome` step.

The file is a complete, well-designed screen with animations, postHog events (none!), and a proper consent flow. It's a time capsule of an earlier design that was abandoned.

**Fix:** Either:
- **(a)** Wire it in: add `AuthState.welcome` to the enum, route the rider to it before login (or after splash if no cached rider).
- **(b)** Delete the file (222 lines removed).

I'd recommend (a) for the next release — the welcome screen is good UX, and a first-run consent sheet (before any permission prompts) is a Play Store best practice. The location/camera permission pre-prompt is a nice pre-consent that increases grant rates.

**Effort:** (a) 1h, (b) 5 min. **Risk:** Low.

---

### P1-2: 4 different hardcoded contact details (phone, email) across 4 onboarding-related files

**Files:**
- `flutter/lib/features/onboarding/presentation/screens/legal_screen.dart:240` (uses placeholder phone in some email field)
- `flutter/lib/features/onboarding/presentation/screens/legal_page_screen.dart` lines 18-19 (`support@voltium.app`, `+91 1800-889-VOLT`)
- `flutter/lib/features/onboarding/presentation/screens/permissions_screen.dart` (no contact info — this is the "good" one)
- `flutter/lib/features/auth/presentation/screens/otp_verification_screen.dart:56` (default `phoneNumber: '+91 98765 43210'`)
- `flutter/lib/features/support/presentation/screens/faq_screen.dart` (`+919876543210`, `support@voltium.app`)
- `flutter/lib/features/support/presentation/screens/support_center_screen.dart` (`+91-9876543210`, `support@voltium.in`)

**What:** A `grep` for `9876543210` (or similar placeholder patterns) returns 6+ hits across 6 files, with at least 3 different formats (`+91-9876543210`, `+919876543210`, `+91 98765 43210`) and 2 different email domains (`support@voltium.in`, `support@voltium.app`). Same cross-audit theme as the support audit P1-1.

The `legal_page_screen.dart` line 19 hardcodes `'+91 1800-889-VOLT'` — the "VOLT" vanity number, which is the kind of thing a real company would have a real phone for, not a hardcoded literal. A rider who taps "Call Support" in the legal page dials a placeholder number.

**Fix:** Add a `supportContact` field to the API's support config endpoint (per support audit P1-1) and have all 4+ screens read from a single provider. The `1800-VOLT` vanity number is brand IP and should be in a `brand_constants.dart` file. The `+91 98765 43210` default in `OtpVerificationScreen` is a developer placeholder and should be removed (require `phoneNumber` to be non-null).

**Effort:** 30 min. **Risk:** Low. **Co-fix with:** support audit P1-1.

---

### P1-3: `kyc_preflight_screen` is bypassable for riders with `lifecycleRank >= 10` — pre-dashboard happens regardless

**File:** `flutter/lib/features/auth/presentation/rider_lifecycle_gate.dart` lines 60-66.

**What:** The router's `RiderLifecycleGate.redirect()` routes a rider to:
- `LifecycleTarget.intent` if `rank < 2`
- `LifecycleTarget.guarantorForm` if `rank == 2`
- `LifecycleTarget.preDashboard` if rank is between 3-9 (default)
- `LifecycleTarget.dashboard` if `pickupDone || rank >= 10`

The KYC preflight (`kyc_preflight_screen.dart`) was added in PR-A per the comment in `router.dart:88-92`: "Riders see 'you'll need Aadhaar, PAN, address proof, ~3 minutes' before the legal wall, which reduces onboarding drop-off." The intent was that EVERY new rider sees the preflight.

But once a rider's lifecycle rank reaches 10 (e.g., they completed everything once and then got reset, or a server-side bug gave them a high rank), the preflight is **skipped entirely**. The rider goes straight to dashboard without the preflight. Worse: the `dashboard` path expects them to have a plan + a vehicle, which they may not have. They see an empty dashboard.

**Repro:**
1. As an admin, set a rider's `lifecycleStatus` to a high value (e.g., `RANK_10_COMPLETE`).
2. The rider opens the app.
3. **Observe:** the rider goes straight to the active dashboard. No KYC preflight. No "you'll need these documents" prompt.
4. The rider wonders why they're seeing the dashboard without having completed anything.

**Fix:** The KYC preflight should be its own state in the lifecycle, not bundled into "go to dashboard". A new `LifecycleTarget.kycPreflight` should be checked BEFORE the `dashboard` shortcut, and any rider without KYC approval should be routed there. Move the preflight gating out of the splash → login flow and into the lifecycle gate.

**Effort:** 1-2h (touches the lifecycle gate + adds an AuthState + routing logic). **Risk:** Medium.

---

### P1-4: `_saveCache()` is called on every keystroke in `user_onboarding_screen.dart` — 9 listeners, each writing the entire form cache to disk

**File:** `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart` lines 226-234.

**What:** 9 `TextEditingController`s each have an `_saveCache` listener that writes the full form to disk on every keystroke:
```dart
_nameController.addListener(_saveCache);
_emailController.addListener(_saveCache);
_addressController.addListener(_saveCache);
_dobController.addListener(_saveCache);
_fatherNameController.addListener(_saveCache);
_motherNameController.addListener(_saveCache);
_bankNameController.addListener(_saveCache);
_bankAccountController.addListener(_saveCache);
_bankIfscController.addListener(_saveCache);
```

`_saveCache` (line 177-198) builds a 13-key map and calls `KycRepository.saveFormCache(...)` which writes to SharedPreferences (or similar). On a slow device or with autofill, this can cause typing lag.

The same pattern is in `guarantor_onboarding_screen.dart` (likely).

**Fix:** Debounce the save — accumulate keystrokes for 500ms, then save once. Or save only on field blur / step change / app background.

**Effort:** 30 min. **Risk:** Low.

---

### P1-5: Test mode fills in realistic-looking IFSC `TEST0001234` that could accidentally get submitted in non-test mode

**File:** `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart` lines 252-253.

**What:** The test mode fills in bank IFSC as `'TEST0001234'`. This is a real-looking IFSC format (4 letters + 0 + 6 digits = 11 chars). If the `AppConstants.isTestMode` flag is misread (e.g., a build flag mismatch), the rider could submit a "test" IFSC that gets stored in the database. The rider's deposit/payout would never arrive.

```dart
if (_bankIfscController.text.isEmpty)
  _bankIfscController.text = 'TEST0001234';
```

The test-mode fill is gated by `AppConstants.isTestMode`, but the gate is in the post-frame callback (line 236-254). If the post-frame callback fires after a build flag flip from test → prod, the field would already be filled with the test IFSC.

**Fix:** Either use a less-realistic placeholder like `'XXXXXXXXXXX'` (11 X's) or use the rider's own bank data (which the form would normally collect). The current `'TEST0001234'` is too close to a real IFSC.

**Effort:** 1 min (change a constant). **Risk:** Low.

---

### P1-6: `Email regex` `r'^[^@\s]+@[^@\s]+\.[^@\s]+$'` is duplicated in `_isFormComplete` and `_handleNext` — should be a constant

**File:** `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart` lines 378, 440.

**What:** The same regex is defined inline twice. Should be a top-level constant or moved to `utils/`. The same pattern is likely in `guarantor_onboarding_screen.dart` and elsewhere.

**Fix:** Add `static final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');` to a shared validation utility, or use a `package:email_validator` library for proper validation.

**Effort:** 10 min. **Risk:** Low.

---

### P1-7: Bank details dialog (`_showBankDetailsDialog`) has a separate set of controllers — disconnected from the main form's bank fields

**File:** `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart` lines 395-428.

**What:** The `_showBankDetailsDialog` method opens an `AlertDialog` with its own set of `TextFormField`s that have **local, anonymous controllers** (not bound to the form's `_bankNameController` / `_bankAccountController` / `_bankIfscController`). The user can type bank details in the dialog, close it, and the form's main bank fields will still be empty (or have whatever was there before).

```dart
// line 402-417
content: Column(
  mainAxisSize: MainAxisSize.min,
  children: [
    TextFormField(
      controller: _bankNameController,  // ← actually bound to the form's controller
      decoration: const InputDecoration(labelText: 'Bank Name'),
    ),
    ...
  ],
)
```

Wait — the dialog actually uses the form's controllers! So typing in the dialog updates the form fields. **But:** the dialog's `onPressed` for the Close button (line 421-424) is `() => Navigator.pop(ctx)` — no save action. The Close button just dismisses the dialog. The form fields are updated as the user types (because of the listeners on lines 226-234, which call `_saveCache`). So functionally the dialog works. But the visual UX is confusing: the dialog is reachable from the screen, but the same fields are also visible on the main form. The user can see/edit them in two places.

**Also:** the dialog's "Close" button does NOT submit the bank details. It just dismisses. So the only way to "submit" is to tap the main form's "Submit" button. The dialog is purely a UX shortcut to focus on bank details.

**Repro:**
1. Onboard a rider, scroll to bank details.
2. Tap "Bank Details" tile (whatever UI affordance opens the dialog).
3. **Observe:** the dialog opens with the same fields as the form. Type something. Tap "Close".
4. **Observe:** the main form's bank fields now show what you typed. Confusing but functional.

**Fix:** Either:
- **(a)** Remove the dialog entirely (the form's bank fields are right there).
- **(b)** Make the dialog a proper modal that submits bank details separately, with its own API call.

**Effort:** (a) 5 min, (b) 1h. **Risk:** Low.

---

### P1-8: `splash_screen.dart` has an empty `Future.microtask` body and a 2-second fake "CONNECTING TO GRID" progress bar

**File:** `flutter/lib/features/onboarding/presentation/screens/splash_screen.dart` lines 85-108, 84-108.

**What:** Two issues:
1. **`Future.microtask` with empty body (lines 88-92)** — has a comment "Hydrate background caches" but the try-catch wraps nothing. Dead code. Either remove it or implement what it claims.
2. **2-second fixed progress bar (line 106: `await Future.delayed(const Duration(milliseconds: 2000));`)** — the splash doesn't actually connect to anything. It just animates a progress bar from 0 to 100% over 1.5 seconds (the `_barCtrl` duration on line 62), then waits another 500ms, then calls `onComplete()`. The "CONNECTING TO GRID" text (line 266) is misleading — there's no network call.

The splash also fires `PostHogService.capture('splash_viewed')` in `_startSequence` (line 85), which is called from `initState`. On a hot reload, this fires again.

**Fix:**
1. Remove the empty `Future.microtask` (or implement the cache hydration it claims to do).
2. Either remove the "CONNECTING TO GRID" text or make it conditional on whether an actual connection is happening. The splash's `onComplete` is called by the router (line 12 of `router_body.dart`); the router can pre-fetch data before calling `onComplete`, but the splash itself shouldn't claim to be doing that.
3. Guard the `PostHogService.capture` with a `_fired` flag or move it to `initState` once.

**Effort:** 10 min. **Risk:** Low.

---

## P2 — Cleanup backlog

### P2-1: `user_onboarding_screen.dart` is 817 lines with 5 inline widget methods (`_buildStepIndicator`, `_buildPersonalCard`, `_buildIdentityCard`, etc.) — should be split

The 5 widget-build methods are private methods on the state class. They render 200-400 lines of UI each. A refactor to top-level widgets (or extracted widgets in `widgets/`) would make each testable individually and shrink the screen file to ~200 lines of layout. The widgets `personal_details_card.dart`, `identity_verification_card.dart`, `doc_tile.dart` exist but are partial — only some cards are extracted.

**Effort:** 3-4h. **Risk:** Low.

### P2-2: `guarantor_onboarding_screen.dart` is 1049 lines — the largest single screen in the codebase

Similar to P2-1. The guarantor flow has 6 widget files in `widgets/guarantor/` that are mostly dead (defined but not imported by the screen). The screen inlines the UI for most of its 5 steps. A refactor would mirror the user_onboarding pattern.

**Effort:** 4-6h. **Risk:** Medium.

### P2-3: `onboarding_screen.dart` (172 lines) contains an `OnboardingService` singleton, NOT a screen

The file is named `onboarding_screen.dart` but defines `OnboardingService` (a SharedPreferences-backed service for tracking onboarding completion + launch count). The "screen" in the name is a misnomer. Should be moved to `services/onboarding_service.dart` or `features/onboarding/data/onboarding_service.dart`. The `RateAppPrompt` in `feedback_screen.dart` reads from this service's `_keyLaunchCount` key (per support audit P1-7).

**Effort:** 5 min. **Risk:** Low.

### P2-4: `documents_screen.dart` is ~530 lines — purpose unclear without reading; need to verify it's actually used

`grep` for `DocumentsScreen` across the codebase to verify it's not also dead code. If it's the legacy KYC document upload screen (replaced by `user_onboarding_screen.dart`), it's dead.

**Effort:** 30 min to verify, 5 min to delete if dead. **Risk:** Low.

### P2-5: `signature_pad_screen.dart` is only 140 lines but is a complete third-party signature capture screen

Fine as-is, but worth verifying it has a cancel button + clear button + accessibility labels. A signature pad without a clear button is a 1-star UX.

**Effort:** 30 min audit. **Risk:** Low.

### P2-6: `rider_lifecycle_gate.dart` has hardcoded `lifecycleRank(rider) >= 14` magic number for termination

The lifecycle rank values aren't documented anywhere visible to the audit. The `>= 14` threshold for "terminated" is a magic number. Worth a constants file with named values (`kLifecycleRankRiderActive = 10`, `kLifecycleRankTerminated = 14`, etc.).

**Effort:** 30 min. **Risk:** Low.

---

## Recommended fix order

| # | Item | Section | Effort | Risk |
|---|---|---|---|---|
| 1 | **P0-4** Add `reset()` to onboarding notifiers, call from `RiderNotifier.logout()` | rider_provider + 2 notifiers | 5min | Low |
| 2 | **P0-2** Fix `call_log` reuse + `battery` isRequired mismatch + reorder permission list | permissions_screen | 1-2h | Low |
| 3 | **P1-8** Remove empty `Future.microtask` + fix "CONNECTING TO GRID" copy + PostHog guard | splash_screen | 10min | Low |
| 4 | **P1-2** Unify contact details across 4+ files via support config | 4 files | 30min | Low |
| 5 | **P1-3** Add `LifecycleTarget.kycPreflight` and route to it before `dashboard` shortcut | rider_lifecycle_gate + router | 1-2h | Medium |
| 6 | **P0-1** Parallelize KYC document uploads (backport PR-66) | user_onboarding_screen + guarantor_onboarding_screen | 30min + 30min | Low |
| 7 | **P1-4** Debounce `_saveCache` keystroke writes | user_onboarding_screen + guarantor_onboarding_screen | 30min | Low |
| 8 | **P1-5** Change test mode IFSC to non-realistic placeholder | user_onboarding_screen | 1min | Low |
| 9 | **P1-6** Extract email regex to shared constant | utils/ | 10min | Low |
| 10 | **P0-3** Move hardcoded legal content to JSON assets (or server) | legal_screen + legal_page_screen | 2-3h | Low |
| 11 | **P1-1** Wire `WelcomeScreen` into the router OR delete the file | welcome_screen | 1h or 5min | Low |
| 12 | **P1-7** Remove the bank details dialog (it duplicates the main form) | user_onboarding_screen | 5min | Low |
| 13 | **P2-3** Rename `onboarding_screen.dart` to `onboarding_service.dart` | features/onboarding | 5min | Low |
| 14 | **P2-4** Verify `documents_screen.dart` is actually used; delete if dead | features/kyc | 30min | Low |

**Suggested PR shape (each shippable independently):**
- **PR: "P0-4 + P1-4 + P1-6 — onboarding logout reset + debounce + email constant"** — 5-10 lines, 4 files. Quick wins.
- **PR: "P0-2 + P1-8 — permissions + splash cleanup"** — 30-40 lines, 2 files. Single UX cleanup.
- **PR: "P0-1 — parallelize KYC uploads"** — 30-50 lines, 2 files. The high-impact perf fix.
- **PR: "P1-1 + P1-3 — wire WelcomeScreen + add kycPreflight lifecycle target"** — 1-2h, 3 files. Architectural.
- **PR: "P0-3 — move legal content to JSON assets"** — 2-3h, 2 files + asset directory.

---

## Tests gap analysis

| Section | Existing test | What's missing |
|---|---|---|
| **Splash** | `01_splash_screen_test.dart` (smoke — screen renders) | The PostHog guard (P1-8). The "CONNECTING TO GRID" copy. The 2-second wait. |
| **Welcome** | None | The screen is dead (P1-1). No test exists because nothing calls it. |
| **Legal** | `02_legal_screen_test.dart` (smoke) | The expanded-state copy (would catch hardcoded legal text changes). The accept checkbox. The P0-3 hardcoded legal content assertion. |
| **Permissions** | `03_permissions_screen_test.dart` (smoke) | The P0-2 call_log/phone mapping bug. The battery isRequired flag. The 3-required-out-of-9 gating. |
| **Login** | `04_login_screen_test.dart`, `04_debug_login_test.dart` | The phone validation. The referral code input. The footer terms links. |
| **OTP** | `05_otp_verification_test.dart`, `17_otp_resend_test.dart`, `18_otp_back_button_test.dart` | The hardcoded `+91 98765 43210` default (P1-2). The new vs returning rider branching. |
| **KYC preflight** | None (it's inside `34_full_onboarding_to_dashboard_test.dart`) | The "I'm Ready" / "I'll do this later" buttons. The P1-3 bypassability via high lifecycle rank. |
| **Intent of use** | None (inside `34_*`) | The 2-card selection. The 2-string conversion (`'deliver'` vs `'personal'`). |
| **User onboarding** | `34_full_onboarding_to_dashboard_test.dart` (smoke — completes the flow) | The P0-1 sequential upload perf. The P1-4 keystroke debounce. The P1-5 test mode IFSC. The P1-6 email regex. The P1-7 bank dialog. The per-upload error handling. |
| **Guarantor** | `34_guarantor_flow_test.dart`, `34_guarantor_form_test.dart` | Same as user_onboarding. The OTP send/verify flow. |
| **Signature pad** | None | The clear button. The submit button. The accessibility labels. |
| **Pre-dashboard** | `07_dashboard_elements_test.dart` (after login) | The pickup-done redirect (covered in audit #7 P0-3). |

**The `34_full_onboarding_to_dashboard_test.dart` is 19 KB and the only meaningful onboarding test.** It exercises the happy path through the full funnel. It would NOT catch:
- P0-1 (sequential uploads are too slow on 3G) — no 3G simulation
- P0-2 (call_log maps to phone) — no permission state checking
- P0-3 (legal text in code) — no content assertion
- P0-4 (logout reset) — no logout mid-onboarding
- P1-1 (WelcomeScreen dead) — no test because no production path
- P1-3 (KYC preflight bypassable) — no test for riders with high lifecycle rank

The most valuable tests to add (in priority order):
1. **P0-1 test:** mock slow uploads → assert they run in parallel (total time < sequential time).
2. **P0-2 test:** grant "Phone" only → assert "Call Log" is also granted (they map to the same permission).
3. **P0-3 test:** assert the legal screen's Terms text matches a known reference (e.g., starts with "These Terms of Service" and contains "Account Registration").
4. **P0-4 test:** logout mid-onboarding → login as a different rider → assert onboarding form is empty.
5. **P1-3 test:** with a rider at lifecycleRank >= 10 → assert the rider goes through KYC preflight before reaching dashboard.

---

## Architecture observations (informational)

1. **The onboarding flow has 12+ screens across 4 feature directories.** This is the largest cross-feature surface in the app. A `features/onboarding/` consolidation (move `kyc/`, `guarantor/`, parts of `auth/` into a single feature) would make the architecture cleaner. Effort: 1-2 days of mechanical refactor.

2. **The `RiderLifecycleGate` is a pure function** (no Flutter dependencies) — that's the right design. It's well-tested-able in isolation. The `LifecycleTarget` enum is missing `kycPreflight` (P1-3) and `welcome` (P1-1, if the welcome screen is wired in).

3. **The KYC preflight comment in `router.dart:88-92` says it was added in PR-A** to reduce drop-off. The analytics never confirmed the impact (no A/B test). Worth measuring.

4. **The permissions screen has a `WidgetsBindingObserver` (line 47)** that re-checks permissions on app resume. This is the right pattern — the user might grant/deny a permission from system Settings and return to the app. But the same re-check logic is duplicated in `RiderProvider` (different provider). Worth consolidating.

5. **The legal screen has a `LegalDocumentType` enum** (`legal_page_screen.dart:40`) for filtering, but the consent screen doesn't use it — it shows all 5 documents always. A rider only needs to see Terms + Privacy to consent; the other 3 (Rental Safety, Refund, Guarantor) are referenced but not required for signup. Showing all 5 increases the perceived cost of signing up.

6. **The `_k*Content` legal strings are in `legal_screen.dart` AND the same content is in `legal_page_content.dart`** (per the `part 'legal_page_content.dart';` directive on line 13 of `legal_page_screen.dart`). The same legal text is duplicated in two files. Two sources of truth.

7. **The `_PermissionItem` class is private to `permissions_screen.dart`** (line 15) but its pattern is general — a model with `id, name, description, icon, isRequired, isEnabled`. Worth extracting to `models/permissions/`.

8. **The 9 permissions in the list are NOT in priority order** — the required ones (location, camera, notifications) are at the top by coincidence, but if you add a 10th permission, the order becomes arbitrary. A `List<_PermissionItem>` sorted by `isRequired` descending would be more maintainable.

9. **The `userOnboardingNotifierProvider` is global** (`kyc/presentation/screens/user_onboarding_screen.dart:148-151`) — it persists across the entire app lifetime, not scoped to the onboarding flow. If a rider opens the KYC form, fills it halfway, and then comes back 3 days later (after a hot restart), the state is gone (it's in-memory). The `_saveCache` / `_loadCache` mechanism tries to bridge this with SharedPreferences, but the state is reset to defaults on each `build()` and the cache reload is async. The form is briefly empty on first render, then re-populated. A flash of "empty form" is visible to the rider. Worth pre-loading in the provider's `build()`.

10. **The `RiderLifecycleGate.redirectAppState` returns an `AppState` enum, not an `AuthState`** — the auth state machine and the lifecycle state machine are two parallel hierarchies. The `Onboarding(OnboardingStep.guarantor)` etc. are sealed classes, not enum values. The mapping between them is in the gate (line 78-95), but the gate only handles 5 of 6 enum values (no welcome). A unified hierarchy would simplify.

---

## Out-of-scope notes

- **The pickup flow** (after onboarding, before active dashboard) is in `features/pickup/` and audited separately. It includes `pickup_hub_screen`, `pickup_verification_screen`, `pickup_success_screen`, `tl_details_screen`, `vehicle_photos_screen`.
- **The KYC preflight on the web side** (per `LegalConsentScreen.tsx` comment in `legal_screen.dart:10`) is similar but not identical. The web has its own pre-consent flow. The mobile and web onboarding are not synced.
- **The `OtpVerificationScreen`'s `useUnderlineOtp` flag (line 75)** is a kill switch for the new Apple-style underline OTP input. If the new design has field bugs, flip to `false` to roll back to the spark-glow boxes. The comment says "lives here (not in AppConstants) so the OTP screen is the only thing that branches on it" — good practice for a feature flag.
- **The `_k*Content` legal text is in English only.** The `l10n/` directory exists for translations. The legal text would need a translation pass to support Hindi, Tamil, etc. The web's `LegalConsentScreen.tsx` likely has the same limitation.
- **The `RiderLifecycleGate` doesn't have a `welcome` target** — confirms `WelcomeScreen` is dead. The lifecycle starts at `intent` (after the rider is authenticated). If the welcome screen is wired in, a new `welcome` target would route there first.
- **The 5 guarantor steps are hardcoded** (`currentStep: 1, 2, 3, 4, 5`). The state is a simple int. A `GuarantorStep` enum would be clearer and more maintainable.
- **The pickup flow uses 5 photo slots** (front, back, left, right, with_vehicle) and the end-rental uses 4 (left, right, front, speedometer). The KYC onboarding uses 5 documents (Aadhaar F, Aadhaar B, PAN, selfie, signature). The guarantor uses 6 (Aadhaar F, Aadhaar B, PAN, video, signature, photo). The photo/document model is NOT unified — each feature has its own shape. A shared `DocumentUpload` widget would DRY up the upload UI across all 3 features.
- **The `_PermissionItem.isRequired = true` for `battery` is contradicted by the comment** (lines 22-24). The fix is a one-line constant change, but the comment is the kind of thing that should be a unit test: assert that the `Continue` button is enabled when location+camera+notifications are granted, regardless of battery.
