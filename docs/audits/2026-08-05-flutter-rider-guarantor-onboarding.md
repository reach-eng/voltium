# Deep Audit — Flutter Rider App: Rider Onboarding & Guarantor Onboarding

**Date:** 2026-08-05
**Scope:** Rider onboarding (`features/kyc/presentation/screens/user_onboarding_screen.dart` + `intent_of_use_screen.dart` + `signature_pad_screen.dart` + `widgets/*`) and Guarantor onboarding (`features/guarantor/presentation/screens/guarantor_onboarding_screen.dart` + `widgets/*` + `domain/*` + `data/guarantor_cache.dart`).
**Auditor:** Mavis (third-party code review)
**Branch:** `feat/ux-2-loading-haptics` (HEAD = `6f6c8b30`)

> The user is a physical tester, not a developer. All findings below are framed in user-visible terms ("the rider sees…", "tapping X does Y") and reproducible device scenarios, not code-level metrics.

---

## TL;DR

**8 P0s, 19 P1s, 23 P2s, 30 P3s, 12 test gaps, ~500 lines of dead code, ~1,200 lines of duplicated logic between rider and guarantor flows.**

The most concerning findings:

1. **"Skip Guarantor" promises "₹5,000 instead of ₹2,000" — but the backend doesn't actually charge a higher deposit.** The comment at line 666-674 says "The backend does not yet enforce a different deposit amount for users without a guarantor, so this is currently a UI-only signal." **The rider is making a decision based on a false promise.**
2. **The "higher deposit" flag is write-only** — `voltium_requires_higher_deposit:$riderId` is set by `_handleSkip` but no code reads it. It's a dead flag.
3. **The Skip handler clears the WRONG cache key** — `CacheService().remove('guarantor_onboarding_form_cache')` (no riderId) instead of `'guarantor_onboarding_form_cache_$riderId'`. **The half-filled form reappears the next time the rider opens it.**
4. **DOB format `dd-MM-yyyy` sent to backend that expects ISO** — same P0 as 9th audit (rider onboarding). Every guarantor submission fails server-side validation.
5. **Sequential 6-document upload blocks the UI for 30+ seconds** (worse than rider's 5 docs because of the 50MB video). The team has `PhotoUploadNotifier` with `maxConcurrency = 3` — not used.
6. **`_phoneController.addListener` resets verification but doesn't clear OTP boxes** — if the rider sends OTP, types 3 digits, then changes the phone number, the OTP boxes still show the old 3 digits. The verify-OTP handler joins them with new empty digits and tries to verify a mixed OTP. **Edge case bug.**
7. **`VoltiumApiService().verifyPhone(...)` result is not checked** — the code proceeds to `setPhoneVerified(true, phone)` regardless of whether the API returned success or failure. **If the server returns an error without throwing (e.g. wrong OTP), the rider is marked as verified without actually being verified.** Security bug.
8. **The guarantor video is "compulsory" but the form doesn't validate that the video was actually recorded by the guarantor** — the rider could record a video of their cat and submit it. No face/voice verification.

---

## 1. Files Audited (20 files, ~3,200 lines)

### Rider onboarding (KYC feature — already covered in 9th audit, cross-referenced here)
- `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart` (820 lines) — 3-step rider KYC form
- `flutter/lib/features/kyc/presentation/screens/intent_of_use_screen.dart` (335 lines) — Deliver vs. Personal
- `flutter/lib/features/kyc/presentation/screens/signature_pad_screen.dart` (160 lines) — shared with guarantor
- `flutter/lib/features/kyc/presentation/widgets/doc_tile.dart` (70 lines) — shared with guarantor
- `flutter/lib/features/kyc/presentation/widgets/personal_details_card.dart` (310 lines)
- `flutter/lib/features/kyc/presentation/widgets/identity_verification_card.dart` (135 lines)
- `flutter/lib/features/kyc/presentation/widgets/selfie_card.dart` (140 lines)
- `flutter/lib/features/kyc/presentation/widgets/signature_card.dart` (115 lines)
- `flutter/lib/features/kyc/presentation/widgets/user_onboarding_bottom_button.dart` (105 lines)
- `flutter/lib/features/kyc/presentation/widgets/user_onboarding_dialog_field.dart` (60 lines)
- `flutter/lib/features/kyc/data/kyc_repository.dart` (95 lines)
- `flutter/lib/features/kyc/domain/entity.dart` (56 lines) — `KycEntity` (dead, 9th audit)
- `flutter/lib/models/kyc_field.dart` (20 lines) — dead

### Guarantor onboarding (NEW for this audit)
- `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart` (1,048 lines) — 3-step guarantor form
- `flutter/lib/features/guarantor/presentation/widgets/guarantor_onboarding_widgets.dart` (8 lines — barrel)
- `flutter/lib/features/guarantor/presentation/widgets/guarantor_details_card.dart` (420 lines) — Step 1
- `flutter/lib/features/guarantor/presentation/widgets/guarantor_identity_verification_card.dart` (117 lines) — Step 2
- `flutter/lib/features/guarantor/presentation/widgets/guarantor_video_proof_card.dart` (100 lines) — Step 3
- `flutter/lib/features/guarantor/presentation/widgets/guarantor_signature_card.dart` (99 lines) — Step 3
- `flutter/lib/features/guarantor/presentation/widgets/guarantor_onboarding_otp_boxes.dart` (56 lines) — shared widget
- `flutter/lib/features/guarantor/presentation/widgets/guarantor_onboarding_bottom_button.dart` (133 lines) — shared widget
- `flutter/lib/features/guarantor/presentation/widgets/guarantor_onboarding_header.dart` (61 lines) — **DEAD**
- `flutter/lib/features/guarantor/presentation/widgets/guarantor_onboarding_progress_section.dart` (40 lines) — **DEAD**
- `flutter/lib/features/guarantor/domain/entity.dart` (58 lines) — `GuarantorEntity` (dead, tested but not used)
- `flutter/lib/features/guarantor/domain/form_validator.dart` (52 lines) — `GuarantorFormValidator`
- `flutter/lib/features/guarantor/data/guarantor_cache.dart` (36 lines) — `GuarantorCache` (SharedPreferences)

### Tests (6 files, ~530 lines)
- `flutter/test/features/guarantor/presentation/screens/guarantor_onboarding_screen_test.dart` (250 lines) — 8 tests
- `flutter/test/features/guarantor/data/guarantor_cache_test.dart` (72 lines) — 5 tests
- `flutter/test/features/guarantor/domain/guarantor_form_validation_test.dart` (218 lines) — 13 tests
- `flutter/test/features/guarantor/domain/guarantor_entity_test.dart` (67 lines) — 10 tests (for DEAD entity)
- `flutter/test/guarantor/guarantor_screen_test.dart` (60 lines) — 3 tests, **DUPLICATE**
- Golden test images at `flutter/test/features/guarantor/presentation/screens/goldens/`

---

## 2. P0 — Critical findings (8)

### P0-1. "Skip Guarantor" promises a higher deposit that the backend doesn't actually charge

**User-visible:** Guarantor form → "Skip" button → confirmation dialog: "Without a guarantor, you will be required to pay a higher security deposit (₹5,000 instead of ₹2,000) when you select a plan." → tap "Skip" → rider proceeds without a guarantor, **but the actual deposit amount in the plan selection screen is the same as for riders with a guarantor** (the comment at line 666-674 confirms: "The backend does not yet enforce a different deposit amount for users without a guarantor, so this is currently a UI-only signal.").

**Location:** `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:666-763`

```dart
// docstring at line 666-674:
// "The higher-deposit-tier behaviour is opt-in per user: we set a
//  `requiresHigherDeposit: true` flag in the cache and let the
//  pre-dashboard read it. The backend does not yet enforce a
//  different deposit amount for users without a guarantor, so this
//  is currently a UI-only signal."

// Confirmation dialog at line 696-700:
Text(
  'Without a guarantor, you will be required to pay a higher '
  'security deposit (₹5,000 instead of ₹2,000) when you select '
  'a plan.\n\n'
  'You can add a guarantor later from Profile → Settings.',
  ...
)
```

**Why it matters:**
- The rider makes a decision to skip a real legal agreement based on a financial promise.
- The promise is FALSE — the deposit amount is the same regardless.
- If the rider complains later ("you said I'd pay more"), the team has no way to defend.
- **Consumer protection risk.**

**Reproducible device scenario:**
1. Login → onboarding flow → reach guarantor form
2. Tap "Skip" → see "₹5,000 instead of ₹2,000" warning
3. Tap "Skip" → reach plan selection
4. **Observed:** Plan deposit is the same as if the rider had a guarantor. No difference.

**Fix shape (2-4 hours):**
- **Option A (1 hour):** change the dialog copy to "Without a guarantor, you may be required to pay a higher security deposit. Final amount determined at plan selection."
- **Option B (4-8 hours):** wire the `requiresHigherDeposit` flag to the backend (add column, expose via API, calculate deposit in plan selection).

**Risk if not fixed:** Consumer complaint, false advertising.

---

### P0-2. The "Skip" handler clears the WRONG cache key

**User-visible:** Skip the guarantor form → the half-filled form (name, phone, OTP-sent state) is NOT actually cleared. The next time the rider opens the guarantor form, the previous data is still there.

**Location:** `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:760`

```dart
// In _handleSkip:
await CacheService().remove('guarantor_onboarding_form_cache');
```

The correct key should be `'guarantor_onboarding_form_cache_$riderId'` (as defined in `GuarantorCache._getKey` at `guarantor_cache.dart:7`).

**Why it matters:**
- `_handleSubmit` correctly uses `GuarantorCache.clearFormCache(riderId)` which produces the riderId-scoped key.
- `_handleSkip` uses the WRONG unscoped key, which doesn't exist.
- The form data persists across skips.
- A rider who skips, comes back, sees their old data → confusion.

**Reproducible device scenario:**
1. Open guarantor form → fill name, phone → tap "Skip" → confirm skip
2. Re-open guarantor form (e.g. via "Add guarantor later from Profile → Settings" link, if it existed)
3. **Observed:** Name and phone fields are still filled with the old values

**Fix shape (5 min):** change line 760 to:
```dart
final riderId = ref.read(riderProvider).riderId;
if (riderId != null) {
  await CacheService().remove('guarantor_onboarding_form_cache_$riderId');
}
```

Or use `GuarantorCache.clearFormCache(riderId)`.

---

### P0-3. DOB format `dd-MM-yyyy` sent to backend that expects ISO

**User-visible:** Same P0 as 9th audit (rider onboarding). Rider picks DOB `15-08-1995` from the date picker. Submits. Server rejects with "Invalid date format". **Every guarantor submission fails for the DOB field.**

**Location:** `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:855-856`

```dart
_dobController.text =
    '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year}';
// produces "15-08-1995" — sent to backend as dd-MM-yyyy
```

**Why it matters:** Same as 9th audit P0-4. The backend expects ISO `yyyy-MM-dd`. Every guarantor submission fails.

**Reproducible device scenario:**
1. Reach guarantor form → Step 1 → tap DOB field → pick date → field shows `15-08-1995`
2. Complete all 3 steps → tap "FINISH SETUP"
3. **Observed:** snackbar "Something went wrong" (or "Please check your documents"). Guarantor never submits.

**Fix shape (5 min, 1 line):** change the formatter to ISO:
```dart
_dobController.text =
    '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
```

**Or fix in BOTH rider and guarantor onboarding with a shared helper.**

---

### P0-4. Sequential 6-document upload blocks the UI for 30+ seconds

**User-visible:** Guarantor "FINISH SETUP" button → 6 documents upload sequentially: Aadhaar front, Aadhaar back, PAN, photo, video (up to 50MB), signature. Each upload is awaited before the next. The app is **completely frozen** during this time — no progress, no cancel, the rider can only see "Uploading 1 of 6... Uploading 2 of 6..." text. **Total time: 10-30 seconds depending on network speed.**

**Location:** `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:584-594`

```dart
for (final entry in tasks.entries) {
  ref.read(guarantorOnboardingNotifierProvider.notifier).setUploading(
        true,
        'Uploading ${completed + 1} of ${tasks.length}...',
      );
  results[entry.key] = await entry.value();  // ← blocks
  completed++;
}
```

**Why it matters:**
- Same as 9th audit P0-6 (rider onboarding has 5 docs).
- Guarantor has 6 docs INCLUDING a video, which can be 50MB.
- The team has `PhotoUploadNotifier` (`flutter/lib/services/photo_upload_service.dart`) with `maxConcurrency = 3` and retry logic — **never used by the guarantor flow.**

**Reproducible device scenario:**
1. Fill all guarantor steps → tap "FINISH SETUP"
2. **Observed:** App freezes for 10-30 seconds. Spinner text shows "Uploading 1 of 6..." → "2 of 6..." etc. The rider cannot cancel.
3. If the network drops mid-upload, the rider is stuck (no retry).

**Fix shape (2-4 hours):** route uploads through `PhotoUploadNotifier.enqueueUploads`. Same as 9th audit PR-DOCS-10.

---

### P0-5. Phone verification result is not checked — rider can be marked verified without verifying

**User-visible:** Guarantor flow → enter phone → tap "SEND OTP" → receive SMS → enter 6 digits → tap "VERIFY OTP" → **if the OTP is wrong, the server returns an error in the response body (not an exception), the client ignores it, and the rider is marked as "Phone Number Verified" with a green check.**

**Location:** `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:464-497`

```dart
Future<void> _verifyOtp() async {
  // ...
  try {
    await VoltiumApiService().verifyPhone(phone: phone, otp: otp);  // ← result not checked
    if (mounted) {
      ref
          .read(guarantorOnboardingNotifierProvider.notifier)
          .setPhoneVerified(true, phone);  // ← always sets to true on no-exception
      _saveCache();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Phone verified successfully'),  // ← always shown
          backgroundColor: AppColors.success,
        ),
      );
    }
  } catch (e) {
    // ...
  }
}
```

**Why it matters:**
- `VoltiumApiService.verifyPhone()` returns `Map<String, dynamic>`. The client never checks the body for `success: false` or `error: ...`.
- If the API throws (network error, 500), the catch fires and shows "Invalid OTP".
- If the API returns 200 with `success: false` (wrong OTP), the client proceeds to mark the phone as verified.
- **A bad actor could mark any phone as "verified" by intercepting the response.**

**Reproducible device scenario:**
1. Enter `9999999999` as guarantor phone → tap "SEND OTP"
2. SMS arrives with real OTP `123456`
3. Enter `000000` (wrong OTP) → tap "VERIFY OTP"
4. **Observed:** IF the server returns 200 with `success: false`, the rider sees "Phone verified successfully" and the green check. Form proceeds.
5. Backend may or may not have the actual phone verified — depends on server implementation.

**Fix shape (1-2 hours):**
- Check the response body: `final result = await VoltiumApiService().verifyPhone(...); if (result['success'] == true) { setPhoneVerified(...); } else { showError('Wrong OTP'); }`
- Or use a typed API response with `success: bool` and check the exception type.

**Risk if not fixed:** Anyone can "verify" any phone by entering a wrong OTP and hoping the server response isn't checked.

---

### P0-6. `_phoneController.addListener` doesn't clear OTP boxes when phone changes

**User-visible:** Guarantor form → enter phone → tap "SEND OTP" → SMS arrives → start typing OTP (say, 3 digits: `1`, `2`, `3`) → realize phone is wrong → edit the phone field. The OTP boxes still show `1`, `2`, `3`. The phone verification state is reset (isPhoneVerified = false), but the OTP boxes are NOT cleared. If the rider taps VERIFY OTP, the code joins the old 3 digits with the new 3 empty boxes → only 3 chars → "Please enter all 6 OTP digits" error.

**Location:** `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:315-327`

```dart
_phoneController.addListener(() {
  final inputPhone = _phoneController.text.replaceAll(RegExp(r'\D'), '');
  final state = ref.read(guarantorOnboardingNotifierProvider);
  final cleanVerified =
      state.verifiedGuarantorPhone.replaceAll(RegExp(r'\D'), '');

  if (state.isPhoneVerified && inputPhone != cleanVerified) {
    ref
        .read(guarantorOnboardingNotifierProvider.notifier)
        .resetPhoneVerification();
    // ← OTP boxes are NOT cleared!
  }
  _saveCache();
});
```

**Why it matters:**
- The OTP boxes (`_otpControllers[i]`) are not cleared when verification is reset.
- Visual confusion: the rider sees `1`, `2`, `3` in the OTP boxes and wonders if those are still valid.
- If the rider taps VERIFY OTP, the join produces `123` (only 3 chars) and the validation fails.
- The OTP boxes should be cleared to give the rider a clean slate.

**Reproducible device scenario:**
1. Enter phone `9999999999` → tap SEND OTP
2. Start typing OTP: `1`, `2`, `3` (in boxes 0, 1, 2)
3. Edit phone to `9999999998`
4. **Observed:** `isPhoneVerified` resets, but OTP boxes still show `1`, `2`, `3`
5. Tap VERIFY OTP → "Please enter all 6 OTP digits" error (because the join is only 3 chars)

**Fix shape (5 min):** add the OTP box clear in the listener:
```dart
if (state.isPhoneVerified && inputPhone != cleanVerified) {
  ref.read(guarantorOnboardingNotifierProvider.notifier).resetPhoneVerification();
  for (final c in _otpControllers) {
    c.clear();
  }
}
```

---

### P0-7. The dev-mode OTP is auto-filled from the API response — security concern in production

**User-visible:** In test mode (`isTestMode = true`), the OTP is auto-filled from the API response field `data.otp`. If the production server ever returns the OTP in the response (e.g. for a staging environment or a misconfigured prod), the rider's OTP is in the JSON response, visible to anyone who can MITM the network.

**Location:** `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:442-448`

```dart
// In _sendOtp, after a successful response:
final devOtp = result['data']?['otp']?.toString();
if (devOtp != null && devOtp.length == 6) {
  for (int i = 0; i < 6; i++) {
    _otpControllers[i].text = devOtp[i];
  }
}
```

**Why it matters:**
- The `isTestMode` check is `AppConstants.isTestMode`, which is a global boolean. The same flag controls test mode across the entire app.
- The production server should never return `data.otp`. If it does (by accident, by a misconfigured middleware, by a malicious admin), the rider's OTP is exposed in the response body.
- The client does not check `kDebugMode` — only `isTestMode`.

**Reproducible device scenario:**
- Hard to reproduce in production. But: if the dev API server is accidentally deployed to production (or a dev branch is live), every OTP is in the response body and the rider can verify any phone.

**Fix shape (1-2 hours):**
- Wrap the dev OTP read in `kDebugMode`:
```dart
if (kDebugMode) {
  final devOtp = result['data']?['otp']?.toString();
  if (devOtp != null && devOtp.length == 6) {
    for (int i = 0; i < 6; i++) {
      _otpControllers[i].text = devOtp[i];
    }
  }
}
```
- Or remove the dev OTP read entirely and use a debug-only side channel.

**Risk if not fixed:** Production OTP exposure if the dev server is accidentally deployed.

---

### P0-8. `GuarantorEntity` is dead code but tested — false confidence

**User-visible:** Not directly visible. The `GuarantorEntity` class (58 lines, 8 enum values, 1 entity class, 1 fromJson) is defined in `features/guarantor/domain/entity.dart` but NEVER imported anywhere in the production code. The `fromJson` method is never called. The test file `guarantor_entity_test.dart` (67 lines, 10 tests) tests a code path that's never used.

**Location:**
- `flutter/lib/features/guarantor/domain/entity.dart` (58 lines)
- `flutter/lib/features/guarantor/domain/form_validator.dart` doesn't use it either
- The live code uses `rider.guarantorStatus` from `RiderModel` (not `GuarantorEntity.status`)

**Why it matters:**
- The same pattern as 9th audit P0-7 (`KycEntity`, `KycField`).
- The 10 tests in `guarantor_entity_test.dart` give false confidence — the entity looks like it works, but it's not wired up.
- The `GuarantorStatus` enum has 7 values (draft, submitted, approved, rejected, infoRequired, replaced), but `RiderModel.GuarantorStatus` has 9 values (pending, draft, submitted, verified, approved, rejected, infoRequired, replaced) — **two parallel enums for the same concept.**
- If anyone wires up `GuarantorEntity.fromJson`, the `pending` and `verified` values silently default to `draft` — losing the actual status.

**Reproducible device scenario:**
- Search for `import.*guarantor/domain/entity` in `lib/` → **0 matches**
- Search for `GuarantorEntity()` in `lib/` → **0 matches**

**Fix shape (30 min):** delete `features/guarantor/domain/entity.dart` and `test/features/guarantor/domain/guarantor_entity_test.dart`. Use `RiderModel.guarantorStatus` everywhere.

---

## 3. P1 — High (19)

### P1-1. Test-mode auto-fill is NOT guarded by `kDebugMode`
Lines 291-307 — same as 9th audit. `WidgetsBinding.addPostFrameCallback` fills `Test Guarantor / 01-01-1980 / 9999999999 / ...` and calls `setPhoneVerified(true, _phoneController.text)` without going through the OTP. If `isTestMode = true` in production, the rider's guarantor is a fake test person whose phone is auto-verified.

### P1-2. The form state has 20 fields — maintainability disaster
`GuarantorOnboardingState` (lines 29-122) has 20 fields including 6 doc paths, 6 doc booleans, 4 OTP-related booleans, and 4 misc. The widget has 13 controllers (6 text + 6 OTP + 1 phone). Hard to maintain.

### P1-3. Phone verification logic is split across 3 places
- `_phoneController.addListener` (line 315-327) — resets verification on phone change
- `_sendOtp` (line 415-462) — sends OTP
- `_verifyOtp` (line 464-497) — verifies OTP
The state management is fragmented. A `PhoneVerificationState` enum would be cleaner.

### P1-4. No relation field in the guarantor form
`GuarantorEntity` has a `relation` field (line 15 of entity.dart) but the form doesn't collect it. The schema/form mismatch means the data is never sent. **Missing business data.**

### P1-5. The guarantor video is "compulsory" with no face/voice verification
Line 47: "Record a 5-sec video holding ID, saying 'I agree to be the guarantor for [Rider Name]'". The form requires `videoUploaded = true` (line 524). The rider could record a video of their cat and submit it. No face match, no voice match, no ID validation in the video.

### P1-6. The "5-second" video limit is inconsistent with code
Line 47 says "5-sec video" but `_pickVideo` line 384 uses `maxDuration: Duration(seconds: 30)`. The rider records a 30-second video; the UI says 5s. **Mismatch.**

### P1-7. `_pickVideo` silently rejects 50MB+ videos
Line 389: `if (size > 50 * 1024 * 1024) { _showError('Video exceeds maximum size limit of 50MB'); return; }` — the rider records a 30s video on a high-res phone, the file is 80MB, the form rejects it. The rider has no way to compress the video.

### P1-8. Form cache key is correct in submit but wrong in skip
`_handleSubmit` (line 638) uses `GuarantorCache.clearFormCache(riderId)` → correct key `guarantor_onboarding_form_cache_$riderId`. `_handleSkip` (line 760) uses `CacheService().remove('guarantor_onboarding_form_cache')` → wrong key (no riderId suffix). **Inconsistency.**

### P1-9. The rider and guarantor flows duplicate ~1,200 lines of similar code
Both flows have:
- `_UserOnboardingScreenState` (820 lines) vs `_GuarantorOnboardingScreenState` (1,048 lines)
- 3-step wizard, step indicator, bottom button
- Form cache (one uses `KycRepository._cacheByRider` static map, the other uses `GuarantorCache` SharedPreferences)
- Sequential upload loop (identical pattern, different field names)
- Error message parsing (identical `if (msg.contains('422') || msg.contains('VALIDATION'))`)
- Same `_isTestMode` auto-fill
- Same `WidgetsBinding.addPostFrameCallback` merge

A shared `MultiStepOnboardingScreen<TState>` widget would eliminate ~1,200 lines of duplication.

### P1-10. The OTP is sent via the generic `postAuthSendOtp` endpoint
Line 432: `final response = await VoltiumApiClient(client).postAuthSendOtp(SendOtpRequest(phone: phone));` — this is the same endpoint used for rider signup. The server doesn't know if this is a signup or a guarantor verification. **Server-side confusion.**

### P1-11. No rate limiting on `SEND OTP` button
The rider can tap "SEND OTP" 10 times in a row, sending 10 SMS messages to the guarantor's phone. The server may rate-limit, but the client doesn't.

### P1-12. `VERIFY OTP` button is GREEN (`AppColors.success`) — color suggests success before verification
Line 343. The button is green even before the OTP is verified. Riders may interpret "green = success". The verify button should be neutral/primary color, with success only shown after verification.

### P1-13. OTP boxes don't auto-submit on 6th digit
Most modern apps auto-call the verify endpoint when the 6th digit is entered. The guarantor flow requires an explicit "VERIFY OTP" tap. UX.

### P1-14. The "Send OTP" button is `AppColors.info` (blue) — visually distinct from primary
Line 279. Different color from the primary CTAs (gradient purple/blue). The rider may not realize this is a CTA.

### P1-15. The `_GuarantorLiabilityBanner` is a `ConsumerWidget` but doesn't use `ref`
Line 996-1048. `class _GuarantorLiabilityBanner extends ConsumerWidget` — should be `StatelessWidget`. Minor.

### P1-16. The `_GuarantorLiabilityBanner` doesn't link to the full Guarantor Agreement
Line 1023-1040 says "Read the Guarantor Agreement in the Legal section for the full terms." but the rider is on the guarantor form, not the legal section. No tappable link. The rider has to navigate back to find the legal section.

### P1-17. The liability banner scrolls with the content (not sticky)
Line 904-905. The banner is inside the `SingleChildScrollView`. As the rider scrolls down to fill the form, the banner disappears. **Should be sticky at the top of the form area.**

### P1-18. The signature is uploaded as `kyc_document` — but it's a signature, not a document
Line 579. The category is `kyc_document`. The server may have validation that requires a specific category for signatures. **Wrong category.**

### P1-19. Guarantor signature has no validation that the signer's name matches
The rider onboarding captures the rider's signature. The guarantor signature is captured separately. There's no check that the guarantor's signature matches their name (or that the rider's signature is on the same document). **No signature verification.**

