# Flutter Rider App — Mobile Entry / OTP / Intent of Use — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:** the auth-entry funnel before KYC:
- `flutter/lib/features/auth/presentation/screens/login_screen.dart` (324 lines — the phone entry)
- `flutter/lib/features/auth/presentation/screens/otp_verification_screen.dart` (427 lines — the 6-digit OTP entry)
- `flutter/lib/features/auth/presentation/widgets/{phone_entry_widget, otp_app_bar, otp_resend_widget, otp_trigger_widget, otp_verify_button}.dart` (5 sub-widgets)
- `flutter/lib/features/auth/widgets/{otp_input, phone_input_field, pre_dashboard_widgets}.dart`
- `flutter/lib/features/auth/data/repository_impl.dart` (66 lines — the `AuthRepositoryImpl` calling the auth API)
- `flutter/lib/features/auth/domain/{entity, repository}.dart` (the `SendOtpResult`, `VerifyOtpResult`, abstract `AuthRepository`)
- `flutter/lib/utils/phone_validator.dart` (53 lines — the phone format validator)
- `flutter/lib/widgets/{spark_otp_input, underline_otp_input}.dart` (2 OTP widget variants + a kill-switch flag)
- `flutter/lib/core/network/generated/api_models.dart` lines 4-78 (the `SendOtpRequest`, `SendOtpResponse`, `VerifyOtpRequest`, `VerifyOtpResponse` models)
- `flutter/lib/features/kyc/presentation/screens/intent_of_use_screen.dart` (336 lines — the post-OTP "delivery vs personal" picker)
- `flutter/lib/services/secure_storage_service.dart` (token storage)
- Tests: `flutter/integration_test/e2e_individual/04_login_screen_test.dart`, `04_debug_login_test.dart`, `05_otp_verification_test.dart`, `06_full_auth_login_test.dart`, `17_otp_resend_test.dart`, `18_otp_back_button_test.dart`

**Out of scope:** The KYC onboarding flow (splash → kyc_preflight → legal → permissions → kyc_preflight are all covered in `FLUTTER_ONBOARDING_AUDIT_2026-08-05.md`). The splash screen. The `WelcomeScreen` dead code (also in the onboarding audit). The web's login/OTP flow.

---

## TL;DR

**The login → OTP → intent of use flow works end-to-end on the happy path but the referral attribution is silently broken.** A new rider who types a referral code at signup is created **without the referral attached** to their account. The login screen passes the referral code to `AuthRepositoryImpl.sendOtp` (line 18-22 of `repository_impl.dart`), which constructs a `SendOtpRequest` that has **no `referralCode` field** — the value is silently dropped. The OTP screen HAS the referral code available via `widget.referralCode` (line 51) but doesn't pass it to `verifyOtp` (line 165-167 calls `verifyOtp(phone, code)` with 2 args, no referral). The `VerifyOtpRequest` model HAS a `referralCode` field (line 52, 58, 66) but no caller uses it.

**The referral program is broken end-to-end.** The PostHog event `signup_completed` includes the referral code in its properties (line 187-189 of `otp_verification_screen.dart`) — so analytics DOES know about the referral — but the business logic on the backend never gets it.

There are also other issues:
- **`PhoneValidator.validate` returns an error string but the caller `_handleLogin` (line 95-100 of login_screen) discards it.** The user gets no UI feedback when their phone is invalid.
- **`_handleVerify` calls `PostHogService.identify` / `capture` with `unawaited` (line 177, 182, 186)** — fire-and-forget. If the app crashes during a tight session, analytics is lost.
- **Intent of use screen instantiates `ApiClient()` and `VoltiumApiClient()` inline (line 190)** — not using the `ApiClientProvider` Riverpod DI. The rider provider already has these.
- **Intent of use button doesn't show a loading state during submit (line 168-212)** — a user could double-tap and trigger 2 API calls.
- **`PhoneInputField` widget exists in `features/auth/widgets/` but is unused** — `PhoneEntryWidget` re-implements it inline.
- **`useUnderlineOtp` kill switch (line 75 of `otp_verification_screen.dart`)** is a one-line boolean that flips between 2 OTP widget variants. A safer pattern is feature flags.

