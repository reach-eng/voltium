# Deep Audit — Flutter Rider App: Permission, Splash & Terms & Conditions

**Date:** 2026-08-05
**Scope:** Permission screen (`features/onboarding/presentation/screens/permissions_screen.dart`), Splash screen (`features/onboarding/presentation/screens/splash_screen.dart`), Terms & Conditions (`features/onboarding/presentation/screens/legal_screen.dart` + `legal_page_screen.dart` + `legal_page_content.dart`) and all related sub-screens.
**Auditor:** Mavis (third-party code review)
**Branch:** `feat/ux-2-loading-haptics` (HEAD = `6f6c8b30`)

> The user is a physical tester, not a developer. All findings below are framed in user-visible terms ("the rider sees…", "tapping X does Y") and reproducible device scenarios, not code-level metrics.

---

## TL;DR

**9 P0s, 19 P1s, 22 P2s, 26 P3s, 14 test gaps, ~700 lines of dead code, ~600 lines of "fake UI" (taps that don't do what they claim).**

The most concerning findings:

1. **"Download Signed PDF" doesn't generate a PDF.** It opens the system share sheet with plain text. The rider expects a signed PDF document, gets a text snippet. **The button label is a lie.**
2. **The legal copy is hardcoded in two places, and the two copies disagree.** `legal_screen.dart` and `legal_page_screen.dart` have different versions of the same terms. The "Terms of Service" shown in the acceptance screen is NOT the same as the "Terms of Service" in the full document viewer. **Regulatory risk.**
3. **Legal acceptance is not persisted.** When the rider taps "I agree", the local state is set and a PostHog event fires, but nothing is written to SharedPreferences, SecureStorage, or the backend. **Returning riders see the legal screen every time and the "I agree" state resets.**
4. **Permission grant is not synced to the backend for 8 of 9 permissions.** Only Location consent is sent to `/api/rider/consent`. Camera, mic, contacts, phone, call_log, battery, device_admin are all locally tracked but never reported. **Compliance gap.**
5. **`call_log` permission requests `Permission.phone` instead.** The `permission_handler` plugin doesn't have a `Permission.callLog` API. The team is requesting phone permission under the name of call_log. The rider sees "Call Log" in the toggle, grants it, but only `READ_PHONE_STATE` is requested. **Misleading UI.**
6. **`SplashScreen` forces 4.5 seconds of waiting on every cold start** even for returning users with cached state. Cannot be skipped.
7. **Two screen files duplicate the same onboarding** (`WelcomeScreen` 222 lines + `OnboardingScreen` 201 lines = 423 lines of dead code). The live flow uses `SplashScreen → KycPreflightScreen → LegalScreen → PermissionsScreen → LoginScreen`, never instantiating either.
8. **The 5-section legal accordion only lets one section be expanded at a time.** Riders can accept without ever expanding (and thus reading) 4 of the 5 documents. **Legal enforcement gap.**

---

## 1. Files Audited (13 files, ~3,000 lines)

### Splash / Welcome / Onboarding (3 files, ~700 lines)
- `flutter/lib/features/onboarding/presentation/screens/splash_screen.dart` (280 lines) — **live, forced 4.5s sequence**
- `flutter/lib/features/onboarding/presentation/screens/welcome_screen.dart` (222 lines) — **DEAD CODE** — never instantiated
- `flutter/lib/features/onboarding/presentation/screens/onboarding_screen.dart` (201 lines, includes `OnboardingService`) — **DEAD CODE** — never instantiated

### Permissions (1 file, 516 lines)
- `flutter/lib/features/onboarding/presentation/screens/permissions_screen.dart` (516 lines) — **live**

### Terms & Conditions (3 files, ~1,300 lines)
- `flutter/lib/features/onboarding/presentation/screens/legal_screen.dart` (535 lines) — **live, acceptance screen**
- `flutter/lib/features/onboarding/presentation/screens/legal_page_screen.dart` (670 lines) — **live, document viewer + "PDF download"**
- `flutter/lib/features/onboarding/presentation/screens/legal_page_content.dart` (94 lines) — `part of` legal_page_screen

### Supporting services (1 file, 48 lines)
- `flutter/lib/services/consent_service.dart` (48 lines) — `ConsentService` + `ConsentType` enum

### Platform helpers (1 file, 26 lines)
- `flutter/lib/core/platform/platform_info.dart` (26 lines)

### KYC pre-flight (1 file, 258 lines)
- `flutter/lib/features/onboarding/presentation/screens/kyc_preflight_screen.dart` (258 lines) — covered in 9th audit

### Router / auth state machine (referenced)
- `flutter/lib/app/router_body.dart` — auth state machine
- `flutter/lib/app/router.dart` — route registration

### Tests (8 files, ~500 lines)
- `flutter/test/splash_screen_test.dart` (60 lines) — 2 widget tests
- `flutter/test/widgets/splash_screen_golden_test.dart` (21 lines) — 1 golden test
- `flutter/test/onboarding/onboarding_flow_test.dart` (90 lines) — 4 widget tests (mostly dead)
- `flutter/test/features/onboarding/kyc_preflight_screen_test.dart` (36 lines) — 4 tests
- `flutter/test/screens/kyc_preflight_screen_test.dart` (75 lines) — **DUPLICATE** of above
- `flutter/test/features/onboarding/presentation/screens/goldens/legalpagescreen_golden.png` (asset)
- `flutter/test/features/onboarding/presentation/screens/goldens/legalscreen_golden.png` (asset)
- `flutter/test/features/onboarding/presentation/screens/goldens/permissionsscreen_golden.png` (asset)
- `flutter/integration_test/e2e/onboarding_flow_test.dart` (205 lines) — 10 E2E tests
- `flutter/integration_test/helpers/test_helpers.dart` (619 lines) — `handlePreamble()`, `fullLoginFlow()`

---

## 2. P0 — Critical findings (9)

### P0-1. "Download Signed PDF" is a fake button — it shares plain text

**User-visible:** Legal Page → expand "Terms of Service" → tap "Download Signed PDF" → system share sheet opens with a single line of text: `"Terms of Service — Voltium Electric Mobility\nSigner: Test Rider\nDate: 05 August 2026\nDocument: Terms of Service"`. **No PDF is generated. The signature image is not embedded. The actual legal text is not in the share.**

**Location:** `flutter/lib/features/onboarding/presentation/screens/legal_page_screen.dart:130-163`

```dart
Future<void> _downloadSignedPdf(_LegalSection section, RiderModel? rider) async {
  // ...
  await SharePlus.instance.share(
    ShareParams(
      text: '${section.title} — Voltium Electric Mobility\n'
            'Signer: $signerName\n'
            'Date: $_currentDate\n'
            'Document: ${section.title}',
      title: '${section.title} — $_kBrandShort',
    ),
  );
  // ...
}
```

**Why it matters:**
- The button label is "Download Signed PDF" — the rider expects a PDF file.
- The share text is 4 lines of metadata, NOT the legal text, NOT the signature.
- The "Signed by" card above shows the actual signature image, but the share doesn't include it.
- If the rider wants to share the document with their lawyer, they get a useless text snippet.

**Reproducible device scenario:**
1. Settings → Terms of Service → tap "Terms of Service" → expand
2. Tap "Download Signed PDF" (blue button at bottom)
3. **Observed:** Android share sheet opens with text "Terms of Service — Voltium Electric Mobility\nSigner: Test Rider\n..." — no PDF, no signature.

**Fix shape (4-8 hours):** use a real PDF generation library (`pdf` package + `printing` package) to:
- Build a 1-page PDF with the section title, body, and a base64-embedded signature image
- Save to a temp file
- Use `SharePlus.instance.share(ShareParams(files: [XFile(pdfPath)]))`

**Risk if not fixed:** Riders cannot save a copy of what they agreed to. Lawyers and courts cannot verify the agreement. Regulatory non-compliance.

---

### P0-2. The two "Terms of Service" copies are different

**User-visible:** The legal acceptance screen (`legal_screen.dart`) shows a 5-paragraph "Terms of Service" with 5 numbered sections. The full document viewer (`legal_page_screen.dart`) shows a different 8-paragraph "Terms of Service" with 8 numbered sections. **The text the rider agrees to is NOT the same as the text they can read in detail.**

**Location:**
- `legal_screen.dart:21-22` — `_kTermsContent` (5 paragraphs, 5 sections: Account Registration, Vehicle Rental, Safety, Payment, Liability)
- `legal_page_content.dart:14-36` — `_sections[0].content` (8 paragraphs, 8 sections: Service Description, Eligibility, Rental Period, User Responsibilities, Payment, Termination, Liability, Governing Law)

**The 5-paragraph version is in `legal_screen.dart:21-22`. The 8-paragraph version is in `legal_page_content.dart:14-36`.** They cover different topics and have different legal language.

**Why it matters:**
- The rider taps "I have read and agree to the Terms of Service" (5-paragraph version).
- If they tap the link, they get a DIFFERENT document (8-paragraph version) — and may not realize the mismatch.
- The legal text is unenforceable because the rider agreed to one document but was shown another.

**Reproducible device scenario:**
1. Legal acceptance screen → expand "Terms of Service" → read 5 paragraphs about account registration, vehicle rental, etc.
2. Tap "I have read and agree to the Terms of Service" link in the footer
3. **Observed:** Opens `LegalPageScreen` with 8-paragraph "Terms of Service" about service description, eligibility, rental period, etc. — totally different document.
4. Tap "Back" → accept → continue onboarding
5. **The rider has "agreed" to a document they never saw.**

**Fix shape (1-2 hours):** consolidate to a single source of truth. Either:
- Move the legal content strings to `legal_page_content.dart` and have `legal_screen.dart` import them
- Or use a single constant per document, referenced from both places

**Risk if not fixed:** Legal challenge from any rider. The "agreement" is meaningless because the rider didn't agree to the document they were shown in detail.

---

### P0-3. Legal acceptance is not persisted anywhere

**User-visible:** Rider goes through onboarding, accepts the terms, completes onboarding. The next time they open the app (or get pushed back to the legal screen for any reason), the `_accepted` boolean is false again. The rider has to re-accept every single time. **The "I have read and agree" is a button press, not a stored commitment.**

**Location:** `flutter/lib/features/onboarding/presentation/screens/legal_screen.dart:75-88`

```dart
void _toggleAccepted() {
  setState(() => _accepted = !_accepted);
  // No SharedPreferences, no SecureStorage, no API call
  if (_accepted) _checkCtrl.forward();
}

void _handleContinue() {
  if (!_accepted) return;
  PostHogService.capture('legal_accepted');  // ← analytics only
  widget.onNext?.call();
}
```

The only persistence is:
- `PostHogService.capture('legal_accepted')` — analytics, not state
- Local `_accepted` boolean — lost on screen rebuild, navigation, app restart

**Why it matters:**
- The router flow at `router_body.dart:118-124` only navigates to the next state. It doesn't save the accepted state to `CacheService` or the rider profile.
- If the rider is bounced back to `AuthState.legal` (e.g. due to a session refresh or a new build), they see the legal screen again and have to re-accept.
- The PostHog event fires for EVERY acceptance — so a rider who gets bounced back 3 times fires 3 events. Analytics pollution.

**Reproducible device scenario:**
1. First-time onboarding → see legal → expand "Terms of Service" → check the box → Continue
2. Complete onboarding
3. Force-kill the app, reopen
4. **Observed:** splash → KYC preflight → **LEGAL SCREEN AGAIN**. The "I agree" box is unchecked. The rider has to re-accept.

**Fix shape (1-2 hours):**
- Save acceptance to `SharedPreferences`: `await prefs.setBool('legal_accepted_v1', true);` with the policy version (e.g. `legal_accepted_v1`, `legal_accepted_v2` for future versions)
- Optionally POST to `/api/rider/legal/accept` for backend audit
- In the router, check `legal_accepted_v1` before showing the legal screen
- If the legal copy changes (new version), reset the flag

**Risk if not fixed:** Riders see the legal screen multiple times. Each acceptance fires a PostHog event. No audit trail on the backend.

---

### P0-4. Permission grants for 8 of 9 permissions are not synced to the backend

**User-visible:** Rider grants Location, Camera, Notifications, Microphone, Contacts, Phone, Call Log, Battery Optimization. **None of these grants are sent to the backend.** Only Location is synced via `ConsentService.setConsent(ConsentType.location)`.

**Location:**
- `flutter/lib/features/onboarding/presentation/screens/permissions_screen.dart:172-178` — only Location writes to `ConsentService`:

```dart
if (status.isGranted && mounted) {
  setState(() => perm.isEnabled = true);
  if (perm.id == 'location') {
    await ConsentService()
        .setConsent(ConsentType.location, granted: true);
  }
}
```

- Lines 254-258 (after `_requestPermission`): same — only Location.

**Why it matters:**
- The backend has no record of which permissions the rider has granted.
- If the rider uninstalls and reinstalls, the consent flag in `SharedPreferences` is gone (only Location is in SecureStorage via `ConsentService`).
- The server can't validate "rider has granted camera permission" before allowing KYC document upload.
- DPDP Act 2023 requires consent audit trails. Only Location is tracked.

**Reproducible device scenario:**
1. Permissions screen → toggle all 9 permissions
2. Check server logs / DB → **only Location consent is recorded**
3. Camera, mic, contacts grants are NOT in the rider's profile

**Fix shape (2-4 hours):**
- Add new `ConsentType` values: `camera, microphone, contacts, phone, callLog, battery, deviceAdmin, notifications`
- Call `ConsentService().setConsent(...)` for each granted permission
- Add API endpoint validation on the server side

**Risk if not fixed:** Compliance gap. The team says "we ask for permissions" but doesn't track them.

---

### P0-5. `call_log` permission requests the wrong system permission

**User-visible:** Permissions screen → "Call Log" toggle → rider taps Allow → Android system dialog asks for "Phone" permission (not "Call Log"). The rider has no idea what was actually granted. **The UI says "Call Log" but the system says "Phone".**

**Location:** `flutter/lib/features/onboarding/presentation/screens/permissions_screen.dart:158-160, 234-236`

```dart
// _checkInitialStatuses:
case 'call_log':
  status = await Permission.phone.status;  // ← wrong permission
  break;

// _requestPermission:
case 'call_log':
  status = await Permission.phone.request();  // ← wrong permission
  break;
```

**Why it matters:**
- `permission_handler` doesn't have a `Permission.callLog` API. To access call logs on Android, the app needs `READ_CALL_LOG` separately, which `permission_handler` doesn't expose.
- The team is requesting phone permission (which is `READ_PHONE_STATE` only) under the name of "Call Log".
- The rider thinks they granted call log access, but the app only has `READ_PHONE_STATE`.
- This is a **misleading UI**: the toggle says "Call Log — Access call logs for ride safety features" but only `READ_PHONE_STATE` is requested.

**Reproducible device scenario:**
1. Permissions screen → "Call Log" → tap Allow
2. **Observed:** Android dialog says "Allow Voltium to make and manage phone calls?" (or similar)
3. The actual permission granted is `READ_PHONE_STATE`, NOT `READ_CALL_LOG`
4. If the app later tries to read call logs, it will fail silently

**Fix shape (2-4 hours):**
- Either remove the "Call Log" entry from the permissions list (the app doesn't need it)
- Or implement a custom permission request flow that uses Android's `READ_CALL_LOG` directly via platform channels
- Or use a different permission library that exposes `READ_CALL_LOG`

**Risk if not fixed:** UI lies to the rider. The feature can't actually work because the wrong permission is requested.

---

### P0-6. `SplashScreen` forces 4.5 seconds of waiting on every cold start

**User-visible:** Every time the app is cold-started (process killed, reopen), the rider sees a logo animation for 1.2s, text fade for 0.8s, progress bar for 1.5s, then waits 2s for "CONNECTING TO GRID" text. **Total 4.5 seconds before any interaction is possible.** Returning users with cached state wait the same 4.5 seconds.

**Location:** `flutter/lib/features/onboarding/presentation/screens/splash_screen.dart:84-108`

```dart
Future<void> _startSequence() async {
  PostHogService.capture('splash_viewed');
  // ...
  await Future.delayed(const Duration(milliseconds: 200));
  if (!mounted) return;
  _logoCtrl.forward();
  await Future.delayed(const Duration(milliseconds: 500));
  if (!mounted) return;
  _textCtrl.forward();
  await Future.delayed(const Duration(milliseconds: 300));
  if (!mounted) return;
  _barCtrl.forward();
  await Future.delayed(const Duration(milliseconds: 2000));
  if (mounted) widget.onComplete();
}
```

**Why it matters:**
- The user can't tap to skip.
- Returning users with cached state should be sent to the dashboard in < 1s. The 4.5s wait is unnecessary for them.
- The team is hiding the cold-start time behind a "loading" animation. This is a known anti-pattern that hurts retention.

**Reproducible device scenario:**
1. Open the app → see logo animation → wait 4.5s → land on KYC preflight (or dashboard)
2. **Observed:** 4.5 seconds of forced wait, no skip button, no progress indicator (just "CONNECTING TO GRID" text)

**Fix shape (1-2 hours):**
- Check `CacheService.getCachedRider()` synchronously in `SplashScreen.initState` (already initialized via `CacheService().init()` in main)
- If cached rider exists, skip the animation and call `widget.onComplete()` immediately
- For new users, keep the animation but make it 2s instead of 4.5s
- Add a tap-to-skip on the splash image

**Risk if not fixed:** Returning riders get frustrated by the 4.5s wait on every app open.

---

### P0-7. Two screen files duplicate the same onboarding (WelcomeScreen + OnboardingScreen)

**User-visible:** Not directly visible to the rider, but the codebase has two complete onboarding implementations that are NEVER instantiated:
- `WelcomeScreen` (222 lines) — "Welcome to Voltium" gradient screen with consent bottom sheet
- `OnboardingScreen` (201 lines) — Generic `PageView` with `OnboardingPage`s and `OnboardingService` for first-launch detection

**Location:**
- `flutter/lib/features/onboarding/presentation/screens/welcome_screen.dart` — never imported in `app/router.dart` or `app/router_body.dart`
- `flutter/lib/features/onboarding/presentation/screens/onboarding_screen.dart` — never imported
- `flutter/lib/features/onboarding/presentation/screens/onboarding_screen.dart:8-55` — `OnboardingService` singleton with `isOnboardingComplete()` / `setOnboardingComplete()` / `isFirstLaunch()` / `shouldShowTutorial()` / `resetOnboarding()` — all dead methods

**Why it matters:**
- 423 lines of dead code, 0 callers.
- The router's `AuthState` enum has `splash, kycPreflight, legal, permissions, ...` — no `welcome` or `onboarding` state.
- The "Welcome to Voltium" screen is the canonical entry point for a new rider, but the team built two variants and shipped neither.
- New developers will be confused about which one to use.

**Reproducible device scenario:**
- Search for `WelcomeScreen(` or `OnboardingScreen(` in `lib/app/` → **0 matches**

**Fix shape (30 min):** delete both files. The live flow uses `SplashScreen → KycPreflightScreen → LegalScreen → PermissionsScreen`.

**Risk if not fixed:** Maintenance burden. New devs may try to use them.

---

### P0-8. Legal accordion enforces only ONE section open at a time, allowing riders to accept without reading

**User-visible:** Legal screen → 5 sections (Terms, Privacy, Rental & Safety, Refund, Guarantor). Tap a section header → expands. Tap another section header → first one collapses. The user can expand ONE section, see its content, and accept without ever reading the other 4.

**Location:** `flutter/lib/features/onboarding/presentation/screens/legal_screen.dart:48, 304`

```dart
String? _expandedId;  // ← single nullable, only one section can be expanded

// In _buildExpandableSection:
final isExpanded = _expandedId == id;
// ...
onTap: () {
  setState(() => _expandedId = isExpanded ? null : id);
},
```

**Why it matters:**
- The acceptance footer says "I have read and agree to the Terms of Service and Privacy Policy" — but the rider is only required to expand the LAST section they tapped, not all of them.
- With `maxHeight: 280` and `SingleChildScrollView`, the rider can claim to have read a section by scrolling for 0.5 seconds.
- The 3 other documents (rental_safety, refund, guarantor) are shown but not enforced as read.
- **Legal risk:** a rider could claim they "agreed" without ever opening the rental safety agreement that says "wear a helmet at all times".

**Reproducible device scenario:**
1. Legal screen → expand "Terms of Service" → scroll for 1 second → check the box → Continue
2. **Observed:** Rider proceeds to Permissions screen without ever expanding Privacy Policy, Rental Safety, Refund, or Guarantor agreements.

**Fix shape (1-2 hours):**
- Track a `Set<String> _expandedIds` instead of a single `_expandedId`
- Allow multiple sections to be expanded simultaneously
- Add a "You must expand all sections before accepting" check in `_handleContinue`
- Or: require the rider to scroll to the bottom of each section before marking it as "read"

**Risk if not fixed:** Legal enforceability. The rider's "agreement" is meaningless if they never read the documents.

---

### P0-9. "Call Log" toggle in the permissions list is misleading

**User-visible:** Already covered in P0-5. Listed separately here because of the **misleading UI** (the toggle says "Call Log" but grants Phone).

**Reproducible device scenario:**
1. Permissions screen → "Call Log" toggle → tap Allow
2. **Observed:** Android dialog says "Phone" permission, not "Call Log"
3. **The user has no idea what they actually granted.**

**Fix shape:** Either rename the toggle to "Phone" (matching the actual permission) OR remove it from the list (the app doesn't actually need call log access — it should be `READ_PHONE_STATE` only).

---

## 3. P1 — High (19)

### P1-1. `PermissionsScreen` has inconsistent `isRequired` flag
Lines 33 (default `isRequired: true`) and 68 (battery `isRequired: true` explicitly). The other 8 permissions are also `isRequired: true` (default). The comment at line 22-25 says battery is "not required" but the code says it IS required. **Comment lies, code is what runs.**

### P1-2. The "Continue" button is disabled until Battery Optimization is granted (in production)
Line 451: `final canProceed = allRequiredGranted || isTestMode;` — only `isTestMode` or ALL required permissions granted. Since only battery is `isRequired: true` (per the data), the rider MUST grant battery to proceed. **Hidden requirement — the UI doesn't say "Battery is required to continue".**

### P1-3. The `Continue` button is enabled if `isTestMode = true`, even if no permissions are granted
Line 451: same line. In E2E test mode, the rider can skip all permissions. This is correct for testing but means a production build with `isTestMode = true` accidentally set has no permission gating.

### P1-4. `PermissionsScreen._checkInitialStatuses` doesn't check `call_log` correctly
Line 159: `status = await Permission.phone.status;` — uses phone permission for call_log. The plugin returns the same status for both, so the toggle becomes green if the user has granted phone. But the user has no idea why.

### P1-5. `PermissionsScreen._checkInitialStatuses` race condition with build
The `setState` at line 173 fires on every successful status check. The build at line 271-273 also writes to `_permissions`. If a status changes mid-build, the widget tree is in an inconsistent state. **Minor race.**

### P1-6. `PermissionsScreen` doesn't handle `Permission.ignoreBatteryOptimizations` on iOS
iOS doesn't have battery optimization. The plugin returns `PermissionStatus.denied`. The `isRequired: true` flag means the rider can NEVER proceed on iOS. **iOS users are blocked at the permissions screen.**

### P1-7. `PermissionsScreen` re-checks all 9 permissions on every `AppLifecycleState.resumed`
Line 130. If the rider goes to Android Settings, grants a permission, returns to the app, the entire `_checkInitialStatuses` runs again. On a slow device, this is 1-2 seconds of re-checks.

### P1-8. `PermissionsScreen` custom toggle doesn't look like a Material `Switch`
Lines 399-443 — a 48×24 `AnimatedContainer` with `AnimatedAlign` for the thumb. The thumb is just a white circle with a small shadow. **Riders are used to Material switches with raised thumbs and on/off labels.** This looks like a custom slider.

### P1-9. `PermissionsScreen` has 9 permissions but only battery is required; the UI implies all are required
The list looks like a checklist — the rider thinks they must check all 9 to proceed. The actual logic is "any one of battery". **Confusing UX.**

### P1-10. `PermissionsScreen` "Device Admin" toggle is the most obscure permission
Line 100-105. The description "Required for fleet security and remote lock features" doesn't explain what device admin does. Riders will be scared. **Need a help icon or longer explanation.**

### P1-11. `SplashScreen` PostHog `splash_viewed` fires on every cold start
Line 85. For a returning user, this fires on every app open. Should be `splash_viewed_first_time` for first launch, `splash_viewed_returning` for subsequent.

### P1-12. `SplashScreen._startSequence` has an empty `try { } catch (_) {}` block
Lines 88-92. The comment says "Hydrate background caches" but the body is empty. **Dead code, 6 lines.**

### P1-13. `SplashScreen.didChangeDependencies` precaches 2 images
Lines 75-80 — `assets/logo.png` and `assets/images/vehicle_placeholder.png`. If either is missing, the `precacheImage` call throws. The `.catchError((_) {})` swallows the error silently. **The splash image may fail to load and the rider sees a broken logo.**

### P1-14. `LegalScreen` does not save which sections the rider expanded
The acceptance fires `PostHogService.capture('legal_accepted')` with no properties. The PM has no idea if riders actually read the documents. **Analytics blind spot.**

### P1-15. `LegalScreen` content strings are hardcoded multi-paragraph constants
Lines 21-34. 5 large multi-paragraph strings live in the Dart binary. If the legal text changes, the app must be re-released. **Regulatory risk + maintenance burden.**

### P1-16. `LegalScreen` doesn't enforce scrolling through expanded sections
Each expandable section has `maxHeight: 280` and `SingleChildScrollView`. The rider can claim to have read by scrolling for 0.5 seconds. **No "scroll to bottom" enforcement.**

### P1-17. `LegalPageScreen._downloadSignedPdf` includes no legal text in the share
Lines 144-150 — the share text is only the title, signer name, and date. The actual section content is not in the share. **The rider shares an empty document.**

### P1-18. `LegalPageScreen` has `LegalDocumentType` enum with 5 values but `_sections` has only 4
`legal_page_screen.dart:40` — `enum LegalDocumentType { all, terms, privacy, refund, guarantor }` (5 values).
`legal_page_content.dart:14-93` — `_sections` has `terms, privacy, refund, guarantor` (4 sections).
**No `rental_safety` section in `_sections`. But `legal_screen.dart` has a `rental_safety` section in its 5-section accordion.** Cross-screen inconsistency.

### P1-19. `LegalPageScreen` "Need Help?" card has hardcoded email and phone
Lines 553, 561. `_kSupportEmail = 'support@voltium.app'`, `_kSupportPhone = '+91 1800-889-VOLT'`. **Same hardcoded-value problem flagged in 8 Flutter audits.**

---

## 4. P2 — Medium (22)

### P2-1. `PermissionsScreen` doesn't localize any text
Lines 287-299, 374, 383, 493. All text is hardcoded English. The app supports Hindi (per settings screen), but the permissions screen is fully English.

### P2-2. `PermissionsScreen` permission names and descriptions are hardcoded
Lines 51-105. The 9 permission items are in a private `_PermissionItem` list. No way to localize without code changes.

### P2-3. `PermissionsScreen._buildToggle` uses `perm.id.capitalize()` (extension on String)
Lines 401 + 513-516. The capitalize extension handles empty strings but doesn't handle underscore-separated values. If `perm.id = 'call_log'`, the key is `'allowCall_logButton'` (lowercase L). **Bug — should be `'allowCallLogButton'`.**

### P2-4. `PermissionsScreen` `_checkInitialStatuses` loop has 9 sequential `await` calls
Line 136-180. Each iteration awaits one permission check. On a slow device this can take 1-2 seconds. Should be `await Future.wait(...)`.

### P2-5. `PermissionsScreen._requestPermission` for 'device_admin' returns before setState
Line 245 — `return;` exits the function before `setState(() => item.isEnabled = ...)` is called. The `isEnabled` is set in `build` from `devPolicy.isAdminActive`. **Works but the update is delayed until next rebuild.**

### P2-6. `PermissionsScreen` for 'battery' uses `setState` and then `return;` — OK pattern
Line 240-242. The `setState` is called inside the `if (mounted)`, and then the function returns. Subsequent code (lines 250-263) is bypassed. **OK.**

### P2-7. `PermissionsScreen` doesn't show the "Permanently denied" state clearly
Line 261-263 — if `status.isPermanentlyDenied`, opens app settings. But the UI doesn't show "you need to go to settings" message. The rider sees the toggle stay OFF.

### P2-8. `PermissionsScreen` `onTap` for the toggle is `() => _togglePermission(perm)`
Line 402. But the parent container is also a `Container` with `color: Colors.transparent` and `padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8)`. **Hit-test area is small (8×24).** Material guidelines recommend 48×48.

### P2-9. `PermissionsScreen` Continue button is a `GestureDetector` not a `Button`
Line 465-507. No accessibility role, no keyboard support, no `Material` ink ripple. Should be an `ElevatedButton` with `style: ...`.

### P2-10. `PermissionsScreen` "Continue" doesn't have a loading state
When tapping Continue, the next screen loads. The rider sees a brief blank screen during navigation. Should have a transition animation.

### P2-11. `SplashScreen` has 3 separate `AnimationController`s for the logo, text, and bar
Lines 35-66. Could be consolidated into 1 controller with multiple `Interval`s. **Minor performance / maintainability.**

### P2-12. `SplashScreen._logoCtrl` duration is 1200ms
Line 37. The actual logo animation only fires `_logoCtrl.forward()` for 500ms (line 98) before the text starts. **The full 1200ms isn't used.**

### P2-13. `SplashScreen` `_barCtrl` is only used for 2000ms
Line 104 forwards the bar controller, then waits 2000ms before `onComplete`. The bar takes 1500ms to fill. **There's 500ms of "bar at 100%" before completion.**

### P2-14. `SplashScreen` has a hardcoded logo asset
Line 157. `'assets/logo.png'`. No fallback. If the asset is missing, the image fails to load.

### P2-15. `SplashScreen` doesn't show the version number or build hash
Other apps (e.g. Twitter, Instagram) show a version in the splash for debugging. Useful when filing support tickets.

### P2-16. `LegalScreen` doesn't save the acceptance timestamp
When `_handleContinue` fires, no `legal_accepted_at` is recorded. If the legal copy changes, the rider's acceptance is not invalidated.

### P2-17. `LegalScreen` has 5 sections but only 2 are linked in the acceptance footer
Lines 451-492. The acceptance footer links to "Terms of Service" and "Privacy Policy" via `LegalDocumentType.terms` and `LegalDocumentType.privacy`. The other 3 sections (rental_safety, refund, guarantor) are not linked.

### P2-18. `LegalScreen` `_kTermsContent` etc. are not validated
The 5 hardcoded legal content strings (terms, privacy, rental_safety, refund, guarantor) total ~5,000 words. No linter checks for typos or legal compliance.

### P2-19. `LegalPageScreen` doesn't have a "Print" option
The "Download Signed PDF" button shares text, not a PDF. A "Print" option would let the rider print the document to a physical printer.

### P2-20. `LegalPageScreen._buildAppBar` has a redundant switch case
Lines 601-603 — `case LegalDocumentType.all: title = 'Legal';` is unreachable because the `if (type == null || type == LegalDocumentType.all)` block above handles `all`.

### P2-21. `LegalPageScreen._visibleSections` is a getter called on every build
Lines 109-126. Each build calls the getter twice (itemCount + itemBuilder). Should be cached.

### P2-22. `WelcomeScreen._requestPermissionsAndContinue` requests Location + Camera silently
Lines 19-27. No rationale shown, no way to decline. The consent bottom sheet (`_showConsentBottomSheet`) shows rationale, but the permission request doesn't.

---

## 5. P3 — Low (26)

### P3-1. `SplashScreen` has no error handling for missing assets
The 2 `precacheImage` calls swallow errors via `.catchError((_) {})`. If both assets are missing, the splash shows a broken logo.

### P3-2. `SplashScreen` doesn't honor the system dark mode
The splash uses `AppColors.surface` which is light. In dark mode, the splash is jarring.

### P3-3. `SplashScreen` has no "skip" button
Riders can't tap to skip the animation.

### P3-4. `SplashScreen` PostHog `splash_viewed` doesn't include `is_first_launch` property
Should be `properties: {'is_first_launch': isFirst}`.

### P3-5. `SplashScreen` has no timeout
If `onComplete` is never called (e.g. due to a bug in the parent), the splash hangs forever.

### P3-6. `SplashScreen._startSequence` has 5 `if (!mounted) return;` checks
Lines 95, 99, 103, 107 (4 actually). Verbose. Could be a helper.

### P3-7. `SplashScreen` animation timing is fragile
The `_logoCtrl.forward()` is called after 200ms wait, then `_textCtrl.forward()` after another 500ms. The visual chain is: 200ms wait → 1200ms logo (but truncated to 500ms wait before next) → 800ms text → 300ms wait → 1500ms bar → 2000ms wait → done. **The 1200ms logo duration isn't fully used; only 500ms is shown.**

### P3-8. `PermissionsScreen` doesn't show a "permission rationale" dialog
Android requires apps to explain why they need a permission BEFORE the first request. The current code just calls `.request()` directly. **Android UX violation.**

### P3-9. `PermissionsScreen` doesn't group permissions by category
9 permissions in a flat list. Could be grouped: "Location & Safety" (location, background, battery), "Communication" (notifications, phone, call_log, mic), "Documents" (camera, storage), "Device Security" (device_admin).

### P3-10. `PermissionsScreen` doesn't show a summary of granted permissions
After granting 5 of 9, the rider has to count manually. A "5 of 9 granted" badge would be useful.

### P3-11. `PermissionsScreen` Continue button doesn't have a label showing what's next
"Continue" is generic. "Continue to Login" or "Continue to Phone Verification" would be clearer.

### P3-12. `PermissionsScreen` has a `Column` inside a `SingleChildScrollView` for the permission list
Lines 280-326. Each permission card has its own animation. When the list is long, scrolling triggers many animations.

### P3-13. `PermissionsScreen` animation curves are all `Curves.easeOutCubic`
Lines 308, 318. No variation. The screen feels mechanical.

### P3-14. `PermissionsScreen` doesn't have a "Skip for now" button
The rider must grant battery to proceed. If they're on a device that doesn't support `ignoreBatteryOptimizations`, they're stuck.

### P3-15. `PermissionsScreen` doesn't have a "Why do we need this?" inline help
Tapping the permission icon should show a longer explanation.

### P3-16. `PermissionsScreen._buildPermissionCard` uses `BoxShadow` on every card
Lines 343-346. 9 cards × 3 shadow layers = 27 shadow renderings. **Performance.**

### P3-17. `PermissionsScreen` uses `AppColors.borderSubtle` for the Continue button disabled state
Line 477. The disabled button is hard to see. Material guidelines suggest 38% opacity.

### P3-18. `PermissionsScreen` doesn't use `Semantics` widgets
The screen is not screen-reader friendly. The custom toggle has no semantic label.

### P3-19. `PermissionsScreen` has no "Required" vs "Optional" badge on each card
The rider doesn't know which permissions are mandatory.

### P3-20. `LegalScreen` has no "Last updated" date on each section
Legal documents should show when they were last updated.

### P3-21. `LegalScreen` doesn't have a "Print" or "Email" option
Riders can't easily share the document.

### P3-22. `LegalScreen` has no version number
If the legal copy changes, riders won't know.

### P3-23. `LegalScreen` _buildExpandableSection uses `RepaintBoundary`
Line 287. Good for performance, but unnecessary if the parent already has one.

### P3-24. `LegalPageScreen` "Signed by" card shows the signer's initials
Line 299. But the initials container is just the first letter. For a name like "Anita Devi", only "A" is shown.

### P3-25. `LegalPageScreen._buildElectronicSignaturePlaceholder` uses an italic font
Line 657. Hard to read on small screens.

### P3-26. `WelcomeScreen` and `OnboardingScreen` (both dead) should be deleted
This is a P0 (P0-7) but also a P3 because no one is using them.

---

## 6. Test Gaps (14)

### Gap-1. `SplashScreen` has only 2 widget tests
`flutter/test/splash_screen_test.dart` — tests: renders + onComplete fires, "CONNECTING TO GRID" label. **No tests for:** skip behavior, PostHog event, animation timing, dark mode.

### Gap-2. `SplashScreen` golden test is broken
`flutter/test/widgets/splash_screen_golden_test.dart` — the test pumps a `Placeholder` instead of `SplashScreen`. The assertion is `find.byType(SizedBox)`. **The test doesn't actually test the splash screen.**

### Gap-3. `PermissionsScreen` has 0 unit/widget tests
The only tests are golden (asset file). No tests for: toggle behavior, `isRequired` logic, `canProceed` calculation, `_checkInitialStatuses` race, `_requestPermission` error handling.

### Gap-4. `LegalScreen` has 0 unit/widget tests
Only golden (asset file). No tests for: checkbox toggle, Continue gating, `expandedId` state, RichText link taps, animation timing.

### Gap-5. `LegalPageScreen` has 0 unit/widget tests
Only golden (asset file). No tests for: section expand/collapse, "Download Signed PDF" share text, filter by `LegalDocumentType`, signature fallback.

### Gap-6. `WelcomeScreen` and `OnboardingScreen` are dead code but have tests
`flutter/test/onboarding/onboarding_flow_test.dart` — 4 tests, but they're for the dead `OnboardingScreen`. Wasted test maintenance.

### Gap-7. `kyc_preflight_screen_test.dart` is duplicated in TWO files
- `flutter/test/features/onboarding/kyc_preflight_screen_test.dart` (36 lines, 4 tests)
- `flutter/test/screens/kyc_preflight_screen_test.dart` (75 lines, 4 tests — a strict superset)
**The first file is dead.** Should delete `test/features/onboarding/kyc_preflight_screen_test.dart`.

### Gap-8. `OnboardingService` (dead) has no tests
The 6 static methods (`isOnboardingComplete`, `setOnboardingComplete`, etc.) are not tested.

### Gap-9. `ConsentService` has no tests
The 2 methods (`hasConsent`, `setConsent`) are not tested. The SecureStorage write and the API call are unverified.

### Gap-10. `OnboardingScreen` tests use `pages: const []`
Line 38 — empty pages list. The tests don't actually exercise the page navigation.

### Gap-11. `LegalScreen` "I agree" checkbox state isn't tested
The 0 tests for `LegalScreen` mean the acceptance flow is unverified.

### Gap-12. `LegalPageScreen._downloadSignedPdf` share text isn't tested
No test verifies the text content of the share.

### Gap-13. `PermissionsScreen._checkInitialStatuses` race isn't tested
The async check that runs in initState has no test for the "flicker" between first frame and post-initState.

### Gap-14. `SplashScreen` doesn't test the `onComplete` callback
`flutter/test/splash_screen_test.dart:34` — `expect(completed, isTrue);` — this DOES test the callback, but the timing is fragile (multiple `pump` calls with magic numbers). If `_startSequence` changes, the test breaks.

---

## 7. Cross-Audit Patterns Confirmed

The following patterns are confirmed in this audit and also appear in the previous 9 audits (cumulative):

| Pattern | This audit | Other audits |
|---|---|---|
| **"Fake UI" — button shows but does something else** | P0-1 ("Download Signed PDF" → text share), P0-5 (Call Log → Phone) | 8th audit (Delete, Password), 9th audit (Address Proof) |
| **Hardcoded values in client** | P1-19 (email, phone), P2-15 (legal content), P3-22 (no version) | 8th audit (v2.1.0), 7th audit (+12%, 5 Days) |
| **String-based field name mapping** | P2-3 (call_log → phone) | 9th audit (kycEditableFields strings) |
| **Dead code: alternative onboarding** | P0-7 (WelcomeScreen + OnboardingScreen = 423 lines) | 9th audit (KycEntity, KycField, PhotoUploadNotifier) |
| **0 PostHog events on a feature** | P1-11 (splash doesn't have first-launch), P1-14 (legal doesn't track sections) | 9th audit (Settings), 8th audit (Profile) |
| **Silent failure on missing assets** | P3-1 (precacheImage swallows) | New pattern |
| **Test file duplication** | Gap-7 (kyc_preflight in 2 files) | 9th audit (kyc_preflight duplicated) |
| **Inconsistent `withValues(alpha:)` vs `withOpacity()`** | Splash uses `withValues` exclusively | Wallet audit (mixed) |
| **Hardcoded multi-paragraph strings in Dart** | P1-15 (legal content in 5 const strings) | New pattern (legal text) |
| **Acceptance not persisted** | P0-3 (legal acceptance is local state only) | New pattern (similar to "fake delete") |
| **Two parallel implementations of the same concept** | P0-2 (legal content in 2 places, different) | 8th audit (KycStatus vs KycDocumentStatus) |
| **Custom toggle instead of Material Switch** | P2-8 (custom AnimatedAlign toggle) | New pattern |
| **Required flag commented wrong** | P1-1 (battery `isRequired: true` but comment says "not required") | New pattern |
| **No localization** | P2-1, P2-2 (entire screen is English) | All 9 audits |
| **No "skip" button on a forced wait** | P0-6 (splash 4.5s), P3-3 (no skip) | New pattern |

---

## 8. Recommended Fix Order

### Single-PR fixes (≤2 hours each, ship-it PRs)

1. **PR-OB-1: P0-7 (delete dead WelcomeScreen + OnboardingScreen + OnboardingService)** — 30 min, 1 PR. ~423 lines of dead code removed.
2. **PR-OB-2: P0-3 (persist legal acceptance)** — 1-2 hours. Add SharedPreferences write + check in router.
3. **PR-OB-3: P0-5 (fix call_log permission)** — 30 min. Either remove from list or rename to "Phone".
4. **PR-OB-4: P0-6 (splash skip + 2s animation)** — 1-2 hours. Check cache, allow tap-to-skip.
5. **PR-OB-5: P1-1 (fix battery isRequired comment + flag)** — 5 min. Make battery `isRequired: false` to match the comment.
6. **PR-OB-6: P1-19 (extract support email/phone to config)** — 30 min. Move hardcoded values to `AppConfig`.
7. **PR-OB-7: P1-2 / P1-6 (iOS battery handling)** — 1 hour. Detect iOS and skip battery requirement.
8. **PR-OB-8: Gap-7 (delete duplicate kyc_preflight test)** — 5 min. Remove `test/features/onboarding/kyc_preflight_screen_test.dart`.

### Multi-PR fixes (1-2 days each)

9. **PR-OB-9: P0-1 (real PDF generation)** — 4-8 hours. Use `pdf` + `printing` packages, embed signature image, share actual PDF file.
10. **PR-OB-10: P0-2 (consolidate legal content)** — 1-2 hours. Move 5 hardcoded content strings to `legal_page_content.dart`, reference from both screens.
11. **PR-OB-11: P0-4 (sync all 9 permission grants to backend)** — 2-4 hours. Add `ConsentType` values for camera, mic, contacts, phone, callLog, battery, deviceAdmin, notifications. Call `setConsent` for each granted permission.
12. **PR-OB-12: P0-8 (multiple-section expansion + read enforcement)** — 1-2 hours. Change `_expandedId` to `Set<String> _expandedIds`, add "you must read all" check.
13. **PR-OB-13: P0-9 (rename Call Log to Phone)** — 30 min. Either rename or remove from list.
14. **PR-OB-14: P1-4 (fix call_log status check)** — 30 min. Use the correct permission.
15. **PR-OB-15: P1-15 (move legal content to backend/CMS)** — 4-8 hours. Refactor to fetch from API on screen load.
16. **PR-OB-16: P1-8, P1-9, P1-10 (permissions UX overhaul)** — 1-2 days. Use Material `SwitchListTile`, group permissions, add rationale dialogs, add "Required" badges.

### Tech-debt cleanup (1 day)

17. **PR-OB-17: Dead code removal** — delete `WelcomeScreen`, `OnboardingScreen`, `OnboardingService` (P0-7) and the duplicate kyc_preflight test file (Gap-7).
18. **PR-OB-18: Localization** — extract all hardcoded strings to `AppLocalizations`. Affects all 3 live screens.
19. **PR-OB-19: Test gaps** — write widget tests for SplashScreen, PermissionsScreen, LegalScreen, LegalPageScreen. ~3-5 days.

### Total effort estimate

- Hotfixes (PRs 1-8): 1 day total
- Multi-PR fixes (PRs 9-16): 1-2 weeks
- Tech debt (PRs 17-19): 1-2 weeks
- **Total: 3-5 weeks to address all P0s + P1s in this audit**

---

## 9. What I'd do first if I had to pick one

**P0-2 (the two Terms of Service copies are different).** It's a 1-2 hour refactor (move 5 strings to one file), and it fixes a **legal enforceability issue**. A rider can currently "agree" to a document they never saw, and the team has no way to prove what was agreed to because the two copies don't match. This is the single most important fix in the entire audit: it touches the legal foundation of the app.

If the team can't ship this within 48 hours, the second choice is **P0-3 (persist legal acceptance)** — same line-fix category (1-2 hours, single SharedPreferences key), but the blast radius is larger (every returning rider is affected by the "I have to re-accept every time" bug).

The third choice is **P0-1 (real PDF generation)** — 4-8 hours, requires a new package dependency (`pdf` + `printing`), but the rider experience is broken (button says PDF, gets text).

The fourth choice is **P0-7 (delete dead WelcomeScreen + OnboardingScreen)** — 30 minutes, removes 423 lines of confusing dead code, unblocks new developers.

---

## 10. Post-audit checklist

- [ ] Confirm P0-2 (legal content mismatch) with the legal team — the 5-paragraph and 8-paragraph versions may be intentional (e.g. short version for quick accept, long version for full read), but they MUST be labeled as such.
- [ ] Confirm P0-5 (call_log permission) with the Android team — does the app actually use call logs? If not, remove the toggle. If yes, implement the correct platform channel.
- [ ] Add iOS support to the permissions screen (P1-6) — at minimum, skip the `ignoreBatteryOptimizations` requirement.
- [ ] Schedule PR-OB-9 (real PDF generation) with a backend team member to verify the signature image URL format.
- [ ] File tickets for the 9 P0s + 19 P1s with reproducible device scenarios.
- [ ] Decide: hide or fix the "Download Signed PDF" button (P0-1) — rename to "Share Section" while the proper fix is being built.
- [ ] Schedule PR-OB-17 (delete dead code) for a single cleanup PR — WelcomeScreen, OnboardingScreen, OnboardingService, and the duplicate kyc_preflight test file.

---

**Audit complete. 9 P0s + 19 P1s + 22 P2s + 26 P3s = 76 findings. ~700 lines of dead code. ~600 lines of fake UI / misleading copy. Single highest-blast-radius fix: P0-2 (legal content mismatch) — 1-2 hours, but touches the legal foundation of the app.**