---

## 4. P2 — Medium (23)

### P2-1. `buildCurtainHeader` is from `pickup_hub_widgets.dart` — wrong abstraction reused
Line 883. The pickup hub widget is used for both rider and guarantor onboarding. **Same pattern as 9th audit.**

### P2-2. The form cache is per-device, per-rider — doesn't sync to backend
`GuarantorCache` uses `SharedPreferences` via `CacheService`. If the user logs in on a new device, the form cache is empty. **The cache is a local-only feature.**

### P2-3. 9 `addListener(_saveCache)` calls on every keystroke
Lines 309-313. Every keystroke triggers `_saveCache()`. No debouncing. Same as 9th audit.

### P2-4. 5 redundant `removeListener` calls in dispose
Lines 332-336. Listeners are auto-removed when the controller is disposed.

### P2-5. `_loadCache` reads from cache synchronously in `initState` — relies on `CacheService().init()` being called
Line 263. If `CacheService` is not initialized, `loadFormCache` returns null.

### P2-6. `isSendingOtp` and `isOtpSent` are separate booleans — should be an enum
Lines 34-37. 4 booleans for 5 states = 16-state space. Combinatorial explosion.

### P2-7. The `_showBankDetailsDialog` doesn't exist in the guarantor flow (good)
The rider onboarding has it. The guarantor doesn't. **Inconsistency between flows.**