There are **4 P0s** (referral code broken; no phone validation feedback; PostHog fire-and-forget on critical path; etc.), **7 P1s**, and **4 P2s**.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, silent data loss, business logic bug | Before next release |
| **P1** | UX friction, race condition, accessibility, dead code | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: Referral code is silently dropped on signup — `AuthRepositoryImpl.sendOtp` accepts the code but the API request has no field for it

**Files:**
- `flutter/lib/features/auth/data/repository_impl.dart` lines 18-22.
- `flutter/lib/core/network/generated/api_models.dart` lines 4-22 (the `SendOtpRequest` model).

**What:** The `AuthRepositoryImpl.sendOtp` method accepts a `referralCode` parameter (line 18) but constructs a `SendOtpRequest` that has only `phone`:

```dart
// features/auth/data/repository_impl.dart:18-22
@override
Future<SendOtpResult> sendOtp(String phone, {String? referralCode}) async {
  final request = SendOtpRequest(phone: phone);  // ← referralCode not passed
  final response = await _apiClient.postAuthSendOtp(request);
  return SendOtpResult(exists: response.exists ?? false);
}
```

The `SendOtpRequest` model:
```dart
// core/network/generated/api_models.dart:4-22
class SendOtpRequest {
  final String phone;
  SendOtpRequest({required this.phone});
  // ...toJson returns {'phone': phone} — no referralCode
}
```

The `SendOtpRequest` is generated code — `core/network/generated/api_models.dart` has the comment "GENERATED CODE - DO NOT MODIFY BY HAND" at the top. So the referral code can't be passed without regenerating from the OpenAPI spec.

The login screen passes the referral:
```dart
// features/auth/presentation/screens/login_screen.dart:107-111
final referralCode = _referralController.text.trim();
await ref.read(authRepositoryProvider).sendOtp(
  digits,
  referralCode: referralCode.isNotEmpty ? referralCode : null,
);
```

The value is passed to the repository, but the repository drops it. The backend never receives the referral code.

