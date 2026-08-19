# Audit — User Details Form (KYC onboarding)

**Date:** 2026-08-16
**Scope:** All screens in the rider's user-details / KYC onboarding flow, including sub-screens, form fields, API calls, buttons, routes, and persistence.
**Audience:** Rider team lead (review on device), code reviewers (diff review).
**Method:** Static read of `lib/features/kyc/**`, `lib/features/profile/presentation/screens/edit_profile_screen.dart`, `lib/features/profile/presentation/screens/profile_detail_screen.dart`, and the corresponding server-side use-cases in `web/src/server/modules/riders/**` + `web/src/server/modules/files/**`.

---

## 1. Surface map

### 1.1 Onboarding flow (first-time rider)

```
AuthState.userForm  ──(onNext)──>  GuarantorOnboardingScreen
        ▲                                  │
        │                                  ▼
       onBack                       AuthState.preDashboard
```

| Screen | File | Lines | Reachable from |
|---|---|---|---|
| IntentOfUseScreen | `lib/features/kyc/presentation/screens/intent_of_use_screen.dart` | 367 | `AuthState.intent` (router) |
| UserOnboardingScreen | `lib/features/kyc/presentation/screens/user_onboarding_screen.dart` | 947 | `AuthState.userForm` (router) |
| SignaturePadScreen | `lib/features/kyc/presentation/screens/signature_pad_screen.dart` | 162 | pushed from step 3 via `Navigator.push` |
| GuarantorOnboardingScreen | `lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart` | 1071 | `AuthState.guarantorForm` (router) |
| PreDashboardScreen | (out of scope) | — | `AuthState.preDashboard` |

### 1.2 Post-onboarding edit (existing rider)

| Screen | File | Lines | Reachable from |
|---|---|---|---|
| ProfileScreen | `lib/features/profile/presentation/screens/profile_screen.dart` | — | Bottom-nav "Profile" tab |
| ProfileDetailScreen | `lib/features/profile/presentation/screens/profile_detail_screen.dart` | 492 | `ProfileScreen` → tile |
| EditProfileScreen | `lib/features/profile/presentation/screens/edit_profile_screen.dart` | 976 | `ProfileScreen` → "Edit Profile" |
| MyDocumentsScreen | `lib/features/kyc/presentation/screens/documents_screen.dart` | 575 | `ProfileScreen` → "My Documents" |

### 1.3 UserOnboardingScreen — 3-step stepper

| Step | Card widget | Fields | Hardcoded strings |
|---|---|---|---|
| 1 (Personal Details) | `PersonalDetailsCard` | Full name, DOB, Email, Phone (read-only), Father's name, Mother's name, Current address (textarea) | "Personal Details", "Full Name", "Enter full name", "Date of Birth", "YYYY-MM-DD", "Email Address", "Enter email address", "PHONE NUMBER", "Father's Name", "Mother's Name", "Current Address", "Enter your full address" |
| 2 (Identity + Bank) | `IdentityVerificationCard` | Aadhaar front, Aadhaar back, PAN, "Bank Details" dialog | "Aadhaar Card\n(Front)", "Aadhaar Card\n(Back)", "PAN Card", "Bank Details", "Bank Name", "Account Number", "IFSC Code", "Take a Photo", "Choose from Gallery", "Close", "Save" |
| 3 (Selfie + Signature) | `SelfieCard` + `SignatureCard` | Selfie (camera-only), Signature pad | "Rider Photo", "Take Rider Photo", "Tap to capture your photo", "Photo Captured", "Draw Signature", "Clear", "Save" |

Bottom button (`UserOnboardingBottomButton`): "Confirm & Proceed" + small "ENSURE ALL DETAILS ARE ACCURATE BEFORE PROCEEDING" caption.

### 1.4 Form cache (offline draft)

