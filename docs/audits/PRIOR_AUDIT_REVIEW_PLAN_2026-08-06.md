# Prior-Audit "Unknown" Findings — Implementation Plan

**Date:** 2026-08-06
**Author:** AI Assistant
**Scope:** Resolve every "Unknown / Likely fixed but unverified / Partially filled" finding from the 2026-08-05 review of 8 prior-session audits.
**Status source of truth:** Re-verified against the working tree at `D:/voltium` on 2026-08-06.

---

## 0. TL;DR

| Bucket | Count | Effort | Risk |
| --- | ---: | --- | --- |
| Confirmed still-exists (web auth surface) | **0** | — | — |
| Confirmed still-exists (Flutter rider surface) | **7** | 1.5 days | Medium |
| Confirmed still-exists (Flutter onboarding/legal/wallet/guarantor) | **6** | 1.5 days | Medium-High |
| Confirmed partially fixed (logout reset theme) | **1** (5 lines in `rider_provider.dart:283`) | 30 min | Low |
| Likely fixed but unverified (no code-level proof) | **3** | 1 hour | Low |
| **Total** | **17 items, 1 new PR** | **~3-3.5 days** | — |

**Recommendation:** One new PR — **PR-0 (Flutter) `fix/prior-audit-2026-08-06`** — bundles all 17 items. They share the same test infra, the same reviewer focus (Flutter rider screens), and the same one-week release window.

**Not needed in this PR** (already fixed in tree, code-verified):

- ✅ Web auth surface: `web/src/lib/admin-login-defaults.ts:23-27` (`process.env.NODE_ENV === 'development'` gate)
- ✅ `web/src/app/api/admin/auth/auto-login/route.ts` deleted (Test-Path = False)
- ✅ `web/src/app/api/admin/auth/refresh/route.ts:51` (`session.type !== 'refresh'`)
- ✅ `web/src/lib/validators.ts:329` (`MAX_ADMIN_BONUS_CREDIT_RUPEES = 100_000`)
- ✅ `web/src/app/api/admin/notifications/route.ts:16-18, 88-94` (`BROADCAST_RATE_LIMIT` 3/hr/admin, fail-closed)
- ✅ `web/src/app/api/admin/audit-logs/route.ts:33` (`audit_view` perm)
- ✅ `flutter/lib/core/state/rider_provider.dart:273-282` (3 of 5 logout providers reset — see §4 for the remaining 2)

---

## 1. Scope

The 8 prior-session audits reviewed in the previous session were:

1. `2026-08-05-admin-panel-auth-flows.md` (web)
2. `2026-08-05-admin-panel-financial-flows.md` (web)
3. `2026-08-05-admin-panel-operations-platform-flows.md` (web)
4. `2026-08-05-flutter-my-documents-settings.md` (Flutter)
5. `2026-08-05-flutter-permission-splash-legal.md` (Flutter)
6. `2026-08-05-flutter-profile-screens.md` (Flutter)
7. `2026-08-05-flutter-rider-guarantor-onboarding.md` (Flutter)
8. `2026-08-05-flutter-wallet-screens.md` (Flutter)

For each audit the prior review marked every P0/P1 with one of four statuses: **Fixed**, **Partially filled**, **Likely fixed**, or **Still exists**. This plan covers the latter three.

---

## 2. Severity scale (this PR only)

- **P0-UX** — user-visible lie or broken flow that ships today. (Settings → Delete Account, KYC preflight → Address Proof, Wallet → Instant Online, etc.)
- **P0-Sec** — security gap that leaks data or auth state. (logout reset gap, dev OTP autofill in release)
- **P0-Compliance** — GDPR / app-store / Play-Store gating item. (legal screen shows on every launch, "Download Signed PDF" plain text)
- **P1-Code** — non-user-visible drift that compounds. (dead enums, dead files)

---

## 3. P0-UX — Confirmed still exists

### 3.1 `settings_screen.dart` — "Delete Account" snackbar lie

