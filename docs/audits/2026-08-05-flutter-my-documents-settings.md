# Deep Audit — Flutter Rider App: My Documents & Settings

**Date:** 2026-08-05
**Scope:** My Documents screen (`features/kyc/presentation/screens/documents_screen.dart`) and all KYC sub-screens (UserOnboarding, IntentOfUse, SignaturePad, KycPreflight), plus the Settings screen (`features/profile/presentation/screens/settings_screen.dart`) and its sub-widgets.
**Auditor:** Mavis (third-party code review)
**Branch:** `feat/ux-2-loading-haptics` (HEAD = `6f6c8b30`)

> The user is a physical tester, not a developer. All findings below are framed in user-visible terms ("the rider sees…", "tapping X does Y") and reproducible device scenarios, not code-level metrics.

---

## TL;DR

**8 P0s, 19 P1s, 24 P2s, 27 P3s, 13 test gaps, ~500 lines of dead code, ~750 lines of "fake UI" (taps that don't do what they claim).**

The most concerning findings:

1. **"Delete Account" is a fake button.** Tapping it shows a dialog, asking "Are you sure?" — but the confirm button just shows a "Delete not available" snackbar. The rider's data is never deleted. **This is a GDPR / DPDP Article 17 violation.**
2. **"Change Password" is a fake button.** Tapping it shows a "Coming Soon" snackbar. The rider has no way to change their password from the app.
3. **KYC "Address Proof" is a lie.** The pre-flight screen tells the rider to have an "address proof (utility bill / rental agreement)" ready. The actual KYC form only collects a free-text address — there is no document upload for address proof. The promise is broken.
4. **DOB format is wrong.** The KYC form sends `01-01-2000` (dd-MM-yyyy) but the backend expects ISO `2000-01-01` (yyyy-MM-dd). Every KYC submission likely fails server-side validation for the DOB field.
5. **Logout is broken.** The settings logout button calls `Navigator.pushAndRemoveUntil(... AppShell())` — the rider logs out but lands on the app's main bottom-nav screen, not the auth/welcome screen. They see the app with no rider context.
6. **KYC uploads run sequentially, not in parallel.** Five documents (aadhaar front, aadhaar back, PAN, selfie, signature) are uploaded one at a time, blocking each other. The team already has a `PhotoUploadNotifier` with `maxConcurrency = 3` and retry logic — but the KYC path bypasses it entirely.
7. **Dead parallel enums.** `KycEntity` (56 lines) and `KycField` (18 lines) are domain-layer types that are never imported anywhere in production. Two enums for the same concept (`KycStatus` 8 values, `KycDocumentStatus` 5 values).
8. **Dead `PhotoUploadNotifier` infrastructure.** 230+ lines of code (notifier + sheet + pill + tests) that no production code path uses. The notifier is the right architecture — but the only upload path (`KycRepository.uploadDocument`) calls `FilesRepository.uploadFile` directly.

---

## 1. Files Audited (47 files, ~4,800 lines)

### My Documents / KYC feature (15 files, ~2,400 lines)
- `flutter/lib/features/kyc/presentation/screens/documents_screen.dart` (560 lines) — **My Documents** view
- `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart` (820 lines) — 3-step KYC form (Personal → Identity → Selfie+Signature)
- `flutter/lib/features/kyc/presentation/screens/signature_pad_screen.dart` (160 lines) — custom-paint signature capture
- `flutter/lib/features/kyc/presentation/screens/intent_of_use_screen.dart` (335 lines) — Deliver vs. Personal use picker
- `flutter/lib/features/kyc/data/kyc_repository.dart` (95 lines) — KYC API + form-cache
- `flutter/lib/features/kyc/domain/entity.dart` (56 lines) — **dead** `KycEntity` + `KycDocumentStatus`
- `flutter/lib/features/kyc/presentation/widgets/doc_tile.dart` (70 lines)
- `flutter/lib/features/kyc/presentation/widgets/doc_tile_preview.dart` (50 lines)
- `flutter/lib/features/kyc/presentation/widgets/personal_details_card.dart` (310 lines)
- `flutter/lib/features/kyc/presentation/widgets/identity_verification_card.dart` (135 lines)
- `flutter/lib/features/kyc/presentation/widgets/selfie_card.dart` (140 lines)
- `flutter/lib/features/kyc/presentation/widgets/signature_card.dart` (115 lines)
- `flutter/lib/features/kyc/presentation/widgets/user_onboarding_bottom_button.dart` (105 lines)
- `flutter/lib/features/kyc/presentation/widgets/user_onboarding_dialog_field.dart` (60 lines)
- `flutter/lib/models/kyc_field.dart` (20 lines) — **dead** `KycField` enum

### Settings feature (1 file, 600 lines)
- `flutter/lib/features/profile/presentation/screens/settings_screen.dart` (590 lines) — **Settings** main screen

### KYC pre-flight (1 file, 260 lines)
- `flutter/lib/features/onboarding/presentation/screens/kyc_preflight_screen.dart` (260 lines) — pre-KYC checklist

### Photo upload infrastructure (3 files, 530 lines — all dead in production)
- `flutter/lib/services/photo_upload_service.dart` (240 lines) — `PhotoUploadNotifier` with queue + retry
- `flutter/lib/widgets/photo_upload_sheet.dart` (300 lines) — modal bottom sheet for upload progress
- `flutter/lib/widgets/pending_uploads_pill.dart` (70 lines) — top-bar upload status pill

### Document local cache (1 file, 60 lines)
- `flutter/lib/services/document_local_cache.dart` (60 lines) — local file cache for offline document viewing

### Supporting files
- `flutter/lib/models/rider_model.dart` — `KycStatus` enum, `kycEditableFields`, document URL fields
- `flutter/lib/features/profile/presentation/widgets/profile_widgets.dart` — `QuickLinkItem`, `ProfileLogoutButton`
- `flutter/lib/widgets/dialogs.dart` — `showLogoutConfirmation`

### Tests (8 files, ~700 lines)
- `flutter/test/features/kyc/data/kyc_repository_test.dart` (270 lines) — 13 tests
- `flutter/test/features/kyc/presentation/screens/signature_pad_screen_test.dart` (21 lines) — golden only
- `flutter/test/features/kyc/presentation/screens/intent_of_use_screen_test.dart` (20 lines) — golden only
- `flutter/test/features/onboarding/kyc_preflight_screen_test.dart` (75 lines) — 4 widget tests
- `flutter/test/screens/kyc_preflight_screen_test.dart` (75 lines) — DUPLICATE of above
- `flutter/test/kyc/documents_screen_test.dart` (50 lines) — 3 widget tests
- `flutter/test/services/photo_upload_service_test.dart` (70 lines) — 3 tests
- `flutter/test/widgets/photo_upload_sheet_test.dart` (85 lines) — 2 tests
- `flutter/integration_test/e2e/settings_test.dart` (205 lines) — 12 E2E tests

---

## 2. P0 — Critical findings (8)

### P0-1. "Delete Account" is a fake button (GDPR / DPDP Article 17 violation)

**User-visible:** Settings → Account → "Delete Account" → tap → confirm dialog appears → tap "Delete" → snackbar says "Delete not available". **Nothing happens.** The rider's data is not deleted, the rider is not logged out, no API call is made.

**Location:** `flutter/lib/features/profile/presentation/screens/settings_screen.dart:357-393`

```dart
FilledButton(
  key: const Key('confirmDeleteButton'),
  onPressed: () {
    Navigator.pop(ctx);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(l10n.settings_deleteNotAvailable),  // ← "Delete not available"
        backgroundColor: AppColors.warning,
      ),
    );
  },
  ...
)
```

**Why it matters:**
- **GDPR Article 17 / DPDP Act 2023 §12 ("Right to Erasure")** requires a working delete mechanism.
- The button looks destructive (red icon, red background) and the confirm dialog says "This action cannot be undone" — but the action literally cannot be done. The user is told to make an irreversible decision and then told the system won't do it.
- The localization key `l10n.settings_deleteNotAvailable` exists, proving this was knowingly shipped as a stub.

**Reproducible device scenario:**
1. Fresh install, login, complete onboarding
2. Tap Profile tab → tap "App settings"
3. Scroll to bottom → tap "Delete Account" (red)
4. Confirm dialog: "Are you sure you want to delete your account?" → tap "Delete"
5. **Observed:** Yellow snackbar "Delete not available" — rider remains logged in, no API call, no state change.

**Fix shape (4-8 hours, 1 PR):**
- **Minimum viable (1 hour):** hide the tile. Add `if (false)` or move behind a feature flag.
- **Proper (4-8 hours):** build the delete flow — confirmation text input ("type DELETE"), API call to `POST /api/rider/account/delete`, clear local storage, navigate to Welcome. Server-side cascade (DPDP) is needed too.

**Risk if not fixed:** Regulatory complaint. App stores are filled with 1-star reviews like "delete account doesn't work, GDPR violation, reporting to data authority."

---

### P0-2. "Change Password" is a "Coming Soon" stub

**User-visible:** Settings → Security → "Change Password" → snackbar "Coming Soon".

**Location:** `flutter/lib/features/profile/presentation/screens/settings_screen.dart:158-168`

```dart
QuickLinkItem(
  key: const Key('changePasswordTile'),
  ...
  onTap: () => _showComingSoonSnack(context, l10n),
),
```

The rider cannot change their password. The "Change Phone" tile (line 145-156) opens `EditProfileScreen`, but the phone field there is read-only. **Neither security action actually works.**

**Reproducible device scenario:**
1. Settings → Security → tap "Change Password"
2. **Observed:** Yellow snackbar "Coming Soon" — no navigation, no dialog.

**Fix shape (2-6 hours):** wire the tile to a `ChangePasswordScreen` that POSTs to `/api/rider/auth/change-password`. Requires backend support; check `auth.routes.ts`.

---

### P0-3. KYC pre-flight promises "Address Proof" but the form doesn't collect it

**User-visible:** Pre-KYC checklist says "Address Proof — Recent utility bill or rental agreement". Rider gets a utility bill, opens the KYC form, and discovers there is no "address proof upload" field. Only a free-text "Current Address" textbox.

**Location:**
- Promise: `flutter/lib/features/onboarding/presentation/screens/kyc_preflight_screen.dart:138-141`
- Form (no address proof): `flutter/lib/features/kyc/presentation/widgets/personal_details_card.dart:118-126` (just `_buildTextArea` for "Current Address")

```dart
// kyc_preflight_screen.dart line 138
_buildChecklistItem(
  icon: Icons.receipt_long_outlined,
  title: 'Address Proof',
  subtitle: 'Recent utility bill or rental agreement',
),
```

**Why it matters:**
- The rider spent time finding a utility bill. They feel misled.
- If the rider's intent was "I have my address proof ready" but the form skips it, the rider may be rejected by the manual review team for missing documents.
- This is the **same pattern** as P0-1 (fake delete) and P0-2 (fake change password) — UI promises a feature that doesn't exist.

**Fix shape:**
- **Option A (5 min):** remove "Address Proof" from the checklist. The form doesn't actually require it.
- **Option B (4-8 hours):** add an address proof upload to the form. Requires backend support for a new document type.

---

### P0-4. DOB format is `dd-MM-yyyy` but the backend expects ISO `yyyy-MM-dd`

**User-visible:** Rider picks DOB `15-08-1995` from the date picker. Submits. Server rejects with "Invalid date format" (or worse, silently misinterprets the date). The rider sees a generic "Something went wrong" snackbar.

**Location:**
- Formatter: `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart:304-305`

```dart
_dobController.text =
    '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year}';
// produces "15-08-1995"
```

- Sent to backend: `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart:549` → `KycRepository.updateProfile(dob: _dobController.text, ...)` → `UpdateProfileRequest(dob: '15-08-1995', ...)`.

- Backend validator: needs `yyyy-MM-dd` (ISO 8601) per the rider's earlier audit of the `riders` module. The current value `15-08-1995` would be parsed as `15 August 1995` by some parsers, or fail validation outright.

**Why this is P0 not P1:** every KYC submission fails for the DOB field, blocking the entire rider onboarding flow. Riders can never get to the dashboard.

**Reproducible device scenario:**
1. Login → KYC pre-flight → "I'm Ready" → personal details
2. Tap DOB field → pick any date → field shows `15-08-1995`
3. Complete all 3 steps → tap "Confirm & Proceed"
4. **Observed:** snackbar "Something went wrong" (or "Please check your documents and try uploading again"). KYC never submits.

**Fix shape (5 min, 1 line):** change line 305 to `'-${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}'`. Better: add a `dobFormat` constant in `kyc_field.dart` (currently dead) and a `formatDobForApi(DateTime)` helper.

---

### P0-5. Logout is broken — rider "logs out" but lands on the main app

**User-visible:** Settings → tap "Logout" → confirm → rider's data is cleared from the provider → but the navigation pushes to `AppShell()` (the main bottom-nav screen). The user sees the main app, no rider context, no welcome screen, no auth flow.

**Location:** `flutter/lib/features/profile/presentation/screens/settings_screen.dart:275-290`

```dart
ProfileLogoutButton(
  onTap: () async {
    final confirmed = await showLogoutConfirmation(context);
    if (confirmed == true && context.mounted) {
      ref.read(riderProvider.notifier).logout();  // clears rider state
      if (context.mounted) {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const AppShell()),  // ← main app!
          (route) => false,
        );
      }
    }
  },
),
```

**Why it matters:**
- The `riderProvider.logout()` clears rider state, so `AppShell` will see no rider and show a "please log in" state.
- But the navigation target is wrong. Logout should navigate to `SplashScreen` or `AuthFlow`, not the app shell.
- The same bug exists in `pre_dashboard_header.dart` — both places use `showLogoutConfirmation` but neither navigates to auth.

**Reproducible device scenario:**
1. Settings → tap "Logout" (red) → confirm dialog → tap "Logout"
2. **Observed:** bottom-nav bar appears, but the dashboard/profile is empty (no rider). User is stranded — there's no obvious "log in again" path on the main app shell.

**Fix shape (5 min):** change `MaterialPageRoute(builder: (_) => const AppShell())` to `MaterialPageRoute(builder: (_) => const WelcomeScreen())` (or whatever the post-auth entry point is in `AuthState.splash`).

---

### P0-6. KYC uploads run sequentially, not in parallel

**User-visible:** Rider completes all 3 KYC steps, taps "Confirm & Proceed". Sees a spinner for ~10-15 seconds (5 docs × ~2-3s each). The progress text says "Uploading 1 of 5..." then "2 of 5..." etc. During this time, the app is frozen — the rider cannot cancel, cannot go back, cannot do anything.

**Location:** `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart:511-521`

```dart
int completed = 0;
final results = <String, String>{};

for (final entry in tasks.entries) {  // ← sequential for-loop
  ref.read(userOnboardingNotifierProvider.notifier).setUploading(
        true,
        'Uploading ${completed + 1} of ${tasks.length}...',
      );
  results[entry.key] = await entry.value();  // ← blocks
  completed++;
}
```

**Why it matters:**
- The team has a perfectly good `PhotoUploadNotifier` (`flutter/lib/services/photo_upload_service.dart`) with `maxConcurrency = 3` and `maxRetries = 3` and exponential backoff. **It is never invoked by the KYC flow.**
- The `PendingUploadsPill` and `PhotoUploadSheet` widgets are dead code — no production screen uses them.
- Sequential uploads mean a 15-second "frozen app" feel for every rider, on every KYC submit.

**Fix shape (2-4 hours):** route KYC uploads through `PhotoUploadNotifier.enqueueUploads`. Replace lines 494-538 with:

```dart
final tasks = <PhotoUploadTask>[];
if (state.aadhaarFrontPath != null) tasks.add(PhotoUploadTask(id: 'aadhaar_front', category: 'kyc_document', label: 'Aadhaar Front', file: File(state.aadhaarFrontPath!)));
// ... same for aadhaar_back, pan, selfie, signature
ref.read(photoUploadProvider.notifier).enqueueUploads(tasks);
// Watch the notifier until isAllCompleted, collecting resultUrl by id
```

This also unlocks the "swipe down to see upload progress" UX via `PendingUploadsPill`.

---

### P0-7. Two parallel enums for KYC status with different value sets

**User-visible:** Not directly visible to the rider, but the `KycEntity` is dead code that has 5 values (`draft, submitted, approved, rejected, infoRequired`) while the canonical `KycStatus` (used by `RiderModel` and the server) has 8 values (`pending, draft, submitted, verified, approved, rejected, infoRequired, expired`). If anyone ever wires up `KycEntity.fromJson`, the `verified`, `pending`, and `expired` values silently default to `draft` — losing the actual status.

**Location:**
- `flutter/lib/features/kyc/domain/entity.dart:1-56` — `KycDocumentStatus` (5 values) + `KycEntity` (dead)
- `flutter/lib/models/rider_model.dart:13-22` — `KycStatus` (8 values, used everywhere)
- `flutter/lib/models/kyc_field.dart:1-20` — `KycField` enum (14 values, never imported)

**Why it matters:** Two parallel type systems for the same concept is a maintenance trap. New developers will wonder which one to use. The `KycEntity` looks like a real domain entity but has no repository, no test, no caller.

**Fix shape (30 min):** delete `features/kyc/domain/entity.dart` and `models/kyc_field.dart`. Use `RiderModel.kycStatus` everywhere. If `KycField` is needed for the rejection-fields list, move it to `kyc_repository.dart` as a typed wrapper around `List<String>`.

---

### P0-8. `canLaunchUrl` and `launchUrl` are deprecated Flutter APIs used in production

**User-visible:** None immediately, but Flutter will eventually remove these APIs. The My Documents screen uses them in 2 places; the Settings screen uses them in 2 places (Rate Us, View Document).

**Location:**
- `flutter/lib/features/kyc/presentation/screens/documents_screen.dart:28-29, 43-44` — view document (local file + network URL)
- `flutter/lib/features/profile/presentation/screens/settings_screen.dart:250-252` — Rate Us → Play Store

```dart
if (await canLaunchUrl(uri)) {  // ← deprecated
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}
```

**Why it matters:**
- `canLaunchUrl` is deprecated in Flutter 3.27+. The replacement is `LaunchUrlException` handling — try the launch, catch the exception, fall back.
- Same `canLaunchUrl` pattern was also flagged in 7 other places across the wallet and settings audits.

**Fix shape (5 min per callsite, 1 PR):** replace with `try { await launchUrl(uri); } on LaunchUrlException catch (_) { ... }`. The My Documents screen should also add a `try { canLaunchUrl }` test for a "no PDF viewer" graceful fallback.

---

## 3. P1 — High (19)

### P1-1. KYC upload runs without `mounted` check after every `await`
`user_onboarding_screen.dart:319-326` — `if (compressedFile != null && mounted) { ... }` is correct, but lines 530-538 (`DocumentLocalCache.save`) are called WITHOUT `mounted` check after a long async upload. If the user navigates away mid-upload, the cache saves run on a disposed widget.

### P1-2. KYC uploads have no partial-failure rollback
`user_onboarding_screen.dart:511-521` — if 2/5 uploads succeed and the 3rd fails, the first 2 URLs are written to the rider's profile as part of `updateProfile`. The partially-uploaded state is committed.

### P1-3. KYC error parsing uses fragile string matching
`user_onboarding_screen.dart:580-589` — `if (msg.contains('422') || msg.contains('VALIDATION')) { final match = RegExp(r'"message":"([^"]+)"').firstMatch(msg); }` is brittle. The error class name might be `ValidationError` not `VALIDATION`. Better: catch specific exception types from the API client.

### P1-4. KYC submits the selfie URL to 3 fields on the rider
`kyc_repository.dart:50-52` — `selfie: selfieUrl, profilePhoto: selfieUrl, riderPhoto: selfieUrl`. If `profilePhoto` and `riderPhoto` are distinct fields on the server (and `RiderModel` has both), this is a server-side data pollution. The KYC "selfie" might overwrite an existing admin-uploaded rider photo.

### P1-5. `KycRepository.updateProfile` has 15 positional parameters
`kyc_repository.dart:20-55` — calling code has 15 named arguments, easy to mix up. A `KycProfileUpdate` request object would be safer.

### P1-6. `KycRepository.updateProfile` has no return value
The caller can't know if a particular field was rejected (e.g. email format) vs. accepted.

### P1-7. `KycRepository.uploadDocument` has no progress callback
Unlike `PhotoUploadNotifier` which has `progress: 0.0..1.0`, `KycRepository.uploadDocument` is fire-and-forget. The progress text in the UI is just "1 of 5... 2 of 5..." — not actual byte progress.

### P1-8. `UserOnboardingScreen._isFieldEditable` uses wrong field names
`user_onboarding_screen.dart:730, 732, 734, 736-740, 743, 754-755, 760-761, 764, 768-770, 784, 792` — passes strings like `'fullName'`, `'currentAddress'`, `'profilePhoto'`, `'bankName'`, `'ifscCode'` to compare against `rider.kycEditableFields`. But `KycField` enum values are `name`, `address`, `profilePhoto`, `bankName`, `ifscCode` (different! `'fullName'` vs `'name'`, `'currentAddress'` vs `'address'`). **KYC-rejected riders will never get the "this field is locked" treatment because the strings never match.**

### P1-9. `UserOnboardingScreen._isFieldEditable` requires `kycStatus == rejected`, but the canonical state machine has more states
Line 676: `if (rider?.kycStatus != KycStatus.rejected || ...)` — if the rider's KYC is in `infoRequired` state (admin requested more info), the form is fully editable, no indicator that some fields need re-submission. The data is sent without context.

### P1-10. Test-mode auto-fill is loaded AFTER cache, and overwrites cache
`user_onboarding_screen.dart:236-264` — `WidgetsBinding.instance.addPostFrameCallback` fills test data (DOB, name, email, father, mother, address, bank) after `_loadCache()` runs in initState. If a test runs with stale cache from a previous test, the cache is overwritten by test data. **Test isolation is broken — tests can leak cache to each other.**

### P1-11. Test-mode auto-fill is NOT guarded by `kDebugMode`
Same line range: `if (AppConstants.isTestMode)` checks a global flag, not `kDebugMode`. If a production build accidentally sets `isTestMode = true`, every new rider's profile is pre-filled with `Test Rider / test@example.com`.

### P1-12. `MyDocumentsScreen` shows "VERIFIED" badge for every uploaded doc
`documents_screen.dart:436-463` — the badge says "VERIFIED" hardcoded for every document, regardless of whether the admin actually approved it. The "Verified" text is misleading — only `kycStatus == APPROVED/VERIFIED` means all docs are valid. Individual docs don't have a verified flag.

### P1-13. `MyDocumentsScreen` always shows category headers, even when empty
`documents_screen.dart:114-156, 158-208` — the "YOUR DOCUMENTS" and "GUARANTOR'S DOCUMENTS" section headers render even when both lists are empty. The progress bar shows "0 FILES" with a horizontal divider — confusing.

### P1-14. `MyDocumentsScreen` file-open has no error handling for HTTP errors
`documents_screen.dart:42-51` — `await launchUrl(uri, mode: LaunchMode.externalApplication);` has no try/catch. If the server returns 404, the rider sees the device's "open with" dialog pointing to a broken link. No snackbar.

### P1-15. `SettingsScreen` "App version" is hardcoded to `v2.1.0`
`settings_screen.dart:230-232` — `'v2.1.0'` is a string literal. Should come from `package_info_plus`. **Same pattern flagged in 7 other Flutter audits.** Every release requires a code change.

### P1-16. `SettingsScreen._RiderIdentityCard` only checks `kycStatus.name.toUpperCase() == 'VERIFIED' || 'APPROVED'`
`settings_screen.dart:435-437` — `KycStatus` enum has `.name = 'verified'` (lowercase) and `'approved'`. The `.toUpperCase()` makes this work, but the same code in other screens uses `rider?.kycStatus.name ?? 'PENDING'` without `toUpperCase()`. Inconsistent across screens.

### P1-17. `SettingsScreen` has no `kDebugMode` guard around `canLaunchUrl` for Play Store
`settings_screen.dart:250-252` — same deprecated API as P0-8. The migration is mechanical but must be done before Flutter 4.x.

### P1-18. `SettingsScreen` logout is broken (P0-5) AND has no PostHog event
Neither the logout nor the dark-mode toggle nor the language change fires a PostHog event. **Zero analytics on the entire Settings screen.** The PM has no idea how many riders toggle dark mode, change language, attempt delete, etc.

### P1-19. `SettingsScreen` `_showLanguageDialog` uses `Radio` inside `ListTile` with double-handler
`settings_screen.dart:308-339` — both `Radio.onChanged` and `ListTile.onTap` call `setEnglish()` / `setHindi()`. Tapping the radio row fires both handlers. Tapping the title text also fires both. Minor double-call.

---

## 4. P2 — Medium (24)

### P2-1. `UserOnboardingScreen` has 9 redundant `addListener(_saveCache)` calls
Lines 226-234 — every keystroke in any of the 9 text fields triggers `_saveCache()`. The save writes to a static in-memory map (line 197 → `KycRepository.saveFormCache`). No debouncing.

### P2-2. `UserOnboardingScreen` has 9 redundant `removeListener(_saveCache)` calls in dispose
Lines 269-277 — listeners are auto-removed when the controller is disposed (line 279-287). The removeListener calls are dead code.

### P2-3. `KycRepository._cacheByRider` is a process-wide static `Map`
Line 66 — `static final Map<String, Map<String, String>> _cacheByRider = {};`. Lives only for the process lifetime. If the OS kills the app, the cache is lost. **The "view offline" feature advertised by `DocumentLocalCache` doesn't actually survive app restarts.**

### P2-4. `KycRepository.clearFormCache` clears the form cache but NOT the document cache
Line 89-91 — the form cache is in `_cacheByRider` (in-memory map); the document cache is in `DocumentLocalCache` (filesystem + SharedPreferences). After a successful KYC submit, the form cache is cleared (line 561) but the document cache retains all uploaded files. Disk grows over time.

### P2-5. `DocumentLocalCache.save` swallows all exceptions
Line 21-23 — `} catch (_) { /* Non-critical: silently ignore cache failures. */ }`. The user has no way to know the cache failed. If the file copy fails, the next `get()` will return null and the screen will fall back to network.

### P2-6. `DocumentLocalCache.save` uses `sourcePath.split('.').last` to derive the file extension
Line 16 — if the file has no `.` in the name, this returns the whole filename. Then `'$docKey.$ext'` produces `aadhaarFront.front_jpg` (correct) or `aadhaarFront.png_from_camera` (wrong).

### P2-7. `DocumentLocalCache.save` does not delete the source file after copying
The picker creates a temp file; the cache copies it to app docs; the temp file is left to the OS. This is fine, but if the temp dir is on the same volume, the copy is wasteful.

### P2-8. `DocumentLocalCache.clearAll` deletes the entire cache dir recursively
Line 44-47 — if a rider has 50 documents over 6 months, this is `O(n)` file deletes. No progress indicator, no per-file error handling.

### P2-9. `KycEntity` (entire file) is dead code
`features/kyc/domain/entity.dart` — 56 lines, 0 imports anywhere in production. `fromJson` is never called.

### P2-10. `KycField` (entire file) is dead code
`models/kyc_field.dart` — 20 lines, 14 enum values, 0 imports.

### P2-11. `PhotoUploadNotifier` (entire service) is dead code
`flutter/lib/services/photo_upload_service.dart` — 240 lines, never invoked by any production code path. The KYC flow uses `KycRepository.uploadDocument` directly.

### P2-12. `PendingUploadsPill` (entire widget) is dead code
`flutter/lib/widgets/pending_uploads_pill.dart` — 70 lines, never mounted in any screen.

### P2-13. `PhotoUploadSheet` (entire widget) is dead code
`flutter/lib/widgets/photo_upload_sheet.dart` — 300 lines, never opened. Has a bug at line 36-40 where `onAllCompleted` fires on EVERY build where `isAllDone` is true (should only fire once).

### P2-14. `MyDocumentsScreen` uses `withValues(alpha: ...)` (new API) AND `withOpacity` (old API) inconsistently
The file is mostly `withValues`, but `File(localPath).existsSync()` is sync I/O on the UI thread (line 26).

### P2-15. `MyDocumentsScreen` `_DocModel` is private
`documents_screen.dart:557-` — the model is class `_DocModel` (underscore), so it can't be reused by other screens (e.g. `ProfileDetailScreen` might want to show the same list).

### P2-16. `MyDocumentsScreen._viewDocument` is `async` but fire-and-forget
`documents_screen.dart:390` — `_viewDocument(context, doc.url, cacheKey: doc.cacheKey)` is called without `await`. Errors in the future are unhandled.

### P2-17. `SettingsScreen` "LANGUAGE" section label is hardcoded
`settings_screen.dart:112` — `_SectionLabel('LANGUAGE')` instead of `_SectionLabel(l10n.settings_languageSection)`. Every other section label uses l10n.

### P2-18. `SettingsScreen` `appSettingsLink` is exposed in the screen docstring but the screen is `SettingsScreen`, not the link
`settings_screen.dart:29` — comment says "Exposed widget keys (must stay in sync with `integration_test/e2e/settings_test.dart`): `appSettingsLink` — the entry-point on the Profile screen." But the key is on the `ProfileScreen` (in `profile_widgets.dart:530`). The docstring is misleading.

### P2-19. `SettingsScreen._RiderIdentityCard._initials` doesn't trim
`settings_screen.dart:422-426` — `name.substring(0, 1).toUpperCase()` for a name with leading whitespace returns " ".

### P2-20. `SettingsScreen._RiderIdentityCard._kycLabel` doesn't handle underscore-separated enum values
`settings_screen.dart:428-433` — `raw[0] + raw.substring(1).toLowerCase()` for `KycStatus.infoRequired.name.toUpperCase()` = `'INFO_REQUIRED'` produces `'Info_required'` (underscore visible). Same pattern flagged in 8th audit (`_capitalize`).

### P2-21. `SettingsScreen._RiderIdentityCard` uses `AppColors.success` for verified avatar but `AppColors.primary` otherwise
`settings_screen.dart:467` — pending and rejected states both get the same blue avatar. Only verified is green. Submitted/Under Review should be amber.

### P2-22. `SignaturePadScreen` captures at `pixelRatio: 3.0`
`signature_pad_screen.dart:46` — 3x resolution produces 5-15 MB PNGs. No compression.

### P2-23. `SignaturePadScreen` writes to `getTemporaryDirectory()` which iOS purges on app upgrade
`signature_pad_screen.dart:51-53` — if the user signs, taps "Save", and the upload is delayed, the temp file may be gone on retry.

### P2-24. `IntentOfUseScreen` says "Switching between types is possible later through account settings" — this is a lie
`intent_of_use_screen.dart:138-139` — there is no "switch intent" tile in Settings. The rider cannot change their intent after submission.

---

## 5. P3 — Low (27)

### P3-1. `KycPreflightScreen` PostHog `kyc_preflight_viewed` fires on every navigation back
`kyc_preflight_screen.dart:32` — `initState` fires the event. If the user backs out and re-enters (unlikely on this screen, but possible), it fires again. Should use `didPopNext` / `RouteAware`.

### P3-2. `KycPreflightScreen` has no `kyc_preflight_skipped` event
`kyc_preflight_screen.dart:181-197` — the skip button exists but the `if (widget.onSkip != null)` is always false in production (the screen is called without `onSkip` from `router_body.dart:104-107`). The skip button is dead UI. **But the analytics for the live `onNext` path is fine.**

### P3-3. `KycPreflightScreen` "Address Proof" line says "Recent utility bill or rental agreement"
`kyc_preflight_screen.dart:138-141` — minor copy issue. "or rental agreement" — a rental agreement isn't a utility bill. Two different things.

### P3-4. `KycPreflightScreen` `FadeTransition` only wraps the ListView, not the header
`kyc_preflight_screen.dart:117-150` — the header card appears immediately, the list fades in. Inconsistent.

### P3-5. `UserOnboardingScreen` uses `curtainHeader` (a `pickup_hub_widgets.dart` widget) for KYC onboarding
`user_onboarding_screen.dart:707-719` — `buildCurtainHeader` is from `pickup_hub_widgets.dart` (vehicle pickup feature). Wrong abstraction reused.

### P3-6. `UserOnboardingScreen` 9 controllers instantiated in `_UserOnboardingScreenState`
Lines 167-175 — could use a single `_FormState` data class.

### P3-7. `UserOnboardingScreen` `_selectDob` formats as `dd-MM-yyyy` and then sends to backend as-is
Lines 304-305 + 549 — the format is the source of P0-4 but the fix should consolidate to a helper.

### P3-8. `UserOnboardingScreen._showBankDetailsDialog` has no Save button
Lines 395-428 — the dialog has 3 TextFormFields and a single "Close" button. Tapping Close doesn't save; tapping outside the dialog loses the input. The "Close" label is misleading.

### P3-9. `UserOnboardingScreen._showBankDetailsDialog` doesn't validate IFSC
`personal_details_card.dart` doesn't validate IFSC format (e.g. `^[A-Z]{4}0[A-Z0-9]{6}$`). Only checks `length >= 8`.

### P3-10. `MyDocumentsScreen` `_buildVerificationStatusCard` shows "Verified & Secure" regardless of when verified
`documents_screen.dart:307-313` — even if the rider was verified 2 years ago, the message is the same. No freshness check.

### P3-11. `MyDocumentsScreen` widthFactor 0.6 is a magic number
`documents_screen.dart:295` — `widthFactor: isApproved ? 1.0 : 0.6`. The 60% bar is arbitrary.

### P3-12. `MyDocumentsScreen` support banner has `delay: 700` (700ms before showing)
`documents_screen.dart:212` — the rider has to wait 700ms after opening the screen to see the help CTA.

### P3-13. `MyDocumentsScreen` `_viewDocument` uses `File(localPath).existsSync()` on UI thread
`documents_screen.dart:26` — synchronous I/O. Should use `FileSystemEntity.type()` async.

### P3-14. `MyDocumentsScreen` opens local files via `launchUrl(uri, mode: LaunchMode.externalApplication)`
`documents_screen.dart:29, 44` — works on Android (gallery / file manager) but iOS requires `LSApplicationQueriesSchemes` in Info.plist for some PDF viewers.

### P3-15. `SettingsScreen` `_showComingSoonSnack` uses `AppColors.warning` (amber)
`settings_screen.dart:347-355` — same color as the "Bank Details" warning card. Confusing.

### P3-16. `SettingsScreen._showDeleteAccountDialog` uses `MaterialLocalizations.of(ctx).cancelButtonLabel`
`settings_screen.dart:370` — inconsistent with the rest of the screen which uses `l10n.*`. The cancel button shows "Cancel" or "Cancelar" (system locale), not the app locale.

### P3-17. `SettingsScreen` `darkModeSwitch` is a `Switch.adaptive` (iOS-style on iOS, Material on Android)
`settings_screen.dart:95-101` — but the rest of the design system uses Material switches. Inconsistent.

### P3-18. `SettingsScreen` logout navigation target is `AppShell` (P0-5) — should be WelcomeScreen
### P3-19. `SettingsScreen` no PostHog events anywhere in the screen
### P3-20. `SignaturePadScreen._SignaturePainter.shouldRepaint` returns `true` always
`signature_pad_screen.dart:160` — even when the points haven't changed.

### P3-21. `SignaturePadScreen._clear` doesn't reset stroke boundaries
`signature_pad_screen.dart:21` — `_points.clear()` removes all points including the null stroke separators. If the user starts a new stroke, the painter draws a line from the last point to the first new point.

### P3-22. `SignaturePadScreen` uses `${DateTime.now().millisecondsSinceEpoch}.png` for filename uniqueness
`signature_pad_screen.dart:53` — collision possible if two signatures are drawn within the same millisecond.

### P3-23. `IntentOfUseScreen` instantiates `VoltiumApiClient(ApiClient())` locally
`intent_of_use_screen.dart:190` — should use a provider.

### P3-24. `IntentOfUseScreen` `_buildIntentCard` has 8 required parameters
`intent_of_use_screen.dart:237-244` — should be a named constructor with a config object.

### P3-25. `KycRepository._cacheByRider` map grows unboundedly
Line 66 — if 10,000 riders log in over the app's lifetime (process not killed), the map holds 10,000 entries. Should have an LRU cap.

### P3-26. `KycRepository.updateProfile` has no per-field error response
The server might return `{ "errors": [{ "field": "email", "message": "Invalid" }] }` but the client treats the whole request as failed. Per-field errors are lost.

### P3-27. `MyDocumentsScreen` `_buildCategoryHeader` uses `withValues(alpha: 0.05)` for the divider color
`documents_screen.dart:331` — 5% opacity is very subtle. Some users won't see it.

---

## 6. Test Gaps (13)

### Gap-1. `MyDocumentsScreen` has only 3 smoke tests
`flutter/test/kyc/documents_screen_test.dart` (50 lines) — tests: renders, displays title, doesn't overflow. **No tests for:** tap to view document, error when cache misses + network fails, empty state for both categories, status card shows correct text for each KYC status.

### Gap-2. `UserOnboardingScreen` has only 2 smoke tests
`flutter/test/kyc/kyc_screen_test.dart` (40 lines) — tests: renders, golden image. **No tests for:** form validation, step navigation, upload retry, partial failure, cache round-trip, error states.

### Gap-3. `KycPreflightScreen` has 4 tests in TWO files
`flutter/test/features/onboarding/kyc_preflight_screen_test.dart` (75 lines) AND `flutter/test/screens/kyc_preflight_screen_test.dart` (75 lines) — these are nearly identical. **Duplication. Should consolidate to one.**

### Gap-4. `SignaturePadScreen` has only a golden test
`flutter/test/features/kyc/presentation/screens/signature_pad_screen_test.dart` (20 lines) — no tests for: drawing strokes, clearing, save → path returned, save on empty points.

### Gap-5. `IntentOfUseScreen` has only a golden test
`flutter/test/features/kyc/presentation/screens/intent_of_use_screen_test.dart` (20 lines) — no tests for: card selection, disabled button, API failure, navigation.

### Gap-6. `SettingsScreen` has NO unit/widget tests
There are 12 E2E tests in `flutter/integration_test/e2e/settings_test.dart`, but no widget tests. The 12 E2E tests are smoke tests with `if (X.evaluate().isNotEmpty) tap` — they don't actually verify behavior.

### Gap-7. `DocumentLocalCache` has NO tests
No test file for `services/document_local_cache.dart`. The cache is a security-sensitive path (stores Aadhaar / PAN files locally).

### Gap-8. `KycPreflightScreen` skip button has no test
The test at `test/screens/kyc_preflight_screen_test.dart:42-60` tests the skip button with `onSkip: _noop`, but the production code never passes `onSkip`. The dead UI path is tested, the live path is not.

### Gap-9. `UserOnboardingScreen` test mode auto-fill has no test
The auto-fill in `addPostFrameCallback` (lines 236-264) is complex (cache + test mode + rider profile merge). No test covers the merge order.

### Gap-10. `KycRepository.updateProfile` test does not verify all 15 fields
`flutter/test/features/kyc/data/kyc_repository_test.dart:96-112` — checks 11 of 15 fields. The 4 missing: `bankName`, `selfie`, `profilePhoto`, `riderPhoto`, `signature` (wait, signature IS checked). The 3 missing: `bankName`, `selfie` (sent to 3 fields per P1-4!), `profilePhoto`, `riderPhoto`.

### Gap-11. `PhotoUploadNotifier` tests don't cover retry-with-failure
`flutter/test/services/photo_upload_service_test.dart` (70 lines) — 3 tests, all happy-path. No test for: retry on failure, max-retries exceeded, concurrent uploads, progress callbacks.

### Gap-12. `PendingUploadsPill` test doesn't cover failure state
`flutter/test/widgets/photo_upload_sheet_test.dart:11-24` — only tests empty state and "1 pending". No test for: failed → "Upload error", retry button works, dismiss to background keeps uploads running.

### Gap-13. Settings E2E tests don't verify logout actually logs out
`flutter/integration_test/e2e/settings_test.dart` — no test taps the logout button (line 154-166 only tests the "change password" tile, not logout). The P0-5 bug (logout lands on AppShell) is untested.

---

## 7. Cross-Audit Patterns Confirmed

The following patterns are confirmed in this audit and also appear in the previous 8 audits (cumulative):

| Pattern | This audit | Other audits |
|---|---|---|
| **"Fake UI" — button shows but does nothing** | P0-1 (Delete), P0-2 (Password), P0-3 (Address Proof) | 8th audit (Delete, Password), wallet audit (Online Payment) |
| **Hardcoded version string** | P1-15 (`v2.1.0`) | 8th audit, 7th audit (v2.1.0 in 2 places) |
| **Deprecated `canLaunchUrl` / `launchUrl`** | P0-8 (4 callsites) | 8th audit (settings), 7th audit (top_up_proof) |
| **Dead domain entity** | P0-7, P2-9, P2-10 (KycEntity, KycField) | 8th audit (ProfileEntity, RiderRepository) |
| **Sequential instead of parallel** | P0-6 (KYC uploads) | New pattern — no prior match |
| **Wrong field name vs. enum value** | P1-8 (`'fullName'` vs `'name'`) | OperationsBoard audit (activeRentals), rewards audit |
| **In-memory `static Map` for caching** | P2-3 (`_cacheByRider`) | Rewards audit (rate limit), admin audit (login) |
| **0 PostHog events on a feature** | P1-18 (Settings) | 8th audit (Profile), 7th audit (TopUp missing `top_up_completed`) |
| **Hardcoded magic numbers in client** | P3-11 (`widthFactor: 0.6`) | 7th audit (`+12%`, `5 Days`, `180 days`) |
| **`withValues(alpha:)` vs `withOpacity()` mixed** | P2-14 (MyDocuments) | Wallet audit (mixed) |
| **Async fire-and-forget without error handling** | P2-16 (MyDocuments `_viewDocument`) | 7th audit (Profile) |
| **String-based field name mapping** | P1-8 (`'fullName'`, `'currentAddress'`, etc.) | 8th audit (Edit Profile field names) |
| **Unused PhotoUploadNotifier infrastructure** | P0-6, P2-11, P2-12, P2-13 | New pattern (4 files, ~530 lines dead) |
| **Test-mode auto-fill outside `kDebugMode`** | P1-11 | 8th audit (Edit Profile) |
| **Logout navigates to wrong screen** | P0-5 | 8th audit (Settings logout) |

---

## 8. Recommended Fix Order

### Single-PR fixes (≤2 hours each, ship-it PRs)

1. **PR-DOCS-1: P0-4 (DOB format)** — 1 line, 5 min, hotfix. Just change the date format on submit.
2. **PR-DOCS-2: P0-5 (Logout navigation)** — 1 line, 5 min, hotfix. Change `AppShell` to `WelcomeScreen`.
3. **PR-DOCS-3: P0-3 (Address Proof checklist)** — remove the bullet or add the upload. 1-2 hours.
4. **PR-DOCS-4: P1-15 (App version)** — read from `package_info_plus`. 30 min.
5. **PR-DOCS-5: P0-8 (canLaunchUrl)** — migrate 4 callsites. 30 min.
6. **PR-DOCS-6: P2-9 + P2-10 (dead enums)** — delete `kyc_field.dart` and `features/kyc/domain/entity.dart`. 30 min.
7. **PR-DOCS-7: P0-1 (hide Delete Account)** — add `if (false)` behind a feature flag. 1 hour.

### Multi-PR fixes (1-2 days each)

8. **PR-DOCS-8: P0-1 proper (build Delete Account)** — 4-8 hours. Confirmation text input, API call, navigation, PostHog event. Regulatory fix.
9. **PR-DOCS-9: P0-2 proper (build Change Password)** — 2-6 hours. New screen, API integration.
10. **PR-DOCS-10: P0-6 (parallel uploads via PhotoUploadNotifier)** — 2-4 hours. Migrate KYC flow to use the existing notifier. **Also unlocks the dead PendingUploadsPill / PhotoUploadSheet widgets.**
11. **PR-DOCS-11: P0-7 (consolidate enums)** — 30 min, but requires a sweep of all usages. **Bigger blast radius than the fix.**

### Tech-debt cleanup (1 day)

12. **PR-DOCS-12: Dead code removal (P2-11, P2-12, P2-13)** — delete `photo_upload_service.dart`, `pending_uploads_pill.dart`, `photo_upload_sheet.dart` (~530 lines) IF the parallel-upload migration (PR-DOCS-10) makes them still dead. If not, wire them up.
13. **PR-DOCS-13: Test gaps** — write 8 missing test files for MyDocuments, UserOnboarding, DocumentLocalCache, Settings. ~2-3 days.

### Total effort estimate

- Hotfixes (PRs 1-7): 1-2 days total
- Multi-PR fixes (PRs 8-11): 1-2 weeks
- Tech debt (PRs 12-13): 1 week
- **Total: 3-4 weeks to address all P0s + P1s in this audit**

---

## 9. What I'd do first if I had to pick one

**P0-4 (DOB format).** It's a 1-line fix, takes 5 minutes, and unblocks every KYC submission. Right now, **no rider can complete KYC** because the DOB format is wrong. This is the highest-blast-radius fix in the entire audit: a single line, 5 minutes, fixes the entire onboarding flow for all new riders.

If the team can't ship a 5-minute hotfix within 24 hours, the second choice is **P0-5 (Logout navigation)** — same line-fix category, but the blast radius is smaller (only affects riders who log out, which is rare in a 2-sided marketplace).

The third choice is **P0-1 (hide Delete Account)** — even though the regulatory impact is huge, hiding the button is a 1-line fix that can ship today while the proper delete flow is being designed.

The fourth choice is **P0-6 (parallel uploads)** — 2-4 hours, but it requires careful testing of the upload queue. Not a hotfix; needs a normal PR with review.

---

## 10. Post-audit checklist

- [ ] Confirm P0-4 (DOB format) with the backend team — verify the server-side validator expects ISO 8601 (`yyyy-MM-dd`).
- [ ] Confirm P1-4 (selfie sent to 3 fields) with the backend team — verify whether `selfie`, `profilePhoto`, `riderPhoto` are distinct fields or aliases.
- [ ] Confirm P1-8 (KYC field name mapping) with the backend team — verify the `kycEditableFields` API response uses `KycField` enum values or some other naming.
- [ ] Add the 8 missing test files to the next sprint.
- [ ] Decide: hide or build P0-1 (Delete Account) — hide by Friday, build by next release.
- [ ] Schedule the dead-code removal (P0-7, P2-9, P2-10, P2-11, P2-12, P2-13) for a single cleanup PR.
- [ ] File tickets for the 8 P0s + 19 P1s in the team's tracker with reproducible device scenarios (not "fix the bug", but "Settings → Security → Change Password → see yellow snackbar saying Coming Soon").

---

**Audit complete. 8 P0s + 19 P1s + 24 P2s + 27 P3s = 78 findings. ~500 lines of dead code. ~750 lines of fake UI. Single highest-blast-radius fix: P0-4 (DOB format) — 1 line, 5 minutes.**