`KycRepository.saveFormCache()` writes a plain JSON blob to `SharedPreferences` under key `kyc_form:<riderId>`. Payload:
- name, email, address, dob, fatherName, motherName, bankName, bankAccount, bankIfsc
- aadhaarFrontPath, aadhaarBackPath, panPath, selfiePath, signaturePath (local file paths)

A legacy in-memory map is kept for one release so a rider who filled the form before this fix shipped still sees their data on first cold start after upgrade (PR-ONBOARDING-2026-08-11 fix #4).

### 1.5 Local document cache

`DocumentLocalCache.save('aadhaarFront' | 'aadhaarBack' | 'panCard' | 'signature', path)` keeps the file path in cache. The actual image bytes live on disk under the app's documents directory. After upload succeeds, the local copy is used for offline viewing in `MyDocumentsScreen._viewDocument()`.

### 1.6 API surface

| Method | Route | Caller | Purpose |
|---|---|---|---|
| `POST /api/files/request-upload` | `VoltiumApiClient.postFilesRequestUpload` | `KycRepository.uploadDocument` → `FilesRepository.uploadFile` | 2-step signed-URL upload (request → PUT to signed URL → confirm). Category enum: `kyc_document`, `profile_photo`, `vehicle_photo`, `payment_proof`, `support_attachment`, `pickup_verification`, `RETURN_PHOTO`, `TOPUP_PROOF`, `vehicle_return`, `security_deposit`. |
| `PUT /api/rider/profile` | `VoltiumApiClient.putRiderProfile(UpdateProfileRequest)` | `KycRepository.updateProfile`, `IntentOfUseScreen`, `EditProfileScreen` | The "submit KYC" call + every profile edit. See findings #2 and #3 below. |

---

## 2. Findings

### 🔴 P0 — Real bugs (block correct KYC submission)

**F1. KycRepository.updateProfile passes the same `selfieUrl` to three different fields.**
File: `lib/features/kyc/data/kyc_repository.dart:50-56`

```dart
selfie: selfieUrl,
profilePhoto: selfieUrl,
riderPhoto: selfieUrl,
```

Server (`web/src/server/modules/riders/rider.use-cases.ts:605`):
```ts
else if (key === 'selfie') kycData['profilePhoto'] = sanitized;
else kycData[key] = sanitized;
```

The server normalises the `selfie` field to `profilePhoto`. The `riderPhoto` field then falls through to the else-branch and ends up in `kycData.riderPhoto = selfieUrl`. So both `kycData.profilePhoto` AND `kycData.riderPhoto` get the same selfie URL — and both columns exist in `KycProfile` (schema.prisma:401-402).

- **Effect:** Not data corruption (same URL goes to both columns). But it wastes bandwidth (same string sent 3x in JSON) and signals a design confusion: the rider uploads ONE selfie, but the API contract offers two fields. If the admin UI ever expects `riderPhoto` to be a separate full-body photo, that flow doesn't exist.
- **Fix:** Decide which field is canonical. If `selfie` is the rider's ID-verification photo and `riderPhoto` is a separate profile photo, the KYC form needs a second capture step. If both are the same, drop `riderPhoto` from the Flutter call (send only `selfie` + `profilePhoto`, or send one and let the server alias).

**F2. Form cache stores PII in plaintext SharedPreferences.**
File: `lib/services/cache_service.dart:230-237` (storage layer) + `lib/features/kyc/data/kyc_repository.dart:89-111` (cache writer)

```dart
// cache_service.dart
Future<void> setString(String key, String value) async {
  await _prefs?.setString(key, value);  // plaintext!
}
```

The KYC form cache key `kyc_form:<riderId>` holds plaintext JSON of: name, email, address, dob, parent names, bankName, bankAccount, bankIfsc, plus paths to Aadhaar/PAN/selfie/signature files.

- **Effect:** On Android, SharedPreferences is stored in `/data/data/<pkg>/shared_prefs/<file>.xml` — readable by anyone with root or by the user via `adb backup` on unencrypted devices. On iOS, NSUserDefaults is also plaintext. The actual photo content is on disk in the app's documents directory, but the SharedPreferences entry is enough for a forensic recovery to map "rider X has Aadhaar front at path Y, bank account Z, parent name W."
- **Bigger picture:** the KYC re-edit cache is "nice to have" (so a rider who gets a phone call doesn't lose their form). The PII tax for that convenience is real.
- **Fix options (pick one):**
  1. **Minimum:** Strip `bankAccount` + `bankIfsc` from the cache (those aren't needed for form re-hydration — only name/email/address/dob/parents are). Server already has them after the rider hits "Confirm & Proceed" the first time.
  2. **Better:** Move PII fields to `flutter_secure_storage` (Keychain on iOS, EncryptedSharedPreferences on Android). The non-PII text fields can stay in SharedPreferences.
  3. **Best:** Don't cache the form at all. The rider just got here from the intent screen; if they background the app, the form re-hydrates from `Rider` (which the server already has after the intent PUT).

**F3. The `uploadDocument` category is hardcoded as a string, not a typed enum.**
File: `lib/features/kyc/data/kyc_repository.dart:18-20`

```dart
Future<String> uploadDocument(File file, String type) async {
  return _filesRepository.uploadFile(file, type);  // 'kyc_document' or 'profile_photo'
}
```

Caller: `user_onboarding_screen.dart:560-573` passes the string `'kyc_document'` 4x and `'profile_photo'` 1x. The server's zod schema (`files.schemas.ts:6-21`) accepts 10 enum values. A typo here would surface as a 422 only at upload time, with the user staring at a "Failed to upload ${entry.key}" error.

- **Effect:** No current bug, but the typed-enum gap is exactly the kind of thing that bites when a new category is added (e.g. a future `kyc_video` category would be a silent typo if the Flutter string is wrong).
- **Fix:** Define a `FileCategory` enum on the Flutter side and use it instead of `String`. The codegen for `RequestUploadUrlRequest` already enforces the union at the JSON layer, so the enum is one line in the upload call site.

**F4. Local photo files are not deleted on KYC submit success.**
File: `lib/features/kyc/presentation/screens/user_onboarding_screen.dart:604-611`

```dart
// Cache documents locally so they can be viewed offline.
if (state.aadhaarFrontPath != null)
  DocumentLocalCache.save('aadhaarFront', state.aadhaarFrontPath!);
// ...
```

After upload, the local files are kept in the app's documents directory (per `path_provider.getApplicationDocumentsDirectory()` and `ImageCompressionService.pickAndCompress`). The cache key is cleared (`clearFormCache`), but the actual image bytes stay on disk forever.

- **Effect:** PII on disk (Aadhaar front/back, PAN, signature, selfie) persists until the user uninstalls the app. On Android, this is a sandboxed location (so the threat is "user with adb backup" or "forensic recovery"), but it's still 5 high-resolution PII images per KYC'd rider sitting on every device.
- **Fix:** On KYC success, delete the original local files (the path references can stay in cache, but `File(path).delete()` should be called). Or wipe the entire `getTemporaryDirectory()` cache after upload.

### 🟡 P1 — UX / data quality issues

**F5. No way to view a captured photo in full-screen before submit.**
File: `selfie_card.dart:53-61` and `identity_verification_card.dart` (via `doc_tile.dart:25-34`)

A rider captures an Aadhaar photo via the bottom-sheet "Take a Photo" / "Choose from Gallery" flow, and the only feedback is a 48px-thumbnail inside a `DocTile` card with a green "Uploaded" label. If the photo is blurry, has a finger over the lens, or is the wrong document, the rider finds out only when the KYC is rejected by an admin reviewer.

- **Effect:** Higher KYC rejection rate, more "please re-upload" round-trips. The selfie card already has a 160px image preview; the Aadhaar/PAN cards should too.
- **Fix:** Tap the doc tile to open a full-screen preview with "Retake" / "Use this photo" actions. The image bytes are already on disk.

**F6. The selfie tile is hardcoded to camera-only — no gallery option.**
File: `user_onboarding_screen.dart:917`

```dart
SelfieCard(
  ...
  onTap: () => _pickDocument('selfie', true),  // true = useCamera
),
```

The Aadhaar/PAN tiles go through `_showDocumentSourceDialog()` which lets the rider choose camera or gallery. The selfie tile skips the dialog and forces the camera. This is probably intentional (ID verification prefers live capture), but it surprises riders who don't realise their phone's permission dialog is for the camera specifically.

- **Fix:** If the policy is "selfie must be live capture", add a tooltip / "Why camera only?" hint. If it's accidental, route through the same bottom-sheet.

**F7. The DOB field uses YYYY-MM-DD format but the test-mode autofill uses `01-01-2000` (DD-MM-YYYY).**
File: `user_onboarding_screen.dart:259`

```dart
if (_dobController.text.isEmpty) _dobController.text = '01-01-2000';
```

Meanwhile the production `_selectDob()` writes `YYYY-MM-DD` (`user_onboarding_screen.dart:329-330`), and the server's `dob` zod schema accepts both `yyyy-mm-dd` AND `dd-mm-yyyy` (`validators.ts:37-40`).

- **Effect:** In test mode, the rider submits `01-01-2000` and the server accepts it; the profile shows the right DOB. In production, the rider picks a date and the format is `yyyy-mm-dd`. So the two formats co-exist depending on entry path. This isn't a bug per se, but it's brittle — if the server ever tightens to one format, test mode breaks.
- **Fix:** Normalise the test-mode autofill to `2000-01-01` so both paths produce the same string.

**F8. The "Bank Details" dialog title is "Bank Details" but it's only reachable from the KYC step-2 card; the actual field on the KYC tile is just a tap target with a label, not a text field.**
File: `identity_verification_card.dart` (calls `onShowBankDialog: () => _showBankDetailsDialog()`)

The dialog (`user_onboarding_screen.dart:422-482`) collects bankName + accountNumber + ifscCode, validates via `FormValidators.bankAccount` / `FormValidators.ifsc`, and on "Save" validates the form. But the dialog has no editing surface — the parent screen's `_bankNameController` is shared. After "Save", the dialog closes; the values are in the controllers. There's no visible change on the tile.

- **Effect:** The tile says "Bank Details" with a generic "Add / Edit" affordance. The rider has to open the dialog to see if their values stuck. There's no inline display of the bank name / masked account number on the KYC tile.
- **Fix:** Show "✓ Bank: HDFC •••• 1234" as the tile content after the dialog saves. Mask all but last 4 digits of the account number.

**F9. The form caches across all fields but the form-complete check uses a non-cached field.**
File: `user_onboarding_screen.dart:401-419` (`_isFormComplete`) vs `:768-797` (`_canProceedCurrentStep`)

Two near-duplicate methods exist. The cache write (line 195-216) fires on every keystroke, but the read of "are we complete?" doesn't consult the cache — it reads from the controllers. The two methods also have inconsistent checks: `_isFormComplete` requires `_bankAccountController.text.trim().length >= 6`, but `_canProceedCurrentStep` for step 2 uses `FormValidators.bankAccount(...) == null` which requires 9-18 digits per the validator (the spec is broader).

- **Effect:** A rider can type a 6-character string in the bank-account field, which passes `_isFormComplete` (so the bottom "Confirm" button activates at step 3) but would fail server-side validation. The "Save" in the bank dialog DOES use the proper validator, so the discrepancy is between the bottom-button step-completion check and the actual save.
- **Fix:** Extract a single `_formState` (or `FormValidators` instance) and use it for both checks.

**F10. Step-indicator dots show "1", "2", "3" but the current step is also passed as a 0/1/2 index, leading to a visible off-by-one.**
File: `user_onboarding_screen.dart:727-749`

```dart
Widget _buildDot(int step, int currentStep) {
  final isActive = currentStep >= step;  // step 3 is active when currentStep >= 3
  ...
  Text('$step', ...)  // hardcoded "1" / "2" / "3"
}
```

The state stores `currentStep` as 1-based (init = 1, nextStep() = +1). The indicator is correct. But `prevStep()` clamps to 1-3 and `nextStep()` doesn't clamp — if a future refactor pushes currentStep past 3 by accident, the dots show step "3" as active even when the rider is on step 4 (hypothetical future). No current bug; flagging for the refactor.

**F11. Hardcoded English strings on a fully-built form (l10n gap).**
File: `personal_details_card.dart:71,78,79,87,88,96,97,107,108,116,117,125,126`, `identity_verification_card.dart:80,92,108,120`, `user_onboarding_screen.dart:351,367,376,427,443,451,458,469,477,835,836`, `signature_pad_screen.dart:76,86,95`, `doc_tile.dart:50`, `selfie_card.dart:48,88,95,122`, `user_onboarding_bottom_button.dart:84,92`

This is the 4 hardcoded literals that the previous audit's `i18n_no_new_dead_keys_test` flagged on the KYC + signature pad screens:
- `user_onboarding_screen.dart:367` ("Take a Photo"), `:376` ("Choose from Gallery"), `:427` ("Bank Details"), `:469` ("Close")
- `personal_details_card.dart` — 12+ labels (all "Full Name", "Date of Birth", "Email Address", "PHONE NUMBER", etc.)
- `user_onboarding_screen.dart:351` ("Enter your device lock password to verify security configuration." — this one is in the settings lock dialog, not the KYC screen, but it's in the same KYC directory)
- `signature_pad_screen.dart:76,86,95` — "Draw Signature", "Clear", "Save"
- `doc_tile.dart:50` — "Uploaded"
- `selfie_card.dart:48,88,95,122` — "Rider Photo", "Take Rider Photo", "Tap to capture your photo", "Photo Captured"
- `user_onboarding_bottom_button.dart:84,92` — "Confirm & Proceed", "ENSURE ALL DETAILS ARE ACCURATE BEFORE PROCEEDING"

The ARB already has all of these (we verified in the previous PR). A focused T-66 follow-up wiring pass can clear them in one PR.

### 🟢 P2 — Minor / dead code / nice-to-have

**F12. The legacy in-memory cache fallback is flagged "remove after next release" but still ships.**
File: `lib/features/kyc/data/kyc_repository.dart:80-85`

```dart
// The legacy in-memory map is retained as a one-shot read fallback so
// a rider who filled the form BEFORE this fix shipped still sees
// their data on the first cold start after upgrade. Once the cache
// is written through to SharedPreferences, the in-memory copy is
// discarded. Remove this after the next release.
static final Map<String, Map<String, String>> _legacyInMemoryCache = {};
```

The comment is correct but the cleanup never happened. This is a static map that grows unbounded for the lifetime of the process (one entry per riderId per cold start). For a low-volume KYC flow it's a non-issue, but it's also dead code in steady state. Either remove it now (the upgrade happened in 2026-08-11; any rider who filled the form before then has long since submitted or uninstalled) or move the cleanup to a follow-up ticket with an explicit "remove after 2026-12-01" date.

**F13. `_SignaturePainter.shouldRepaint` always returns true.**
File: `signature_pad_screen.dart:161`

```dart
@override
bool shouldRepaint(covariant _SignaturePainter old) => true;
```

For a short signature this is irrelevant. For a long signature the canvas redraws from scratch on every pan-update instead of only when the points list changes. Not a real perf issue (CustomPaint is cheap), but a correctness fix is one line: `return old.points.length != points.length || !_listEquals(old.points, points);`. Or just compare `old.points.length != points.length` since the painter only adds points monotonically.

**F14. Error mapping uses substring matching on the exception string.**
File: `user_onboarding_screen.dart:692-706`

```dart
String _formatKycError(Object e) {
  final msg = e.toString();
  appDebug('KYC submit error: $msg');
  if (msg.contains('422') || msg.contains('VALIDATION')) { ... }
  else if (msg.contains('401') || msg.contains('unauthorized')) { ... }
  else if (msg.contains('network') || msg.contains('timeout')) { ... }
  return 'Something went wrong. Please try again.';
}
```

The `ApiClient` already returns a typed `ApiException` with `statusCode` and `message` fields. String-matching for the status code is fragile (a 422 with the word "network" in the message body would route to the network branch). This is fixable in 5 minutes:

```dart
if (e is ApiException) {
  switch (e.statusCode) {
    case 422: return e.message;  // already-localised server message
    case 401: return 'Session expired. Please log in again.';
    // ...
  }
}
```

**F15. PopScope swallows the system back button without indication.**
File: `user_onboarding_screen.dart:815-824`

```dart
return PopScope(
  canPop: false,
  onPopInvokedWithResult: (didPop, result) {
    if (didPop) return;
    if (onboardingState.currentStep > 1) {
      ref.read(userOnboardingNotifierProvider.notifier).prevStep();
    } else {
      widget.onBack?.call();
    }
  },
  ...
)
```

The system back button silently navigates back. On Android there's no haptic, no toast, no animation. The rider doesn't know what happened. Compare with the curtain header's back button (line 837-845) which has the same logic but is at least visible. A subtle haptic + a brief snackbar "Step 2 of 3" would help. Not a blocker.

**F16. The form complete check accepts bank account of length >= 6 but the validator requires 9-18 digits.**
File: `user_onboarding_screen.dart:418` vs `utils/form_validators.dart:103-108`

Two different validation rules for the same field. The form-complete check is looser than the validator. See F9 for the broader fix.

**F17. `ProfileDetailScreen` (492 lines) is duplicated with `EditProfileScreen` (976 lines) for displaying the same fields.**
File: `lib/features/profile/presentation/screens/profile_detail_screen.dart` + `edit_profile_screen.dart`

Both screens have fields for fullName, email, dob, fatherName, motherName, address, bankName, bankAccount, bankIfsc. ProfileDetailScreen is read-only; EditProfileScreen is editable. This is a known split per the audit team — both are > 400 lines and contain 8+ of the same fields. A `ProfileField` shared widget would dedupe ~100 lines. Filed as T-66 follow-up.

**F18. The KYC form has no offline-mode hint.**
File: `user_onboarding_screen.dart:60-77`

The rider can fill the form while offline (the cache persists). The bottom button "Confirm & Proceed" tries to upload, which fails with a network error snackbar. A subtle "You're offline — your draft is saved" banner at the top of the screen during offline mode would help. Trivial: 5-line widget that listens to the connectivity provider.

---

## 3. Quick fix priority (what to ship first)

| # | Effort | Why it matters | Status (2026-08-17) |
|---|---|---|---|
| **F1** selfie 3x duplicate | 5 min | Cleanest data contract, removes bandwidth waste, fixes latent admin UI confusion | ✅ **DONE** (prior session) — only `profilePhoto: selfieUrl` is sent |
| **F3** typed `FileCategory` enum | 30 min | Prevents the next typo from being a silent 422 in production | ✅ **DONE** (prior session) — `enum FileCategory` in `lib/core/network/file_category.dart`, all 5 call sites use it |
| **F5** tap-doc-to-preview | 2 hr | Cuts KYC rejection rate — rider sees the photo before submit | ✅ **DONE** (verified 2026-08-17) — `DocTile._showDocumentPreviewModal` opens a full-screen `InteractiveViewer` with "Retake" (re-triggers camera/gallery) / "Keep" (dismiss) actions. ARB keys: `txtretakePhoto`, `txtkeepPhoto`, `txtuploaded`. |
| **F8** inline bank summary on KYC tile | 1 hr | Removes the "did my save stick?" anxiety | ✅ **DONE** (verified 2026-08-17) — `IdentityVerificationCard` accepts `bankSummary` parameter, populated by `user_onboarding_screen.dart:833-839` as `'✓ $bankName •••• $last4'`. |
| **F11** wire l10n in KYC form (T-66 partial) | 1 hr (with existing ARB keys) | Hindi riders see Hindi labels on the form they've been waiting for | ✅ **DONE** (verified 2026-08-17) — all KYC form strings (`IdentityVerificationCard`, `PersonalDetailsCard`, `UserOnboardingBottomButton`, `SelfieCard`, `DocTile`, `signature_pad_screen`) use `l10n?.<key>` with English fallback. The 42 hardcoded `Text()` literals that remain are in OTHER screens (dashboard, end_rental, support, wallet) — those are T-66 follow-up, not PR-B. |
| **F2** strip bankAccount/bankIfsc from cache | 15 min | The PII tax for offline draft is now scope-able to non-financial fields | ✅ **DONE** (prior session) — financial fields excluded + cache moved to `SecureStorageService` (Keychain/EncryptedSharedPreferences) |
| **F14** typed `ApiException` switch | 5 min | Removes substring-matching fragility, one correctness class gone | ✅ **DONE** (prior session) — switch on `e.statusCode` with substring fallback only for non-ApiException errors |
| **F4** delete local files on KYC success | 30 min | Stops 5 PII images sitting on every KYC'd device forever | ✅ **DONE** (prior session) — files deleted on submit success |
| **F7** test-mode DOB format | 1 min | Brittleness tax, costs nothing to fix | ✅ **DONE** (prior session) — `'2000-01-01'` (YYYY-MM-DD) |
| **F9 / F16** unify form-complete logic | 30 min | Removes the "I typed 6 digits, why isn't the button active?" rider confusion | ⏳ pending — P1 (PR-B) |

**F6, F10, F12, F13, F15, F17, F18** are nice-to-haves. Fix in any order.

---

## 4. What I'd ship in the next PR

If the lead has 2 days for KYC hardening, I'd group as follows:

**PR-A: 1-day, focused.** F1 + F2 (cache-strip) + F3 (typed enum) + F4 (delete local files) + F7 (DOB format) + F14 (typed ApiException). All backend-compatible, no API contract changes, all behavioural hardening. Diff stays under 200 lines across 3 files. — **✅ ALL 6 SHIPPED in a prior session (verified 2026-08-17).** The mock file in `test/core/state/logout_reset_test.dart` had to be updated to match the new `dynamic category` signature of `FilesRepository.uploadFile`; one-line fix.

**PR-B: 1-day, UX.** F5 (tap-doc-to-preview) + F8 (inline bank summary) + F11 (l10n wiring in this form) + F18 (offline-mode banner). Touches 3 widgets + 1 ARB batch, no backend change. — ✅ **ALL 4 SHIPPED in a prior session (verified 2026-08-17).** No backend changes; the widgets and ARB keys were already in place. The `i18n_no_new_dead_keys_test` baseline dropped from 43 → 42 with this PR.

Both PRs are independent and ship-it PRs. Combined diff is ~500 lines across ~6 files.

---

## 5. What I'd defer

- **F6** (selfie camera-only hint) — until we have user feedback saying riders are confused
- **F10** (off-by-one in step dots) — no current bug, wait for a real refactor
- **F12** (legacy in-memory cache) — minor memory cost, leave the comment as the marker
- **F13** (signature painter repaint) — non-issue, not worth a PR
- **F15** (back button haptic) — UX nice-to-have, low impact
- **F16** → folded into F9
- **F17** (split profile_detail / edit_profile widgets) — refactor, separate ticket