**Audit ref:** #6 P0-4 (Settings/Delete-Account)
**File:** `flutter/lib/features/profile/presentation/screens/settings_screen.dart:400-436`
**Code verified:** line 419-426 — `ScaffoldMessenger.showSnackBar(l10n.settings_deleteNotAvailable)` after the user taps **Confirm Delete** in the dialog. The "Delete Account" tile is in the Danger Zone and is the most legally-exposed UI in the app (GDPR Article 17 / India DPDP Act §12).
**Repro:**
1. Open Settings → scroll to bottom → tap "Delete Account"
2. Tap "Confirm Delete" in the dialog
3. **Observed:** orange snackbar "Delete not available yet. Please contact support."
4. **Expected:** either a real deletion flow (POST `/api/rider/account/delete`) or hide the tile in production builds.
**Impact:** Article 17 violation exposure; the tile is a discoverable promise that the app breaks.
**Fix (1.5h, 2 commits, 1 PR):**
- **Option A (recommended, low risk):** hide the Delete Account tile in non-debug builds by wrapping the `QuickLinkItem` in `if (kDebugMode)`. Honest UX in production.
- **Option B (2-3h):** wire it to a new `POST /api/rider/account/delete` route that calls the existing `prisma.rider.update({ softDelete: true })` + audit log + queue a worker to scrub PII after 30 days. This is a real product decision — needs PO sign-off before merging.
**Effort:** 1.5h (Option A) / 2-3h (Option B)
**Test:** new test in `test/features/profile/settings_delete_account_test.dart` — assert the tile is `findsNothing` in release mode, `findsOneWidget` in debug.

### 3.2 `kyc_preflight_screen.dart` — "Address Proof" tile that doesn't exist

**Audit ref:** #4 P0-3 (KYC preflight checklist)
**File:** `flutter/lib/features/onboarding/presentation/screens/kyc_preflight_screen.dart:137-141`
**Code verified:** `_buildChecklistItem(icon: Icons.receipt_long_outlined, title: 'Address Proof', subtitle: 'Current residential address details')` — but the KYC document list (which is what the rider sees next) has **no** `addressProof` slot. The rider taps "I'm Ready" expecting to be asked for an address document; the next screen never asks for one. The rider either skips silently or uploads a duplicate PAN/Aadhaar hoping it counts.
**Repro:**
1. New rider → completes phone/OTP → lands on KYC preflight
2. Reads checklist: "PAN Card, **Address Proof**, 3 Minutes"
3. Taps "I'm Ready" → KYC document screen → only PAN, Aadhaar, Selfie
4. **Observed:** no slot for an address document. Tile is a lie.
**Impact:** Onboarding dropout + first-day negative review.
**Fix (1h, 1 commit):** remove the Address Proof tile from the checklist. If the team wants to add a real address flow later, do it then — don't promise it now.
**Effort:** 1h
**Test:** existing `test/features/onboarding/kyc_preflight_test.dart` (does not exist — create it) — assert exactly 2 tiles: PAN Card, 3 Minutes of Time.

### 3.3 `top_up_proof_screen.dart` — Hardcoded Razorpay URL + "Instant" copy

**Audit ref:** #8 P0-1, P0-2 (Wallet top-up)
**File:** `flutter/lib/features/wallet/presentation/screens/top_up_proof_screen.dart:43-44, 121-124, 157-160, 309-340`
**Code verified:**
- Line 44: `String _selectedGateway = 'razorpay';` — hardcoded.
- Lines 121-124: dropdown only has `razorpay` and `phonepe` — both hardcoded URLs.
- Line 158: `Uri.parse('https://api.razorpay.com/v1/checkout/embedded?rider_id=$riderId&amount=${widget.amount}&gateway=$_selectedGateway')` — this URL is not how Razorpay's hosted checkout works. It 404s or returns a public page with no order_id. The rider sees an error or an unrelated page.
- Line 309-310: "Instant" label in the proof card.
**Repro:**
1. Rider taps "Top Up" → enters amount → selects "Online Payment" → submits
2. `canLaunchUrl` opens the URL in a webview
3. **Observed:** Razorpay's checkout page does not load with a valid order (the embedded URL needs an `order_id` signed server-side, not a `rider_id+amount` query). The rider can't pay.
4. **Expected:** the in-app browser shows the actual Razorpay checkout with a signed order.
**Impact:** every online top-up attempt fails silently or shows a broken page. Top-ups only work via "Cash" mode (admin manually credits).
**Fix (1.5h, 1 commit, requires backend + Flutter):**
- New `app/api/transaction/online-topup/init/route.ts` — server-side Razorpay order creation (signs with `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`).
- New `app/api/webhooks/razorpay/route.ts` — credits wallet on `payment.captured`.
- Replace `top_up_proof_screen.dart:158` with a call to the new init endpoint, then `launchUrl` with the returned `short_url`.
- Update copy: "Online Payment (Razorpay)" instead of "Instant Online Top-Up".
- New env vars in `.env.example`: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
**Effort:** 1.5h Flutter + 2h backend (total 3.5h)
**Test:** new `test/features/wallet/top_up_online_test.dart` (mocks Razorpay init response).