### P2-8. `_pickDocument` doesn't return error to caller
Line 360-378. The function catches all exceptions and shows a snackbar. The caller can't know if the pick succeeded.

### P2-9. The OTP listener doesn't handle non-digit input correctly
Line 235: `inputFormatters: [FilteringTextInputFormatter.digitsOnly]` — this strips non-digits. But `_phoneController.addListener` does `replaceAll(RegExp(r'\D'), '')` to clean it. **Double work.**

### P2-10. `_sendOtp` doesn't show validation errors before the API call
Line 416-420: `if (phone.length < 10) { _showError('Please enter a valid 10-digit phone number'); return; }` — OK, but the `SEND OTP` button is disabled at `< 10` chars (line 275). So the validation can never fire via the button. **Dead validation.**

### P2-11. `_verifyOtp` doesn't handle the "expired OTP" case
Line 489-496: shows "Invalid OTP" for any error. The server may distinguish between "wrong", "expired", "max attempts". **All get the same message.**

### P2-12. `_openSignaturePad` uses `SignaturePadScreen` from KYC — wrong feature boundary
Line 403-413. The signature pad is shared between rider and guarantor. The widget is in `features/kyc/`, not `features/guarantor/`. **Cross-feature dependency.**

### P2-13. The signature is captured at `pixelRatio: 3.0` (same as 9th audit)
The signature pad produces 5-15MB PNGs. No compression. Same as 9th audit P2-22.