**Combined with P0-2** (the OTP screen doesn't pass the referral to `verifyOtp`), **the referral program is broken end-to-end.** Every new rider who signs up with a referral code is recorded as having no referral.

**Repro:**
1. Get a valid referral code from a friend.
2. Sign up with a new phone number, type the referral code in the "Referral Code (Optional)" field.
3. Complete the flow.
4. **Server-side:** the new rider's `referralCode` field is null/empty. The friend gets no credit.
5. **Analytics-side:** the PostHog event `signup_completed` includes the referral code in its `properties` (line 187-189 of `otp_verification_screen.dart`), so the analytics is right but the business logic is wrong.

**Impact:** Silent business logic failure. The referral program — a growth lever — is broken. Every referral-attributed signup is recorded as direct. Friends who refer riders get no reward.

**Fix:** Two options:
- **(a) Add `referralCode` to the OpenAPI spec and regenerate the client.** The `SendOtpRequest` model then has a `referralCode` field, the repository passes it. ~1 hour of work + regen.
- **(b) Move the referral code to the `VerifyOtpRequest` (which already has the field, see P0-2).** The login screen passes the code through the auth state to the OTP screen, the OTP screen passes it to `verifyOtp`. No OpenAPI changes needed. ~30 min of work.

I'd recommend (b) because the API already supports it. The login screen → OTP screen handoff is straightforward via the router state.

**Effort:** 30 min for (b), 1h for (a). **Risk:** Low. **Highest business impact P0** — every new rider is affected.

---

### P0-2: OTP screen has the referral code but doesn't pass it to `verifyOtp` — even though `VerifyOtpRequest` HAS a `referralCode` field

**Files:**
- `flutter/lib/features/auth/presentation/screens/otp_verification_screen.dart` lines 159-213 (`_handleVerify`).
- `flutter/lib/features/auth/domain/repository.dart` line 9 (`AuthRepository.verifyOtp` signature).
- `flutter/lib/core/network/generated/api_models.dart` lines 48-78 (`VerifyOtpRequest` model).

**What:** The OTP screen has access to `widget.referralCode` (line 51 of `otp_verification_screen.dart`):
```dart
const OtpVerificationScreen({
  ...
  this.referralCode,  // ← has the code
});
```

But the `_handleVerify` method (line 165-167) calls verifyOtp with only 2 args:
```dart
// features/auth/presentation/screens/otp_verification_screen.dart:165-167
final phone = widget.phoneNumber.replaceAll(RegExp(r'\D'), '');
final result =
    await ref.read(authRepositoryProvider).verifyOtp(phone, code);  // ← no referralCode
```

The `AuthRepository.verifyOtp` signature (line 9 of `domain/repository.dart`):
```dart
Future<VerifyOtpResult> verifyOtp(String phone, String otp);  // ← no referralCode parameter
```

The `VerifyOtpRequest` model (line 48-78 of api_models.dart):
```dart
class VerifyOtpRequest {
  final String? phone;
  final String? otp;
  final String? idToken;
  final String? referralCode;  // ← has the field, generated from OpenAPI
  ...
}
```

**The model has it. The API supports it. The repository doesn't expose it. The screen doesn't pass it.** Three layers of "almost-works" stacked on top of each other.

**This is the P0-1 fix part B.** The complete fix is to:
1. Add `String? referralCode` to the `AuthRepository.verifyOtp` abstract method.
2. Add it to the `AuthRepositoryImpl.verifyOtp` and pass to `VerifyOtpRequest(referralCode: ...)`.
3. Have the OTP screen's `_handleVerify` pass `widget.referralCode`.

**Repro:** Same as P0-1. The signup completes, but the new rider's account has no referral attached.

**Impact:** Same as P0-1. Combined fix, same 30-60 min.

**Effort:** 30 min. **Risk:** Low. **Co-fix with:** P0-1.

---

### P0-3: `PhoneValidator.validate` returns an error message but `_handleLogin` discards it — the user gets no UI feedback for an invalid phone

**File:** `flutter/lib/features/auth/presentation/screens/login_screen.dart` lines 95-100.

**What:** The login screen's `_handleLogin` method calls `PhoneValidator.validate(digits)` (line 96) and captures the result in `error`, but does nothing with it:

```dart
// features/auth/presentation/screens/login_screen.dart:95-100
final digits = _phoneController.text.replaceAll(RegExp(r'\D'), '');
final error = PhoneValidator.validate(digits);  // ← returns "Phone number must be 10 digits" etc.
if (error != null) {
  setState(() {});  // ← just refreshes state, doesn't show error to user
  return;
}
```

The `setState(() {})` is essentially a no-op (no state changes). The user is left wondering why nothing happened when they tapped "Enter" with an invalid phone.

The `PhoneEntryWidget` does have inline error display (line 95-100 of `phone_entry_widget.dart`), but the inline error only fires for partial numbers (e.g., 9 digits → "Phone number must start with..."). For a 10-digit number that fails the prefix check (e.g., starts with 5), the inline error fires too. But for **an empty phone + tap Enter**, the `PhoneEntryWidget`'s inline error does NOT fire (because the check is in `setState(() => _phoneError = null)` if digits are empty), and the login screen's `_handleLogin` does nothing.

**Repro:**
1. Open the login screen (without typing anything).
2. Tap "Enter" / submit.
3. **Observe:** nothing happens. The button is technically disabled (`_canSubmit` returns false because `PhoneValidator.isValidPhone` is false), but on the OTP screen this is a separate state, and the user can sometimes see a momentary clickable state during the transition.

The bigger issue: **the phone validator runs but its result is invisible.** A user who types 9 digits, taps Enter, sees no error message and the screen stays put. They might assume the app is broken.

**Fix:** Either:
- **(a)** Display the validation error in the login screen: pass the error to `PhoneEntryWidget` via a state, or use a `ScaffoldMessenger.showSnackBar(error)`.
- **(b)** Move the validation entirely into `PhoneEntryWidget`, which already has inline error display. The `setState(() {})` on the login screen becomes a no-op because validation happens in the child widget.

I'd recommend (b) — the inline error UI is already built; the login screen just needs to respect it.

**Effort:** 15 min. **Risk:** Low.

---

### P0-4: `_handleVerify` fires `PostHogService.identify` and `capture` with `unawaited` — fire-and-forget on the critical auth path

**File:** `flutter/lib/features/auth/presentation/screens/otp_verification_screen.dart` lines 177-189.

**What:** The OTP verification success path fires 3 PostHog events:
```dart
// features/auth/presentation/screens/otp_verification_screen.dart:177-189
if (rider.riderId.isNotEmpty) {
  unawaited(PostHogService.identify(rider.riderId, properties: {
    'lifecycle_status': rider.lifecycleStatus,
    'account_status': rider.accountStatus.name,
  }));
}
unawaited(PostHogService.capture('otp_verified', properties: {
  'is_new_rider': isNewRider.toString(),
}));
if (isNewRider) {
  unawaited(PostHogService.capture('signup_completed', properties: {
    if (widget.referralCode != null)
      'referral_code': widget.referralCode!,
  }));
}
```

The `unawaited(...)` wrapper explicitly discards the futures. The PostHog SDK is fire-and-forget by design (the network call happens off the main isolate), but if the app crashes during a tight window between the API call and the analytics call, the analytics is lost.

**More importantly:** the `signup_completed` event with the `referral_code` is the ONLY signal that a new rider used a referral. If PostHog's queue is dropped (e.g., the app is killed within 1 second of OTP verification, or the network call fails), Voltium loses the referral signal. Combined with P0-1/P0-2, this means the analytics has the referral, but the business logic doesn't — and the analytics could be lost too.

**Fix:** Either:
- **(a)** `await` the PostHog calls before continuing. Adds ~50-100ms to the auth flow but guarantees delivery.
- **(b)** Use a `PostHogService.queueEvent(...)` method that persists events to local storage and flushes on next launch.

I'd recommend (a) for `signup_completed` and `identify` (the critical events) and keep `otp_verified` fire-and-forget.

**Effort:** 5 min. **Risk:** Low.

---

## P1 — Next 2 sprints

### P1-1: `PhoneInputField` widget in `features/auth/widgets/` is dead code — `PhoneEntryWidget` re-implements it inline

**File:** `flutter/lib/features/auth/widgets/phone_input_field.dart` (3,918 bytes).

**What:** `grep` for `PhoneInputField` returns only hits in the file itself. The actual phone input is re-implemented inline in `phone_entry_widget.dart` lines 178-208 (the `_buildPhoneInput` method).

**Two parallel implementations of the same component.** The `PhoneInputField` is slightly more featureful (has `textFormFieldKey`, separate `errorText` param), but the inline version in `PhoneEntryWidget` has the staggered animation, the "+91" prefix with phone icon, and the error styling. They're 80% visually identical.

**Fix:** Either delete `PhoneInputField` (3,918 bytes removed) or refactor `PhoneEntryWidget` to use it. The widget already exists; just plug it in.

**Effort:** 30 min. **Risk:** Low.

---

### P1-2: Intent of use screen instantiates `ApiClient()` and `VoltiumApiClient()` inline instead of using the Riverpod DI

**File:** `flutter/lib/features/kyc/presentation/screens/intent_of_use_screen.dart` line 190.

**What:**
```dart
// features/kyc/presentation/screens/intent_of_use_screen.dart:189-193
try {
  await VoltiumApiClient(ApiClient())
      .putRiderProfile(
    UpdateProfileRequest(intent: intentStr),
  );
```

The `VoltiumApiClient` and `ApiClient` are constructed inline (per-call). The proper pattern (used by other screens) is `ref.read(apiClientProvider)` or similar.

**Repro:** N/A — the inline construction works. But it's a code smell:
1. The same instances are created on every intent-of-use submit.
2. If the auth token is refreshed at the API client level (e.g., via an interceptor), the inline construction creates a new client that doesn't have the refreshed token.
3. The Riverpod provider system is bypassed; tests can't mock the client.

**Fix:** Use the existing providers:
```dart
await ref.read(apiClientProvider).putRiderProfile(
  UpdateProfileRequest(intent: intentStr),
);
```

**Effort:** 5 min. **Risk:** Low.

---

### P1-3: Intent of use button doesn't show a loading state during submit — a user could double-tap and trigger 2 API calls

**File:** `flutter/lib/features/kyc/presentation/screens/intent_of_use_screen.dart` lines 168-212.

**What:** The "Confirm Selection" button is disabled when `_selectedIntent == null` but has NO loading state during the API call. A user with a slow connection could:
1. Tap "Confirm Selection".
2. The API call takes 3 seconds (slow network).
3. The user thinks the tap didn't register, taps again.
4. **Two `putRiderProfile` calls fire in parallel.** The second one might overwrite the first with the same value, or might race with the rider provider's `refresh()`.

**Repro:**
1. Select an intent.
2. Throttle the network to 3G speed.
3. Tap "Confirm Selection".
4. Within 1 second, tap again.
5. **Observe:** 2 API calls in the dev tools network tab.

**Fix:** Add a `_isSubmitting` state and show a loading spinner:
```dart
onPressed: _selectedIntent == null || _isSubmitting
    ? null
    : () async {
        setState(() => _isSubmitting = true);
        try {
          await ...
        } finally {
          if (mounted) setState(() => _isSubmitting = false);
        }
      },
```

**Effort:** 10 min. **Risk:** Low.

---

### P1-4: `IntentType` enum has only 2 hardcoded values — `delivery` and `personal` — but the API might accept more

**File:** `flutter/lib/features/kyc/presentation/screens/intent_of_use_screen.dart` line 13.

**What:**
```dart
enum IntentType { delivery, personal }
```

The enum has 2 values. The server may accept more (e.g., `business`, `student`, `tourist`). The `UpdateProfileRequest(intent: ...)` would be constrained to these 2 strings.

The string mapping is:
```dart
// features/kyc/presentation/screens/intent_of_use_screen.dart:172-175
final intentStr =
    _selectedIntent == IntentType.delivery
        ? 'deliver'
        : 'personal';
```

The enum's `delivery` maps to the string `'deliver'` (not `'delivery'`). The enum's `personal` maps to `'personal'`. The `'deliver'` plural mismatch is a code smell — the enum and the string are different.

**Fix:** Define the enum to match the API strings exactly:
```dart
enum IntentType {
  deliver('deliver'),
  personal('personal');
  // ...
}
```

Or fetch the supported intents from the API at app startup. The current 2-value hardcode is fine for India MVP but won't scale.

**Effort:** 5 min for the enum fix. **Risk:** Low.

---

### P1-5: OTP resend countdown is hardcoded to 30 seconds — server may want a different cooldown

**File:** `flutter/lib/features/auth/presentation/screens/otp_verification_screen.dart` line 84, 224.

**What:** The OTP screen hardcodes `_resendCountdown = 30` (line 84) and resets to 30 on resend (line 224). The server's actual cooldown (configurable in the admin?) may differ.

**Repro:** If the server's cooldown is 60 seconds and the rider sees "Resend in 30s" but the server returns 429 at 30s, the rider gets an error and has to wait again.

**Fix:** Read the cooldown from the `SendOtpResponse` (the API should return `resendAfter: 30` or similar). The current `SendOtpResponse` only has `exists` and `otp` fields — no cooldown.

**Effort:** 30 min (add `resendAfterSeconds` to `SendOtpResponse`, update the OTP screen). **Risk:** Low.

---

### P1-6: `_bounceCtrl.repeat(reverse: true)` runs forever in `_OtpVerificationScreenState` — battery drain if user lingers on the screen

**File:** `flutter/lib/features/auth/presentation/screens/otp_verification_screen.dart` lines 110-118.

**What:** The bouncing smartphone icon animation is `repeat(reverse: true)` (line 117). This runs forever as long as the screen is mounted. The `_bounceCtrl` is disposed in `dispose` (line 133), so when the screen is popped, the animation stops. But while the screen is alive, the animation runs continuously.

For an OTP screen that should be entered and exited in 10-30 seconds, this is fine. For a user who opens the OTP screen and switches to another app for 5 minutes (e.g., to read the OTP from SMS), the animation runs in the background. Minimal battery cost but unnecessary.

**Fix:** Pause the animation in `didChangeAppLifecycleState`:
```dart
@override
void didChangeAppLifecycleState(AppLifecycleState state) {
  if (state == AppLifecycleState.resumed) {
    _bounceCtrl.repeat(reverse: true);
  } else {
    _bounceCtrl.stop();
  }
}
```

**Effort:** 10 min. **Risk:** Low.

---

### P1-7: `useUnderlineOtp` kill switch (line 75) is a hardcoded static const — no remote flag

**File:** `flutter/lib/features/auth/presentation/screens/otp_verification_screen.dart` line 75.

**What:**
```dart
/// Lives here (not in AppConstants) so the OTP screen is the only thing
/// that branches on it — keeps blast radius small.
static const bool useUnderlineOtp = true;
```

This is a feature flag for the new Apple/Google-style OTP input. The kill switch is a one-line boolean in the OTP screen. If the underline OTP has a critical bug, the developer can flip it to `false` and ship. But:
1. Flipping requires a code change + release.
2. There's no remote control (e.g., Firebase Remote Config) to flip without a release.
3. The kill switch is in production code — if a rider's app has `useUnderlineOtp = true` and it crashes, they have to wait for a release.

**Fix:** Add a remote flag (Firebase Remote Config is common, or a simple API endpoint). The OTP screen reads the flag at startup and on app resume.

**Effort:** 2-3h (add Remote Config integration). **Risk:** Medium.

---

## P2 — Cleanup backlog

### P2-1: `_OtpVerificationScreenState._readOtpValue` and `_clearOtp` use duck typing on `SparkOtpInputState` / `UnderlineOtpInputState` — should be a common interface

Lines 93-105 of `otp_verification_screen.dart`:
```dart
String _readOtpValue() {
  final state = _otpKey.currentState;
  if (state is SparkOtpInputState) return state.value;
  if (state is UnderlineOtpInputState) return state.value;
  return '';
}
```

If a 3rd OTP widget variant is added, this method needs another `is` check. The cleaner pattern: a `VoltiumOtpInputState` abstract class with `value` and `clear()` methods, both widgets extend it.

**Effort:** 30 min. **Risk:** Low.

### P2-2: `_handleLogin` calls `PostHogService.captureError(e, null, reason: 'otp_request_failed')` but doesn't capture the error stack

Line 122 of `login_screen.dart`:
```dart
PostHogService.captureError(e, null, reason: 'otp_request_failed');
```

The `null` second arg is the stack trace. The actual `e.toString()` would be useful for debugging. Capture both.

**Effort:** 5 min. **Risk:** Low.

### P2-3: The `intent_of_use_screen` `_buildIntentCard` is 100 lines of inline widget — should be a top-level widget

`features/kyc/presentation/screens/intent_of_use_screen.dart` lines 237-335 (the `_buildIntentCard` private method). A shared `IntentCard` widget would make the screen testable.

**Effort:** 30 min. **Risk:** Low.

### P2-4: `phone_entry_widget.dart` `_onPhoneChanged` does inline validation that duplicates `PhoneValidator.validate`

Lines 86-102 of `phone_entry_widget.dart`:
```dart
void _onPhoneChanged(String value) {
  setState(() {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) {
      _phoneError = null;
    } else if (digits.length == 10) {
      _phoneError = PhoneValidator.validate(digits);
    } else if (digits.length > 10) {
      _phoneError = 'Phone number cannot exceed 10 digits';
    } else if (!RegExp(r'^[6-9]').hasMatch(digits)) {
      _phoneError = 'Phone number must start with 6, 7, 8, or 9';
    } else {
      _phoneError = null;
    }
  });
  ...
}
```

This duplicates the logic in `PhoneValidator.validate` (which checks all 4 conditions). Should call `PhoneValidator.validate(digits)` and use its result, with a special case for the partial-length state.

**Effort:** 10 min. **Risk:** Low.

---

## Recommended fix order

| # | Item | Section | Effort | Risk |
|---|---|---|---|---|
| 1 | **P0-1 + P0-2** Fix referral code on both send-otp and verify-otp paths | repository_impl + auth_repository + api_models + login_screen + otp_screen | 30-60min | Low |
| 2 | **P0-3** Display phone validation error in `_handleLogin` | login_screen | 15min | Low |
| 3 | **P0-4** `await` the PostHog `signup_completed` and `identify` calls | otp_screen | 5min | Low |
| 4 | **P1-1** Delete or wire the `PhoneInputField` widget | features/auth/widgets/ | 30min | Low |
| 5 | **P1-2** Use `apiClientProvider` in intent_of_use_screen | intent_of_use_screen | 5min | Low |
| 6 | **P1-3** Add loading state to intent button | intent_of_use_screen | 10min | Low |
| 7 | **P1-4** Fix `IntentType` enum to match API strings | intent_of_use_screen | 5min | Low |
| 8 | **P1-5** Read resend cooldown from `SendOtpResponse` | api_models + otp_screen | 30min | Low |
| 9 | **P1-6** Pause bouncing icon on app background | otp_screen | 10min | Low |
| 10 | **P2-1, P2-2, P2-3, P2-4** Code cleanup | various | 1-2h | Low |

**Suggested PR shape (each shippable independently):**
- **PR: "P0-1 + P0-2 + P0-4 — referral code + PostHog await"** — 5 lines, 4 files. **Highest-impact PR — referral program works again.**
- **PR: "P0-3 + P1-1 + P1-2 + P1-3 + P1-4 — login/OTP/intent cleanup"** — 6 small fix-one-thing PRs, ~30 lines, 4 files.
- **PR: "P1-5 + P1-6 + P2.x — UX polish"** — 1-2h, 3 files.

---

## Tests gap analysis

| Section | Existing test | What's missing |
|---|---|---|
| **Login** | `04_login_screen_test.dart`, `04_debug_login_test.dart` (smoke + the debug login helper) | The P0-3 phone validation. The P1-1 `PhoneInputField` widget. The referral code path. |
| **OTP** | `05_otp_verification_test.dart`, `17_otp_resend_test.dart`, `18_otp_back_button_test.dart` | The P0-1/P0-2 referral code passed to verifyOtp. The P0-4 PostHog identify. The P1-5 resend cooldown from server. The P1-7 useUnderlineOtp kill switch behavior. |
| **Intent of use** | None (only covered as part of `34_full_onboarding_to_dashboard_test.dart`) | The P1-3 double-tap protection. The P1-4 enum mapping. The P1-2 ApiClient DI. |
| **AuthRepository** | None (unit tests) | The send-otp with referral code (P0-1). The verify-otp with referral code (P0-2). The token persistence. |
| **PhoneValidator** | None (unit tests) | The "5-prefix" rejection. The "exactly 10 digits" rule. The empty input. |

**The 5 login/OTP tests are all smoke tests** that assert "the screen renders" or "the flow completes" — same pattern as the other audits. The P0-1 referral code bug would NOT be caught by any of them.

The most valuable tests to add (in priority order):
1. **P0-1 + P0-2 test:** sign up with a referral code → assert the new rider's account has the referral attached (would require a backend assertion).
2. **P0-3 test:** type 9 digits + tap Enter → assert an error message is shown.
3. **P0-4 test:** complete OTP verification → assert PostHog `signup_completed` was called (would require a PostHog mock).
4. **P1-1 test:** `PhoneInputField` widget renders with the correct chrome.
5. **P1-3 test:** tap intent button twice quickly → assert only 1 API call fires.

---

## Architecture observations (informational)

1. **The `AuthRepository` is the cleanest repository in the codebase** — small interface (3 methods), clean implementation, well-typed results. Compare to the `RentalRepository` (rentals audit) which has dead methods, the `SupportRepository` (support audit) which has parallel providers, the `EmergencyContactsNotifier` (emergency audit) which has race conditions. The `AuthRepository` is a model for how the others should look.

2. **The two OTP widget variants (`SparkOtpInput` and `UnderlineOtpInput`) are 90% identical** — both have a `value` getter, a `clear()` method, an `onCompleted` callback, an `onChanged` callback, and an `autoFocus` flag. The visual difference is the underline style. A common abstract class with 2 implementations would be cleaner than the duck-typing `_readOtpValue()` / `_clearOtp()`.

3. **The referral code path is a textbook example of "broken end-to-end with no test catching it":**
   - **Login screen** collects the code (line 107-111 of `login_screen.dart`).
   - **AuthRepository** accepts the code as a named parameter (line 6 of `domain/repository.dart`).
   - **AuthRepositoryImpl** captures the code in the function signature (line 18) but drops it.
   - **SendOtpRequest** doesn't have the field (auto-generated from OpenAPI).
   - **OTP screen** has the code (line 51) but doesn't pass it.
   - **VerifyOtpRequest** HAS the field (line 52).
   - **PostHog** has the code in the analytics (line 188).

   The code is **almost** wired through 4 of 5 layers. The single missing wire is the repository impl → API. The fix is 5 lines but the business impact is the entire referral program.

4. **The `_handleVerify` PostHog `unawaited` pattern** is a common Flutter anti-pattern. The `unawaited` function (from `dart:async`) was added to explicitly mark fire-and-forget calls. But for events that the business cares about (signup completion), `await` is the right pattern. A code review guideline: "If the event is in a critical business path, await it. If it's a UX telemetry, fire-and-forget is fine."

5. **The `PhoneValidator` is a static class** — no instance, no Riverpod provider. This is fine for pure functions, but the validation messages (e.g., "Phone number must start with 6, 7, 8, or 9") are hardcoded English. The l10n pattern (per the dark-mode/language audit) would be to return error codes and have the UI translate them. For now, the English messages are acceptable.

6. **The `_buildAmbientGlow` decoration** is duplicated in `login_screen.dart` (line 195-215) and `otp_verification_screen.dart` (line 297-315). Both have a 300×300 circle with `RadialGradient` of primary color at 5% alpha. A shared `AmbientGlow` widget would DRY this up. ~40 lines of duplication.

7. **The login screen's `_handleLogin` does not use `ProviderScope.containerOf(ctx).read(authRepositoryProvider)`** — it uses `ref.read(authRepositoryProvider)`. The OTP screen does the same. The settings screen (dark-mode/language audit) and profile screen use the `ProviderScope.containerOf` pattern. The codebase has 2 patterns for the same operation. Worth a convention.

8. **The `PhoneInputField` widget in `features/auth/widgets/` is a sibling of `pre_dashboard_widgets.dart`** in the same directory. The directory mixes reusable widgets (`PhoneInputField`, `OtpInput`) with the 25KB `pre_dashboard_widgets.dart` god-file. Worth a `widgets/auth/` subfolder for clarity.

9. **The `authRepositoryProvider` is overridden in `main.dart`** (likely), following the R4.3c-1 migration. But the override pattern means tests can inject a fake repository. Worth verifying the override exists — if it doesn't, the production code uses the default `throw UnimplementedError()` provider and the prod would crash.

---

## Out-of-scope notes

- **The login screen's referral code is collected but the analytics is the only place it's USED in this audit scope.** The referral is supposed to be passed through to the backend, and the broken wiring is P0-1. The PostHog event is the only place where the referral is preserved (locally) when the rider is created.
- **The `Intent of use` screen is a 1-question 2-card picker.** For a "command center" app, the screen is intentionally minimal. A future enhancement would be a multi-question onboarding (intent + primary use case + city + expected usage per week), but that's product scope, not bug.
- **The `_handleVerify` reads `widget.phoneNumber` (which has the placeholder default `+91 98765 43210`)** — if the OTP screen is mounted without a phone (e.g., a test mount), the verify-otp call sends the placeholder phone. The server would return 404 / unknown phone. The test should be aware.
- **The `useUnderlineOtp` flag is per-build, not per-rider.** A rider on iOS v2.1.0 with the new underline OTP and another rider on iOS v2.1.0 with the old boxes (because of a phased rollout) would have different experiences. A remote flag (P1-7) would unify the experience.
- **The `SparkOtpInput` and `UnderlineOtpInput` both use `FilteringTextInputFormatter.digitsOnly`** — the user can't paste an alphanumeric string. Good for security (no phishing OTPs from SMS headers) but bad for accessibility (screen reader users can't paste).
- **The login screen has a "Welcome" section that says "Enter the registered phone number to login or enter a new number to create another account."** — this is a dual-purpose screen (sign in + sign up) but there's no UI to distinguish. A rider returning to the app might accidentally create a 2nd account if they mistype their number. The phone validator would still accept any 10-digit Indian number, so a typo creates a new account silently.
- **The OTP screen's `_handleResend` does NOT validate the phone** before calling sendOtp. If the OTP screen is mounted with a wrong/empty phone (test scenario), the resend would call sendOtp with a bad phone. The server would return an error. The UI shows the error. Minor.
- **The `SecureStorageService.setToken` is called on mobile but skipped on web** (per line 30-36 of `auth_repository_impl.dart`). The comment says "Web is excluded because FCM is mobile-only" — but the FCM comment applies to `writeFcmCommandSecret` (line 42-44), not the token. The token should be persisted on web too (e.g., in `localStorage`). The current code may be a workaround for a web-specific bug that wasn't fully fixed.
- **The `provider.refresh()` in `intent_of_use_screen.dart` line 194** triggers a full rider profile refetch after the intent is saved. This is a separate API call (`/api/rider/profile`) on top of the `putRiderProfile` call. Two calls to update one piece of state. The cleaner pattern: have `putRiderProfile` return the updated rider, so no second call is needed.