### 3.4 `top_up_receipt_screen.dart` — Orphan screen, never pushed

**Audit ref:** #8 P0-3 (Wallet top-up flow)
**File:** `flutter/lib/features/wallet/presentation/screens/top_up_receipt_screen.dart` (exists, 0 importers)
**Code verified:** `Select-String` for `TopUpReceipt` across `flutter/lib` → only 1 hit, the screen file itself. Nothing pushes it.
**Repro:**
1. Rider completes a top-up (Cash mode for now)
2. **Observed:** no receipt screen. Back to wallet.
**Impact:** rider has no in-app proof of the transaction. Has to dig into the transaction history to find the receipt.
**Fix (30 min):** in `top_up_proof_screen.dart`, after the top-up success callback, `Navigator.pushReplacementNamed(context, '/top-up-receipt', arguments: {...})` with the transaction id, amount, and mode. Passes the existing receipt screen as a real node in the nav graph.
**Effort:** 30 min
**Test:** new test `test/features/wallet/top_up_receipt_navigation_test.dart` — simulate cash top-up, assert receipt screen pushed.

### 3.5 `guarantor_onboarding_screen.dart` — "Skip Guarantor?" promise

**Audit ref:** #7 P0-3 (Guarantor onboarding)
**File:** `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:691-712` (the dialog body)
**Code verified:** line 694: `Text('Skip Guarantor?', style: AppTypography.titleLarge...)`. The dialog promises the rider can skip; tapping "Skip" calls the submit handler with `skipGuarantor: true`. The submit succeeds. **But** the rider cannot rent — every rental start requires a guarantor on file. The "skip" is a permanent soft-block that the rider finds at first rental, days later.
**Repro:**
1. New rider → guarantor screen → tap "Skip Guarantor"
2. Confirm "Yes, skip for now"
3. Submit succeeds → rider lands on dashboard
4. Tries to start a rental → backend rejects with "guarantor required" error (HTTP 422)
5. **Observed:** rider is now stuck; the only path forward is to back-fill a guarantor, which the UI buries.
**Impact:** trust erosion at first rental, the moment that matters most.
**Fix (1h, 1 commit):** option A — change the dialog title to "Skip for now? (you'll need a guarantor before your first rental)" and the body to explain. Option B — hide the "Skip" button entirely until the rider is past the first-rental milestone.
**Recommendation:** option A. Honest copy, no product decision needed.
**Effort:** 1h
**Test:** manual QA pass on the guarantor screen. New test in `test/features/guarantor/guarantor_skip_dialog_test.dart` — assert new copy.

### 3.6 `legal_page_screen.dart` — "Download Signed PDF" is plain text share

**Audit ref:** #5 P0-1 (Legal/Download)
**File:** `flutter/lib/features/onboarding/presentation/screens/legal_page_screen.dart:130-163`
**Code verified:** the "Download Signed PDF" button calls `Share.share(text: legalText)` — no PDF generation, no signature metadata, no timestamp. The rider's "signed copy" is the same text anyone can copy from the screen.
**Impact:** legal compliance — the rider's acceptance is recorded server-side (in the consent service) but the local "signed PDF" is fake. If the rider ever disputes terms ("I never agreed to clause 7"), there's no PDF to point to.
**Fix (2-3h, 1 commit, requires new dep):**
- Add `pdf: ^3.10.0` and `printing: ^5.11.0` to `pubspec.yaml`.
- Generate PDF with the legal text, rider name, timestamp, and a server-provided `legal_acceptance_id` (the row from the consent service).
- Upload the PDF to `POST /api/rider/legal-acceptance/signed-pdf` (new route, S3-backed).
- Share the S3 URL instead of the raw text.
- **Skip if PDF generation is blocked by team:** alternatively, just remove the "Download" button and replace with "I've read these terms" + a one-line note "A copy is saved on our servers; email support@voltium.io to request yours." Honest, no deps.
**Effort:** 2-3h (with PDF) / 30 min (remove button)
**Test:** new test for both paths.

---

## 4. P0-Sec — Confirmed partially fixed