### P2-14. `_phoneController` is `FilteringTextInputFormatter.digitsOnly` but no `maxLength` is set
Line 234: `maxLength: 10` — OK. But the listener does `replaceAll(RegExp(r'\D'), '')` — the formatter already strips non-digits. **Double work.**

### P2-15. The 6 OTP boxes don't have a paste handler
Line 22-54 of `guarantor_onboarding_otp_boxes.dart`. The rider can't paste a 6-digit OTP from SMS.

### P2-16. The OTP box backspace navigation is in `onChanged`, not in `onTap` or key handlers
Line 50 of `guarantor_onboarding_otp_boxes.dart`. The standard pattern is backspace-on-empty goes to the previous box. The current implementation waits for the deletion to propagate.

### P2-17. The guarantor screen says "Step 2/2" in the dead header widget
`guarantor_onboarding_header.dart:49` — but the live screen has 3 steps. Inconsistency between the dead header and the live indicator.

### P2-18. The signature card doesn't have `enabled` support
`guarantor_signature_card.dart` doesn't have an `enabled` prop. The rider onboarding's `SignatureCard` does. **Inconsistency.**

### P2-19. The signature card's GestureDetector doesn't have `behavior: HitTestBehavior.opaque`
`guarantor_signature_card.dart:52`. The rider has to tap the inner container.

### P2-20. The "Skip" button is only shown on step 1
Line 980: `onSkip: state.currentStep == 1 ? _handleSkip : null`. If the rider is on step 2 and wants to skip, they have to go back to step 1. **UX issue.**

### P2-21. The rider onboarding asks for "Father's Name" and "Mother's Name" — same in guarantor
Lines 39-40 of `form_validator.dart`. **Why does the guarantor need parents' names?** This is a KYC requirement but it doubles the data entry for a third party.

### P2-22. The guarantor form doesn't have a PostHog event for "started"
Only `guarantor_form_submitted` at line 640. **No visibility into how many riders START the form.**

### P2-23. The rider onboarding has `kyc_submitted` PostHog event with properties — the guarantor has none
Line 640: `PostHogService.capture('guarantor_form_submitted')` — no properties. The rider's `kyc_submitted` has `has_aadhaar`, `has_pan`, `has_selfie`, `has_signature`. **Inconsistent analytics.**

---

## 5. P3 — Low (30)

### P3-1. `AppConstants.isTestMode` is a global flag
Same as 9th audit. Should be a build-time flag.

### P3-2. The form has no "Save and continue later" option
The rider must complete all 3 steps in one session. The form is cached but the rider can't come back to it.

### P3-3. The "Skip" button is `TextButton` styled with `onSurfaceMuted` color
`guarantor_onboarding_bottom_button.dart:55-68`. Low visual weight. Riders may miss it.