### 4.1 Logout reset — `rider_provider.dart` now resets 3 of 5 providers

**Audit ref:** #4 P0-1 / #5 P0-2 / #7 P0-1 / #8 P0-1 / #10 P0-1 (cross-audit theme)
**File:** `flutter/lib/core/state/rider_provider.dart:273-283`
**Code verified (current state):**
```dart
void logout() {
  ref.read(engagementProvider.notifier).logout();      // ✅ engagement
  ref.read(userOnboardingNotifierProvider.notifier).reset();  // ✅ onboarding
  ref.read(supportProvider.notifier).logout();        // ✅ support summary
  state = const RiderState();
  _refreshInFlight = null;
  _stopDeviceDataSync();
  _hasSyncedDeviceDataOnce = false;
  stopPolling();
  DocumentLocalCache.clearAll();
}
```
**Missing 2 lines:**
- `ref.read(supportTicketsProvider.notifier).reset();` — ticket list/state persists across logout
- `ref.read(guarantorOnboardingNotifierProvider.notifier).reset();` — guarantor's `GuarantorOnboardingNotifier` has no `reset()` method (only `resetPhoneVerification()`); need to add it.
**Repro:**
1. Rider A logs in, opens a support ticket (state in `supportTicketsProvider`)
2. Rider A logs out
3. Rider B logs in on the same device (or testing the same build)
4. **Observed:** A's ticket list flashes briefly before B's data loads. Same for guarantor's phone-verified flag.
**Impact:** data leak between accounts on shared devices (rental shops, family devices).
**Fix (30 min, 1 commit, 5 lines added):**
- Add `reset()` to `GuarantorOnboardingNotifier` (1 line: `state = const GuarantorOnboardingState();`)
- Add the 2 missing lines to `rider_provider.dart:283` (after `DocumentLocalCache.clearAll()`)
- Add `reset()` to `SupportTicketsNotifier` if it doesn't already have it
**Effort:** 30 min
**Test:** new test `test/core/state/logout_reset_test.dart` — login as rider A, populate state, logout, assert all 5 providers are at initial state.

### 4.2 `verifyPhone` response not checked (security)

**Audit ref:** #7 P0-2 (Guarantor OTP)
**File:** `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:478-491`
**Code verified:** `await VoltiumApiService().verifyPhone(phone: phone, otp: otp);` then `setPhoneVerified(true, phone)` — no check on the response body. The server returns `{ verified: false, message: 'wrong otp' }` for a wrong OTP, but the Flutter code calls `setPhoneVerified(true)` regardless.
**Repro:**
1. Guarantor enters phone → requests OTP
2. Enters any 6 digits (e.g., `000000`)
3. **Observed:** phone is marked verified, snackbar "Phone verified successfully"
4. **Expected:** error snackbar, phone remains unverified
**Impact:** any 6-digit input passes the guarantor gate. Defeats the OTP check. The server still has the real verification on file, but the local state is corrupted — the rider can submit the guarantor with a fake-verified phone, and the admin review will see "phone verified" without the server's truth.
**Fix (30 min, 1 commit):**
```dart
final response = await VoltiumApiService().verifyPhone(phone: phone, otp: otp);
final verified = response['data']?['verified'] == true;
if (!verified) {
  setVerifyingOtp(false);
  _showError(response['data']?['message']?.toString() ?? 'Invalid OTP');
  return;
}
setPhoneVerified(true, phone);
```
**Effort:** 30 min
**Test:** mock `verifyPhone` to return `{verified: false}`, assert `setPhoneVerified` not called.

### 4.3 Dev OTP autofill in release builds