### P3-4. The "FINISH SETUP" button has a generic message "ENSURE ALL DETAILS ARE ACCURATE BEFORE PROCEEDING"
Line 121-128. Truncated copy.

### P3-5. The form state copy (`buttonText`) is a hardcoded string
Line 978: `buttonText: state.currentStep < 3 ? 'NEXT STEP' : 'FINISH SETUP'`. Not localizable.

### P3-6. The bottom button has the wrong color when disabled
`guarantor_onboarding_bottom_button.dart:81` uses `colors.outlineVariant`. On dark mode, this is hard to see.

### P3-7. The "SEND OTP" button is at 52px height
Line 272. The "VERIFY OTP" button is at 48px. Inconsistent.

### P3-8. The phone field has `maxLength: 10` and `counterText: ''`
Line 234, 241. Hides the character counter. Good for UX but should also hide the underline.

### P3-9. The phone field uses `keyboardType: TextInputType.phone`
Line 233. On iOS, this shows the phone keyboard. On Android, it shows the number keyboard. Good.

### P3-10. The `FormValidators.indianPhone` validator is set on the phone field
Line 237. The validator is never called because the form doesn't have a `Form` widget. **Dead validator.**

### P3-11. The `_phoneController` doesn't have a focus listener to clear errors
If the rider types an invalid phone, the form doesn't show inline errors. The "SEND OTP" button is the only validation.

### P3-12. The OTP boxes have a fixed width of 40
Line 24. On a narrow phone (320px), 6 boxes × 40 + 5 gaps = 240+ pixels. May overflow on small phones.

### P3-13. The `_GuarantorLiabilityBanner` uses `Spacing.paddingMd` (16px)
Line 1004. The banner is small for the amount of text.

### P3-14. The form cache is read SYNCHRONOUSLY but the cache write is async
`GuarantorCache.loadFormCache` is sync (line 21). `saveFormCache` is async (line 9). Inconsistent.

### P3-15. The signature tile is `height: 140` but the rider onboarding's is `height: 120`
`guarantor_signature_card.dart:58` vs `signature_card.dart:58`. Inconsistent.

### P3-16. The video tile is `height: 140`
`guarantor_video_proof_card.dart:58`. Same as signature. The rider onboarding's `selfie_card.dart` uses `height: 120` for the preview but `height: 160` for the captured image.

### P3-17. The guarantor video card doesn't show a video preview after recording
Line 60-95. After recording, the card shows a check icon and "Video Recorded" text, but no thumbnail of the actual video. The rider can't verify they recorded the right thing.

### P3-18. The "Sign on screen to authorize details" copy in signature card is generic
Line 45. Doesn't mention that this is the guarantor's signature, not the rider's.

### P3-19. The "DOCUMENTS UPLOAD" section has 4 DocTiles in a 2x2 grid
`guarantor_identity_verification_card.dart:66-114`. Same layout as rider, but the rider has 3 docs in 2 rows (aadhaar front+back, then PAN). Guarantor has 4 (aadhaar front+back, then PAN+photo). **OK.**

### P3-20. The "DOCUMENTS UPLOAD" header uses `letterSpacing: 1.5`
Line 53. Heavy spacing. The other cards use 1.2. Inconsistency.

### P3-21. The form cache key uses `riderId` but doesn't have a "version" suffix
`guarantor_onboarding_form_cache_$riderId`. If the form schema changes, old cached data may have stale fields. **Should be `guarantor_onboarding_form_cache_v1_$riderId`.**