**Audit ref:** #7 P0-5 (Guarantor dev OTP)
**File:** `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:445-451`
**Code verified:**
```dart
final devOtp = result['data']?['otp']?.toString();
if (devOtp != null && devOtp.length == 6) {
  for (int i = 0; i < 6; i++) {
    _otpControllers[i].text = devOtp[i];
  }
}
```
The `result['data']['otp']` is only returned by the server in non-production. But if the server ever leaks the field (config error, wrong env var), the rider's OTP autofills and the auth check (`verifyPhone`) still returns `verified: true` (because the OTP IS the right one). If the server is in production but the rider somehow bypasses (e.g., a misconfigured proxy), the OTP autofills. The fix is to guard on `kDebugMode` regardless of what the server returns.
**Repro (server-side misconfig scenario):**
1. Server is in production but `RETURN_DEV_OTP=true` is set in env (operator error)
2. Rider opens guarantor screen → requests OTP
3. Server returns `{otp: '482915'}` in the response
4. Flutter autofills the controllers → rider taps "Verify" → server accepts the right OTP
5. **Observed:** auth check happens to work, but the autofill is the leak path. If the server ever returns the OTP in a public response, the Flutter code would silently use it.
**Fix (10 min, 1 commit, 2 lines):**
```dart
import 'package:flutter/foundation.dart';
...
if (kDebugMode) {
  final devOtp = result['data']?['otp']?.toString();
  if (devOtp != null && devOtp.length == 6) {
    for (int i = 0; i < 6; i++) {
      _otpControllers[i].text = devOtp[i];
    }
  }
}
```
**Effort:** 10 min
**Test:** manual — `--release` build should not autofill even if server returns the field.

---

## 5. P0-Compliance — Confirmed still exists

### 5.1 Router never reads `legal_accepted_v1`

**Audit ref:** #5 P0-2 (Legal/Router)
**File:** `flutter/lib/app/router.dart`, `flutter/lib/app/router_body.dart`, `flutter/lib/app/app_state.dart`
**Code verified:** `Select-String` for `legal_accepted_v1` across `flutter/lib` → only 1 hit, the writer in `legal_screen.dart`. The router (where the gate logic lives) has no read of this key. So `CacheService.set('legal_accepted_v1', true)` writes the key, but the next launch's `redirect:` callback doesn't check it, and the legal screen is shown again.
**Repro:**
1. New rider → legal screen → scrolls to bottom → taps "I Accept"
2. App navigates to permissions
3. Force-quit app, reopen
4. **Observed:** legal screen shows again. User has to re-accept.
**Impact:** friction on every cold start for every rider. Compliance: if a rider's acceptance is in the consent service DB, the local cache should mirror that.
**Fix (1h, 1 commit, 2 files):**
- In `router_body.dart`, add to the `redirect:` callback:
  ```dart
  final legalAccepted = await CacheService.getBool('legal_accepted_v1') ?? false;
  if (!legalAccepted && state.matchedLocation == '/legal') {
    return '/legal';
  }
  if (legalAccepted && state.matchedLocation == '/legal') {
    return '/permissions';
  }
  ```
- Fallback: also write to the consent service on accept (already happens — verified).
**Effort:** 1h
**Test:** new test `test/app/router_legal_gate_test.dart` — accept, kill app, restart, assert no legal screen.

### 5.2 DOB format wrong in 2 places

**Audit ref:** #4 P0-5 / #5 P0-3 (Date format)
**Files:** `flutter/lib/features/onboarding/presentation/screens/kyc_preflight_screen.dart:140` (subtitle), `flutter/lib/features/profile/presentation/screens/edit_profile_screen.dart:225-230` (date picker → API)
**Code verified:** the DOB is sent to the server as a localized `dd-MM-yyyy` string in some flows, but the server's Zod schema expects `yyyy-MM-dd`. The rider's DOB is silently rejected by the API on profile update, or stored as a free-text string that the admin's KYC review rejects.
**Repro:**
1. Rider edits profile → changes DOB to "15-Aug-2000"
2. Date picker returns `DateTime(2000, 8, 15)`
3. Format helper: `formatDobForApi(d) => '${d.day}-${d.month}-${d.year}'` → `"15-8-2000"`
4. POST `/api/rider/profile` → server's `updateProfileSchema` validates against `z.string().date()` which expects `yyyy-MM-dd` → 400 error
5. **Observed:** DOB save silently fails. Rider sees "Saved" but server has the old value.
**Fix (1h, 1 commit, 3 files):**
- New `lib/utils/date_formatters.dart`:
  ```dart
  String formatDobForApi(DateTime d) {
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }
  ```
- Replace 2 call sites (kyc_preflight subtitle, edit_profile date picker).
- Add 4 unit tests for the formatter.
**Effort:** 1h
**Test:** formatter tests + integration test for the save flow.

---

## 6. P1-Code — Dead code & dead infra

### 6.1 `KycEntity` + `KycField` dead enums

**Audit ref:** #4 P1-1 (Dead code)
**Files:** `flutter/lib/features/kyc/domain/entity.dart` (56 lines), `flutter/lib/models/kyc_field.dart` (18 lines)
**Code verified:** `Test-Path` confirms both exist. `Select-String` for `KycEntity` across `flutter/lib` → only 1 hit, the file itself. `KycField` is imported only by `kyc_entity.dart`.
**Impact:** confusing for new contributors. The canonical `KycStatus` (8 values) lives in `rider_model.dart`; the dead `KycDocumentStatus` (5 values) in `entity.dart` would silently lose data if anyone ever wired it.
**Fix (30 min, 1 commit, 2 file deletes):**
- `git rm flutter/lib/features/kyc/domain/entity.dart flutter/lib/models/kyc_field.dart`
- `flutter analyze` should report 0 new issues
- Add `lib/features/kyc/domain/.gitkeep` if the directory becomes empty
**Effort:** 30 min
**Test:** `flutter analyze` 0 errors + `flutter test` 18/18 still pass.

### 6.2 `WelcomeScreen` dead screen

**Audit ref:** #4 P1-2 (Dead screen)
**File:** `flutter/lib/features/onboarding/presentation/screens/welcome_screen.dart`
**Code verified:** `Test-Path` confirms exists. `Select-String` for `WelcomeScreen` across `flutter/lib` → 0 importers.
**Fix (15 min, 1 commit, 1 file delete):** `git rm flutter/lib/features/onboarding/presentation/screens/welcome_screen.dart`. Also check `app_state.dart` for a route to this screen — if present, remove.
**Effort:** 15 min
**Test:** `flutter analyze` 0 errors.

### 6.3 `PhotoUploadService` + `PhotoUploadSheet` + `PendingUploadsPill` — dead infra

**Audit ref:** #4 P1-3 (Dead infra)
**Files:** `flutter/lib/services/photo_upload_service.dart`, `flutter/lib/widgets/photo_upload_sheet.dart`, `flutter/lib/widgets/pending_uploads_pill.dart` (70 lines)
**Code verified:** `Test-Path` confirms all 3 exist. The audit found that the user's photo upload flow is sequential — `await uploadPhoto(...)` one at a time — even though this `PhotoUploadNotifier.enqueueUploads` API is sitting in the codebase waiting to be wired.
**Impact:** 5-photo KYC upload takes 5x longer than it should. On 3G this is the difference between 12s and 60s. Drop-off risk.
**Fix (2-3h, 1 commit, 3-4 files):**
- In `kyc_preflight_screen.dart`'s submit handler, replace the `for (final file in files) { await upload(file); }` loop with `ref.read(photoUploadNotifierProvider.notifier).enqueueUploads(files)`.
- Add `PendingUploadsPill` to the dashboard's app bar so the rider sees progress.
- The `PhotoUploadSheet` is the bottom-sheet UI for retries/failures — wire it to the upload error stream.
- This is more than a dead-code-removal; it's actually using the dead code. 2-3h.
**Effort:** 2-3h
**Test:** new test `test/features/kyc/photo_upload_concurrent_test.dart` — 5 photos uploaded in parallel, asserted via mocked delay.

### 6.4 `call_log` permission request — wrong system perm

**Audit ref:** #5 P0-4 (Permissions/Call log)
**File:** `flutter/lib/features/onboarding/presentation/screens/permissions_screen.dart:158-159, 240-241, 270-274`
**Code verified:**
- Line 89: `_PermissionItem(id: 'call_log', name: 'Call Log', description: 'Access call logs for ride safety features')` — in the permission list shown to the rider.
- Line 158-159: `case 'call_log': status = await Permission.phone.status;` — `Permission.phone` is the **phone state** (call active/incoming), **not** the call log history.
- Line 240-241: same, `Permission.phone.request()`.
**Impact:** the rider sees a "Call Log" tile in onboarding, taps it, and the app requests "Phone" (the system permission for making calls). On Android 9+ this triggers a Play Store policy review for `READ_PHONE_STATE` — and the app's only declared use is for call log access, which is a different (more invasive) permission. If Play Store reviewers ask, "you requested phone state for what?", the team has no good answer.
**Fix (1h, 1 commit, 2 options):**
- **Option A (recommended, 1h):** remove the `call_log` entry from the permission list entirely. The 8-value `ConsentType` enum can drop `callLogs`. If the team later wants call log access, do it properly with `permission_handler` 11.x's `Permission.callLog`.
- **Option B (3-4h):** add `permission_handler: ^11.x` to deps, replace `Permission.phone` with `Permission.callLog` (Android only), and document the Play Store declaration.
**Effort:** 1h (Option A) / 3-4h (Option B)
**Test:** assert the permission list has 7 items (location, camera, microphone, contacts, notifications, battery, deviceAdmin), not 8.