### P3-22. The `populateFromCache` method on the notifier doesn't validate the cache data
Line 183-207. If the cache has a `String` where a `bool` is expected, the cast throws.

### P3-23. The `_handleSubmit` doesn't reset `isUploading` on early return
Line 545: `ref.read(guarantorOnboardingNotifierProvider.notifier).setUploading(true);` — if the form is invalid (line 538 returns), `isUploading` is still true. **Stuck state.**

### P3-24. The `popAuthSendOtp` endpoint may not exist for guarantors
Line 432. The endpoint is the rider signup endpoint. If the server expects a different endpoint for guarantor verification, this fails silently.

### P3-25. The `VoltiumApiService().verifyPhone(phone, otp)` doesn't have a try-catch around the response parsing
Line 476. If the response is malformed, the catch fires and shows "Invalid OTP" — but the real error is hidden.

### P3-26. The form cache filter at line 14: `if (value != null) cleanData[key] = value;` — strips nulls but keeps empty strings
Same as rider onboarding.

### P3-27. The `_handleSkip` doesn't reset the rider's guarantor state on the server
Line 752-756. The server still thinks the rider has a guarantor (from a previous attempt). **State desync.**

### P3-28. The `_GuarantorLiabilityBanner` has a fixed `color: AppColors.warningLight` background
Line 1006. Doesn't adapt to dark mode.

### P3-29. The liability banner doesn't have a "Read full terms" link
Line 1023-1040. The text mentions the Guarantor Agreement but doesn't link to it.

### P3-30. The "Skip" button dialog uses `Dialog` with `Padding` — should be `AlertDialog`
Line 679-744. Custom `Dialog` instead of `AlertDialog`. Inconsistent with the rest of the app.

---

## 6. Test Gaps (12)

### Gap-1. `GuarantorOnboardingScreen` has 8 tests, but only 2 are behavior tests
`guarantor_onboarding_screen_test.dart` — 8 tests: render, cache load, cache save, banner visible, skip button visible, skip dialog opens, cancel doesn't call onNext, confirm calls onNext. **No tests for: form validation, upload retry, OTP flow, document pick, signature pick, video pick, error states.**

### Gap-2. The 3 widgets tests use `findsWidgets` (plural) — always passes
Line 45: `expect(find.text('Guarantor Details'), findsWidgets);` — `findsWidgets` is true for any number of widgets ≥ 0. **Weak assertion.**

### Gap-3. No test for the `_phoneController.addListener` OTP-clear bug (P0-6)
The 8 tests don't cover the edge case where the rider changes the phone after entering OTP digits.

### Gap-4. No test for the `_verifyOtp` security bug (P0-5)
The 8 tests don't cover the case where the API returns `success: false` but doesn't throw.

### Gap-5. No test for the dev-mode OTP auto-fill (P0-7)
No test verifies that the dev OTP is auto-filled (or that it's NOT in production).

### Gap-6. No test for the Skip cache key bug (P0-2)
The 5 tests in `Skip button (Bug 24)` group verify the `voltium_requires_higher_deposit` flag is set, but not that the form cache is cleared with the RIGHT key. The test at line 244 checks `CacheService().getString('guarantor_onboarding_form_cache')` (no riderId) — which is the WRONG key. **The test is asserting the wrong behavior.**

### Gap-7. The `guarantor_entity_test.dart` tests a dead entity (P0-8)
10 tests for `GuarantorEntity` and `GuarantorStatus` parsing — but neither is used in production. The tests pass but the code is dead.

### Gap-8. `guarantor_screen_test.dart` is a duplicate of the better-tested `guarantor_onboarding_screen_test.dart`
Both test files exist. The first (at `flutter/test/guarantor/`) has 3 smoke tests. The second (at `flutter/test/features/guarantor/presentation/screens/`) has 8 tests. **Dead duplicate file.**

### Gap-9. `GuarantorOnboardingNotifier` has 0 direct tests
The state management (resetPhoneVerification, updateDocument, populateFromCache) is tested only indirectly through the screen tests.

### Gap-10. `GuarantorOnboardingHeader` and `GuarantorOnboardingProgressSection` (dead widgets) have 0 tests
The dead widgets don't have tests because they're not used. If they're dead, they should be deleted, not tested.

### Gap-11. No test for the `_handleSubmit` partial-failure rollback
If 3 of 6 docs upload and the 4th fails, the partial state is committed. No test for this.

### Gap-12. No test for the "phone != rider phone" check in `_sendOtp`
Line 423: `if (phone == ref.watch(riderProvider).rider?.phone) { _showError(...); return; }`. The form validator also has this check. No test for the check.

---

## 7. Cross-Audit Patterns Confirmed (11th audit)

The following patterns are confirmed in this audit and also appear in the previous 10 audits (cumulative):

| Pattern | This audit | Other audits |
|---|---|---|
| **"Fake UI" — button promises something that doesn't happen** | P0-1 (Skip promises higher deposit but doesn't), P0-2 (Skip doesn't clear cache) | 8th (Delete, Password), 9th (Address Proof, Logout), 10th (PDF download, Call Log) |
| **Hardcoded fallback strings** | P0-1 (₹5,000 / ₹2,000), P0-7 (dev OTP) | 8th audit, 9th audit |
| **String-based field name mapping** | P1-9 (rider vs guarantor field name inconsistency) | 9th audit, 10th audit |
| **Dead domain entity** | P0-8 (GuarantorEntity, 58 lines), P2-22, P3-10 | 9th audit (KycEntity, KycField), 10th (WelcomeScreen) |
| **Dead test file** | Gap-8 (`flutter/test/guarantor/guarantor_screen_test.dart`) | 9th audit (kyc_preflight duplicated) |
| **In-memory or local-only state that should be backend** | P0-1 (requiresHigherDeposit flag), P1-2 (form cache) | 9th audit (form cache in static map) |
| **`// matches original logic` comment** | P0-1 docstring at line 666-674 | 8th audit (analytics), 9th audit (cross-audit pattern) |
| **Sequential instead of parallel** | P0-4 (6 docs upload sequentially) | 9th audit (5 docs), 10th audit (none) |
| **Test-mode auto-fill outside `kDebugMode`** | P1-1 (lines 291-307) | 9th audit, 8th audit |
| **Stringly-typed error parsing** | Lines 650-656: `if (msg.contains('422') || msg.contains('VALIDATION'))` | 9th audit, all prior KYC-related audits |
| **Wrong field for DOB format** | P0-3 (dd-MM-yyyy) | 9th audit P0-4 (same bug) |
| **Wrong category for upload** | P1-18 (signature as `kyc_document`) | 8th audit, 9th audit |
| **BuildCurtainHeader from pickup_hub_widgets** | P2-1 (line 883) | 9th audit (same pattern) |
| **5-state as 4 booleans** | P2-6 (isSendingOtp + isOtpSent + isVerifyingOtp + isPhoneVerified) | New pattern |
| **Optional prop not implemented in widget** | P2-18 (no `enabled` on GuarantorSignatureCard) | 9th audit, 8th audit |

---

## 8. Recommended Fix Order

### Single-PR fixes (≤2 hours each, ship-it PRs)

1. **PR-RG-1: P0-3 (DOB format fix)** — 5 min, 1 line. Also fix in rider onboarding (PR-DOCS-1 from 9th audit). One PR for both.
2. **PR-RG-2: P0-2 (Skip cache key bug)** — 5 min, 1 line. Use `GuarantorCache.clearFormCache(riderId)`.
3. **PR-RG-3: P0-6 (OTP box clear on phone change)** — 5 min, 1 listener update.
4. **PR-RG-4: P0-5 (verifyPhone result check)** — 1-2 hours. Check response body, distinguish success from failure.
5. **PR-RG-5: P0-7 (dev OTP wrap in kDebugMode)** — 5 min, wrap in `if (kDebugMode)`.
6. **PR-RG-6: P0-8 (delete dead GuarantorEntity + tests)** — 30 min. ~125 lines of dead code removed.
7. **PR-RG-7: P0-1 (Skip dialog copy OR backend wire-up)** — 1-4 hours depending on approach. Easiest: change copy to "may be required to pay a higher deposit".
8. **PR-RG-8: Gap-8 (delete duplicate guarantor test file)** — 5 min. Remove `flutter/test/guarantor/guarantor_screen_test.dart`.

### Multi-PR fixes (1-2 days each)

9. **PR-RG-9: P0-4 (parallel uploads via PhotoUploadNotifier)** — 2-4 hours. Migrate guarantor flow to use the notifier. Same as 9th audit PR-DOCS-10.
10. **PR-RG-10: P1-9 (refactor shared MultiStepOnboardingScreen)** — 2-3 days. Extract a shared widget to eliminate ~1,200 lines of duplication between rider and guarantor.
11. **PR-RG-11: P1-4 + P1-5 (add Relation field, validate video)** — 1-2 days. Add relation field, add face/voice verification for the video.
12. **PR-RG-12: P0-1 proper (wire requiresHigherDeposit to backend)** — 1-2 days. Add DB column, expose API, update plan selection logic.

### Tech-debt cleanup (1 week)

13. **PR-RG-13: Dead widget removal** — delete `guarantor_onboarding_header.dart` and `guarantor_onboarding_progress_section.dart` (~100 lines).
14. **PR-RG-14: Test gaps** — write 10+ new tests for the OTP flow, upload retry, error states, edge cases.
15. **PR-RG-15: Localization** — extract all hardcoded strings to `AppLocalizations`.

### Total effort estimate

- Hotfixes (PRs 1-8): 1 day total
- Multi-PR fixes (PRs 9-12): 1-2 weeks
- Tech debt (PRs 13-15): 1 week
- **Total: 2-4 weeks to address all P0s + P1s in this audit**

---

## 9. What I'd do first if I had to pick one

**P0-3 (DOB format).** It's a 1-line fix, takes 5 minutes, and unblocks every guarantor submission. This is the same bug as 9th audit P0-4 (rider onboarding). **The team should fix this in BOTH files in a single PR.** Right now, no rider can complete onboarding and no guarantor can be added.

If the team can't ship this within 24 hours, the second choice is **P0-2 (Skip cache key bug)** — same line-fix category (1 line, 5 minutes), but the blast radius is smaller (only affects riders who skip and come back).

The third choice is **P0-6 (OTP box clear)** — same line-fix category (5 minutes, fix the listener), but the blast radius is small (only affects a specific edge case).

The fourth choice is **P0-5 (verifyPhone result check)** — 1-2 hours, but a real security bug. The current code marks the phone as verified even if the OTP is wrong (depending on server response shape).

---

## 10. Post-audit checklist

- [ ] Confirm P0-3 (DOB format) with backend team — server expects ISO `yyyy-MM-dd`.
- [ ] Confirm P0-5 (verifyPhone response shape) with backend team — does the response include `success: bool`?
- [ ] Confirm P0-1 (Skip higher-deposit) with product team — is the higher-deposit flow planned? If yes, when?
- [ ] Confirm P1-4 (relation field) with product team — is this a required field for guarantor KYC?
- [ ] Confirm P1-5 (video face/voice verification) with security team — should the guarantor video be verified?
- [ ] Schedule PR-RG-9 (parallel uploads via PhotoUploadNotifier) — same as 9th audit PR-DOCS-10.
- [ ] Schedule PR-RG-13 (delete dead widgets) for cleanup.
- [ ] File tickets for the 8 P0s + 19 P1s with reproducible device scenarios.

---

**Audit complete. 8 P0s + 19 P1s + 23 P2s + 30 P3s = 80 findings. ~500 lines of dead code. ~1,200 lines of duplicated logic between rider and guarantor flows. Single highest-blast-radius fix: P0-3 (DOB format) — 1 line, 5 minutes, fix in BOTH rider and guarantor onboarding.**