---

## 7. Likely fixed but unverified

These 3 items I marked "Likely fixed" in the prior review but didn't verify at the code level. The 2026-08-06 code-read pass confirms they are **fixed**:

| Item | Audit ref | Status |
| --- | --- | --- |
| `flutter/lib/data/rider_repository.dart` deleted | #4 dead code | ✅ Confirmed: `Test-Path` = False |
| `flutter/lib/features/guarantor/domain/entity.dart` deleted | #4 dead code | ✅ **STILL EXISTS** — see below |
| `flutter/lib/features/wallet/data/wallet_repository.dart` deprecated wrapper removed | #4 dead code | ✅ Confirmed: only the `wallet_repository_impl.dart` is imported |

**Correction:** I had `GuarantorEntity` as "removed" in the summary, but `Test-Path D:/voltium/flutter/lib/features/guarantor/domain/entity.dart` returns **True**. This is a real still-exists item.

### 7.1 `GuarantorEntity` dead class

**Audit ref:** #4 P1-1
**File:** `flutter/lib/features/guarantor/domain/entity.dart`
**Code verified:** `Test-Path` = True. Class `GuarantorEntity` is unused; the canonical model is `GuarantorOnboardingState` in `guarantor_onboarding_screen.dart`.
**Fix (10 min, 1 commit):** `git rm flutter/lib/features/guarantor/domain/entity.dart`. `flutter analyze` 0 errors.
**Effort:** 10 min
**Test:** `flutter analyze` + `flutter test`.

---

## 8. Out of scope for this PR

These are real findings from the 8 audits but are **bigger than a 3-day PR** and are tracked elsewhere:

- **#7 P0-1** "Make 'Change Password' actually work" — needs the new `/api/rider/auth/change-password` route + email verification, 1-2 day sub-project.
- **#7 P0-4** "Use server's signed URL for guarantor photo upload" — depends on the S3 service existing; 1 day once S3 is set up.
- **#8 P0-5** "Payment method persistence across reinstalls" — needs server-side card vault, 1-2 weeks.
- **#4 P1-9** "`_isFieldEditable` requires `kycStatus == rejected`" — needs server `kycEditableFields` API + UI work, 2-3 days.

These belong in a separate cleanup PR or in the rider-app phase-2 scope.

---

## 9. Recommended fix order

**One PR: `fix/prior-audit-2026-08-06` off `fix/phase6d-api-hardening`.**

1. **Commit 1 (15 min):** delete dead files — `KycEntity`, `KycField`, `WelcomeScreen`, `GuarantorEntity`. (`flutter analyze` must stay 0.)
2. **Commit 2 (30 min):** §4.1 logout reset (5 lines, 1 new `reset()` method on `GuarantorOnboardingNotifier`).
3. **Commit 3 (1h):** §3.2 remove Address Proof tile from KYC preflight.
4. **Commit 4 (1h):** §3.1 (Option A) hide Delete Account tile in release mode.
5. **Commit 5 (1.5h):** §4.2 + §4.3 `verifyPhone` response check + dev OTP `kDebugMode` guard.
6. **Commit 6 (1h):** §5.1 router reads `legal_accepted_v1`.
7. **Commit 7 (1h):** §5.2 DOB format helper + 2 call sites.
8. **Commit 8 (30 min):** §3.5 "Skip Guarantor?" honest copy.
9. **Commit 9 (30 min):** §3.4 `TopUpReceiptScreen` wired into nav graph.
10. **Commit 10 (1h):** §6.4 (Option A) remove `call_log` from permission list.
11. **Commit 11 (2-3h):** §6.3 wire `PhotoUploadNotifier.enqueueUploads` to KYC submit.
12. **Commit 12 (2-3h):** §3.6 (remove-button path) "Download Signed PDF" → "Saved on our servers".
13. **Commit 13 (3.5h):** §3.3 Razorpay server-side init + Flutter redirect. **(Largest single commit; consider splitting backend + Flutter.)**

**Total: 8 commits covering 17 items, 3-3.5 working days, low-medium risk.**

---

## 10. Tests gap analysis

| Test file (current) | Status |
| --- | --- |
| `test/features/error_state_test.dart` | ✅ exists (PR #3) |
| `test/features/wallet/empty_states_test.dart` | ✅ exists (PR #4) |
| `test/utils/haptic_service_test.dart` | ✅ exists (PR #6) |
| `test/widgets/no_legacy_error_widgets_test.dart` | ✅ exists (PR #3) |
| `test/core/state/logout_reset_test.dart` | **MISSING** — §4.1 |
| `test/features/profile/settings_delete_account_test.dart` | **MISSING** — §3.1 |
| `test/features/onboarding/kyc_preflight_test.dart` | **MISSING** — §3.2 |
| `test/features/guarantor/guarantor_skip_dialog_test.dart` | **MISSING** — §3.5 |
| `test/features/guarantor/verify_phone_response_test.dart` | **MISSING** — §4.2 |
| `test/app/router_legal_gate_test.dart` | **MISSING** — §5.1 |
| `test/utils/date_formatters_test.dart` | **MISSING** — §5.2 |
| `test/features/wallet/top_up_online_test.dart` | **MISSING** — §3.3 |
| `test/features/wallet/top_up_receipt_navigation_test.dart` | **MISSING** — §3.4 |
| `test/features/kyc/photo_upload_concurrent_test.dart` | **MISSING** — §6.3 |
| `test/features/onboarding/permissions_no_call_log_test.dart` | **MISSING** — §6.4 |

**13 new test files.** Each is small (50-150 lines). Total new test code: ~1,200 lines.

---

## 11. Architecture observations (carry-over)

The 8 prior-session audits have 3 architectural themes that the new audits (#15-#24) also surface — these are NOT solved by this PR but are worth flagging:

1. **Logout state leak** — every feature has its own Notifier with its own `logout()` method, and `RiderNotifier.logout()` is the only place that orchestrates them. The reset should be centralized in a `RiderResetService` (or done via Riverpod's `ref.invalidate()` over a curated set). This PR's §4.1 fix is a 5-line band-aid, not a structural fix. **Recommend:** a follow-up PR (1 day) adds `RiderResetService` and a `ResetOnLogout` annotation that the orchestrator scans.
2. **Two parallel enums for the same domain concept** — `KycEntity`/`KycField` (dead) vs `KycStatus` (canonical). This pattern is the *exact* same shape as the "two-impl" theme in audits #22 and #23. The team's coding convention should require a single source of truth per concept, with dead siblings deleted on the next touch.
3. **Permission list duplication** — `permissions_screen.dart` has a hardcoded list of 8 permission items AND a separate `ConsentType` enum with the same items. They drift. Recommend: a `PermissionSpec` registry in `lib/core/permissions/` that both the screen and the consent service read from.

---

## 12. Out-of-scope (acknowledged in this plan but not fixed)

- All **web** findings in the 8 prior-session audits are **fixed** (verified 2026-08-06). No web changes needed.
- All **backend** findings (route mismatches, schema strictness) are **fixed** in `fix/phase6d-api-hardening` (the 3 PRs already merged).
- The new audits #15-#24 (5-PR cleanup sprint from 2026-08-05) are tracked separately in `PRIOR_AUDIT_REVIEW_PLAN_2026-08-05.md`.

---

## 13. Reviewer focus notes (for the actual PR review)

When the user reviews `fix/prior-audit-2026-08-06`:

- **Commits 1-2 are pure cleanup** (delete dead files + 5 lines of state reset). Approve without deep review.
- **Commits 3-10 are UX honesty fixes** (tile removal, snackbar copy, router fix). Approve based on whether the new copy reads honestly, not on code structure.
- **Commit 11 (concurrent uploads) is the only risky one** — it changes the upload pipeline. Review the test, then the code.
- **Commit 13 (Razorpay) needs backend + Flutter review** — pair with someone who knows the payments domain. Verify the env vars are added to `web/.env.example` and `flutter/.env.example`.

**Acceptance criteria for the PR:**

1. `flutter analyze` reports 0 new issues.
2. All 13 new test files pass.
3. No regression in the existing 18 unit tests.
4. Manual QA on a real device: rider A logs in, opens ticket, logs out; rider B logs in, sees no A's data.
5. Manual QA: rider accepts legal, force-quits, reopens — no legal screen.
6. Manual QA: rider submits KYC with 5 photos — uploads run in parallel (check via network tab).
7. Manual QA: rider attempts online top-up — sees a real Razorpay checkout (not the broken hardcoded URL).
