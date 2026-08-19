# Onboarding Deep Audit — Voltium Rider App

**Date:** 2026-08-14
**Scope:** Active onboarding path: `phone → OTP → userForm (kyc) → intentOfUse → documents → signature → guarantorForm → choosePlan → planSuccess → topUpAmount → topUpProof → topUpReceipt → pickupHub → vehiclePhotos → tlDetails → pickupVerification → hangTight → activeDashboard`
**Branch:** `db/h6-audience-discriminator` (HEAD = `2a269831`)
**Auditor:** MiniMax-M3 (read-only)
**Method:** Static code analysis. No device run, no instrumented calls. Every finding is demonstrated by quoting the code that proves it.

---

## 1. Executive summary

**40 findings** across 4 severities. Distribution:

- **P0 (data loss / breaks the flow / security):** 4
- **P1 (visible UI bugs / confusing UX / likely race conditions):** 11
- **P2 (edge cases / design smells / refactor candidates):** 14
- **P3 (minor issues / observations / tech debt):** 11

The most damaging single finding is a **silent data loss** in the active onboarding top-up: when a rider submits a security-deposit proof during the new active path, the router's `onSubmit` callback **only navigates forward** and never calls the server. The proof image, method, and UPI reference are received and discarded. The rider reaches the pickup form believing they paid; the server has no record. (P0-1 below.)

The second-most damaging cluster is two **IME-safety risk zones** that re-introduce the C2 OTP bug anti-patterns (`Opacity(0.0)` over `TextField`, custom `FocusNode`, hidden cursor). The fix shipped in `phone_entry_widget.dart` (PR-AUDIT 2026-08-12) is documented in code comments but the new widgets do the opposite of what those comments recommend. Tests use `tester.enterText()` which bypasses the real keyboard, so the regression is invisible to CI.

The third is a **session-expiry gap**: only the `HangTight` screen handles a 401 by sending the rider to login. Every other onboarding screen silently swallows the 401 and shows a generic "Couldn\'t refresh your profile" message, which leaves the rider stranded mid-flow.

The audit found strong evidence of recent good work — the C2 IME investigation, the pickup-draft rehydration (PR-7), the lifecycle gate's exhaustive rank mapping, the L1/L2 "Rate Us" snackbar removal, the onSaved `Idempotency-Key` header plumbing — but the new code path is under-tested and has four P0 gaps that a physical tester would hit within their first session.

---

## 2. Critical bugs (P0)

### P0-1 — Active-path top-up proof submission is a no-op (data loss, breaks the flow)

**File:** `D:\voltium\flutter\lib\app\router_body.dart:519-540`
**Severity:** P0 (data loss; the rider's deposit is never recorded)

**Description:**
When the router is driving the active onboarding path, the `topUpProof` case constructs `TopUpProofScreen` with an `onSubmit` callback that **only navigates**:

```dart
case AuthState.topUpUpi:
case AuthState.topUpProof:
  currentScreen = TopUpProofScreen(
    key: const ValueKey('topUpProof'),
    amount: state._topUpAmount,
    onBack: () => state._navigateToLocal(AuthState.topUpAmount),
    onEditAmount: () => state._navigateToLocal(AuthState.topUpAmount),
    onSubmit: (file, method, upiRef) async {
      // PR-ONBOARDING-FLOW-2026-08-13: after the security-deposit
      // proof is submitted, the rider goes DIRECTLY to the Pickup
      // form. The topUpReceipt + planSuccess confirmations are
      // skipped — the rider has just confirmed the payment and
      // the next actionable step is the pickup form, not another
      // "you're done" screen. The dashboard top-up flow still
      // routes through the receipt ...
      state._navigateToLocal(
        state._isOnboarding ? AuthState.pickupHub : AuthState.topUpReceipt,
      );
    },
  );
```

The `file`, `method`, and `upiRef` parameters are received and **immediately discarded**. No API call is made. Compare to:

- `D:\voltium\flutter\lib\features\wallet\presentation\screens\top_up_flow.dart:98-158` — the legacy `TopUpFlow` widget's `onSubmit` calls `wProvider.topUpWallet(...)` and uploads the file via `_files.uploadFile`. This is the path the **dashboard's** "Add Money" uses.
- `D:\voltium\flutter\lib\features\dashboard\presentation\screens\legacy\deposit_workflow_screen.dart:140-150` — the legacy deposit screen's `_submit` calls `VoltiumApiService().submitTopUp(..., purpose: 'SECURITY_DEPOSIT')`.
- `D:\voltium\flutter\lib\features\wallet\presentation\providers\wallet_provider.dart:113-146` — `WalletNotifier.topUpWallet` is the live entry point; the active path's router does not invoke it.

**Why it matters:**
- The rider completes the top-up proof, taps "Submit Proof", and is navigated to `pickupHub` with no success/failure feedback (the "How was your top-up experience?" snackbar at `router_body.dart:557-575` is gated on `_isOnboarding == false`).
- No `Transaction` row with `purpose: 'SECURITY_DEPOSIT'` is created server-side.
- `rider.isDepositDone` stays false (the lifecycle gate at `rider_lifecycle_gate.dart:186-191` checks this exact flag for rank-9 riders and re-routes to `topUpAmount`).
- On a cold restart, `RiderLifecycleGate.redirect(rider)` returns `LifecycleTarget.topUpAmount` (line 190). The rider is asked to pay the deposit **again**. They can keep "paying" forever, the server never receives a transaction, but the local state machine doesn't know.
- The screenshot in the audit prompt shows this is the **active** flow ("PR-ONBOARDING-FLOW-2026-08-13" comments throughout). Every rider who reaches `topUpAmount → topUpProof` is exposed.
- The fix path is well-defined: the active path's `onSubmit` needs to mirror `top_up_flow.dart:98-158` (call `wProvider.topUpWallet(..., purpose: 'SECURITY_DEPOSIT')`); the router's `_isOnboarding` branch is what makes this a different code path from the dashboard flow. Alternatively, the legacy `deposit_workflow_screen.dart` already does exactly the right thing.

**Recommended fix:**
1. In `router_body.dart:526-538`, replace the navigation-only `onSubmit` with a real submission: call `ref.read(walletProvider.notifier).topUpWallet(riderId, amount, method, upiRef, file, purpose: 'SECURITY_DEPOSIT')`, await it, then `_navigateToLocal(...)`. Show a snackbar on failure.
2. Add a unit test that calls `AuthState.topUpProof` on a freshly-routed build and asserts the `POST /api/transaction/topup` is issued with `purpose: SECURITY_DEPOSIT`. (Producer should add the test, not the verifier.)
3. Add an integration test in `flutter/integration_test/e2e_individual/` that walks `choosePlan → topUpAmount → topUpProof → pickupHub` and asserts the transaction appears in the wallet history.

---

### P0-2 — `UnderlineOtpInput` reintroduces the C2 IME bug anti-patterns

**File:** `D:\voltium\flutter\lib\widgets\underline_otp_input.dart:172-201`
**Severity:** P0 (the existing C2 IME investigation `2026-08-13-c2-ime-investigation.md` already documents the breakage; this is the same widget, still shipping)

**Description:**
The new OTP widget (default on, `--dart-define=OTP_UNDERLINE_UI=false` to roll back) reintroduces all three C2 anti-patterns the team already documented in `phone_entry_widget.dart:59-65`:

```dart
// underline_otp_input.dart:172-201
Opacity(
  opacity: 0.0,                           // ← anti-pattern #1 (C2 Cause #1)
  child: TextField(
    controller: _controller,
    focusNode: _focusNode,                // ← anti-pattern #2 (C2 Cause #3)
    keyboardType: TextInputType.number,
    maxLength: widget.length,
    autocorrect: false,
    enableSuggestions: false,
    textAlign: TextAlign.center,
    cursorWidth: 0,                       // ← anti-pattern #3 (C2 Cause #2)
    showCursor: false,                    // ← anti-pattern #3 (C2 Cause #2)
    inputFormatters: [...],
    onChanged: _onChanged,
    ...
  ),
),
```

Plus the 300ms `TextInput.show()` workaround in `initState` (line 78-86) and the manual `requestFocus` calls (lines 80, 142) — the exact pattern `phone_entry_widget.dart` lines 59-65 say breaks the device's IME.

**Why it matters:**
- The C2 investigation at `D:\voltium\docs\audits\2026-08-13-c2-ime-investigation.md` already established the cause chain on the physical tester device P12279003265. The flag-gated swap was the temporary mitigation. The flag is `defaultValue: true` (line 84 of `otp_verification_screen.dart`), so the broken widget is the **default** for every rider.
- `test/widgets/underline_otp_input_test.dart` uses `tester.enterText(find.byType(TextField), '123456')` for every test (lines 47, 70, 89, 133, 152). `enterText` writes to the `TextEditingController` and dispatches `onChanged` without invoking the IME. The C2 investigation at lines 53-61 calls this out: "8 tests, all 6 digit-related tests use `tester.enterText` ... `enterText` writes to the `TextEditingController` directly and dispatches `onChanged` without invoking the IME."
- The integration test in `flutter/integration_test/e2e_individual/05_otp_verification_test.dart` and the E2E helpers in `flutter/integration_test/helpers/test_helpers.dart` use the same `enterText` pattern.
- A physical tester on P12279003265 who completes the flow during a phone-number entry (where `phone_entry_widget` is the proven-working path) and then proceeds to OTP will hit the regression on the **next** text-input screen.

**Recommended fix:**
1. Apply the one-line fix from `2026-08-13-c2-ime-investigation.md` §2 Cause #1-3: replace `Opacity(opacity: 0.0, child: TextField(...))` with `TextField(... style: TextStyle(color: Colors.transparent))`; drop the custom `FocusNode` and use `autofocus: true`; change `cursorWidth: 0` to `cursorWidth: 1` (or drop both `showCursor: false` and `cursorWidth: 0`).
2. Alternatively, **invert the default** of `useUnderlineOtp` to `false` (so the proven-working `SparkOtpInput` is the default) until the new widget is verified on P12279003265.
3. Add a device-driven test (not a `tester.enterText` test) that opens the OTP screen, taps the row, and asserts the IME's `mServedView` switches from `DecorView` to the `EditableText` View. (This needs a custom integration test; producer to add.)

---

### P0-3 — `OtpGrid` in pickup hub has the C2 IME bug anti-pattern with no completion signal

**File:** `D:\voltium\flutter\lib\features\pickup\widgets\pickup_hub_widgets.dart:331-396`
**Severity:** P0 (same IME-safety risk as P0-2, plus the widget is missing an `onCompleted` callback that the screen needs to know when the rider has finished typing the emergency-contact OTP)

**Description:**
The OTP grid used for the emergency-contact OTP on the pickup hub is the same broken pattern, and additionally is missing the `onCompleted` callback the OTP screen relies on for the auto-verify:

```dart
// pickup_hub_widgets.dart:339-355
return Stack(
  children: [
    Opacity(
      opacity: 0.0,                     // ← C2 anti-pattern (no focus node here,
                                        //   but the Opacity(0.0) is sufficient
                                        //   to break the IME on this device)
      child: SizedBox(
        height: 50,
        child: TextFormField(
          key: const Key('otpInputField'),
          controller: controller,
          keyboardType: TextInputType.number,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(6),
          ],
        ),
      ),
    ),
    IgnorePointer(                       // ← also blocks touch events from
      child: AnimatedBuilder(            //   reaching the TextField on some
        animation: controller,           //   devices
        builder: ...,
      ),
    ),
  ],
);
```

The widget is a `StatelessWidget` with no `onCompleted` callback. The parent (`pickup_hub_screen.dart:659-665`) reads `_otpController.text.length` and triggers `_verifyEmergencyOtp` only on button press, never on completion.

**Why it matters:**
- Same C2 IME breakage on P12279003265 as P0-2. The user-visible symptom is "I tap the OTP row on the pickup screen, my self-rendered cursor appears, but no keyboard pops up."
- The `IgnorePointer` around the visual boxes (line 356) doesn't reach the inner `TextField` (which is the first child of the `Stack`), so touch *should* reach the `TextField`. But the combination of `Opacity(0.0)` and a `Stack`-overlaid `IgnorePointer` is exactly the type of widget composition the C2 report flags as a known-bad surface.
- The lack of `onCompleted` means the rider must always tap the "Verify OTP" button — a slight friction on a small form, but the bigger issue is that the IME-break means the rider cannot even *type* the OTP without first doing the "tap two or three times" dance the C2 report documents.
- The rider is mid-onboarding with high motivation; they're not going to give up at "OTP won't go in" — they'll spam the row, and once it works, they'll feel lucky and not report it.

**Recommended fix:**
1. Mirror the recommended fix for `UnderlineOtpInput` (P0-2): drop the `Opacity(0.0)`, drop the `IgnorePointer` around the visual boxes (the `TextField` already gets touch via the `Stack`), and consider using 6 separate `TextFormField`s (the `SparkOtpInput` pattern that the C2 report says works).
2. Add an `onCompleted(String otp)` callback so the parent can auto-verify when all 6 digits are entered, matching the `UnderlineOtpInput` / `SparkOtpInput` contract.

---

### P0-4 — Session-expiry (401) silently swallowed everywhere except `HangTightScreen`

**File:** `D:\voltium\flutter\lib\core\state\rider_provider.dart:279-289` (in combination with `flutter/lib/features/dashboard/presentation/screens/hang_tight_screen.dart:96-108` and `flutter/lib/app/router_body.dart:469-481`)
**Severity:** P0 (a rider mid-onboarding whose session expires cannot recover; the screen shows a generic error and the only path forward is to force-quit the app)

**Description:**
The only place that inspects the status code of a failed `refreshFromApi` is `HangTightScreen._safeRefresh`:

```dart
// hang_tight_screen.dart:96-108
} on ApiException catch (e) {
  // ... PR-ONBOARDING-FLOW-2026-08-13: surface 401 to the router so
  // the rider is sent to the login screen ...
  if (e.statusCode == 401) {
    if (mounted) widget.onSessionExpired?.call();
    return;
  }
} catch (_) {
  // Offline / transient — the next tick will retry.
}
```

The base notifier (`RiderNotifier._doRefreshFromApi` at `rider_provider.dart:239-289`) catches all exceptions and sets `errorMessage: 'Couldn\'t refresh your profile. Pull to retry.'` with no 401-specific branch:

```dart
// rider_provider.dart:279-285
} catch (e) {
  log('Error refreshing rider profile: $e');
  state = state.copyWith(
    errorMessage: 'Couldn\'t refresh your profile. Pull to retry.',
    dataState: state.rider != null ? DataState.fromCache : DataState.error,
  );
}
```

The same pattern is in `wallet_provider.dart:190-195` (no 401 check; sets `lastError: 'Couldn\'t load your transactions. Pull to retry.'`).

A rider who is mid-onboarding (e.g., on `pickupHub` waiting for `_fetchHubs` to complete) and whose JWT expires (e.g., admin took 90 minutes to assign a vehicle) will see the hub-fetch fail with the message above. The `hang_tight_screen` handles its own 401 because the screen-level code does its own `try/await/refreshFromApi`; the other screens call into providers that swallow 401s.

**Why it matters:**
- Onboarding is a multi-step flow that can take 5 minutes to 90+ minutes (KYC review, plan selection, admin approval). A session expiring mid-flow is a real, expected event, not an edge case.
- The router's `_handleSystemBack` and the splash screen's `onComplete` will re-route the rider to the dashboard on resume if the cached state is fresh, but if the cached state is also stale (e.g., the rider was killed and the JWT expired during the kill window), the splash restores to the last `AuthState` from `voltium_saved_auth_state` (`router_body.dart:50-95`) and the screen fetches data that 401s. The rider sees a generic "Pull to retry" with no path forward.
- The `hang_tight_screen` comment at lines 52-59 calls this exact problem out: "a rider who lost their session mid-onboarding resumes at the right step (the cached rider is dropped, the next login reads the live rider from the server)." That recovery path only works for `hangTight`. The same problem exists on `userForm`, `guarantorForm`, `pickupHub`, `topUpAmount`, `topUpProof`, etc.

**Recommended fix:**
1. Push the 401 detection into `RiderNotifier._doRefreshFromApi`: catch `ApiException`, inspect `statusCode`, and if 401, set a new state field `sessionExpired: true` (or call a router-level callback).
2. The router's `didChangeDependencies` (line 421-495) already watches `riderProvider`. Add a branch for `sessionExpired == true` that runs the same `logout()` + `clearPickupDraft()` + `_navigateToLocal(AuthState.login)` chain that `hang_tight_screen` uses (and that the account-closed `Logout` button uses at `router_body.dart:677-693`).
3. Same fix for `WalletNotifier._doRefreshTransactions` at `wallet_provider.dart:165-196`.

---

## 3. High bugs (P1)

### P1-1 — `user_onboarding_screen.dart` `dispose()` removes the wrong listener (memory leak + use-after-dispose)

**File:** `D:\voltium\flutter\lib\features\kyc\presentation\screens\user_onboarding_screen.dart:229-298`
**Severity:** P1 (memory leak; the closure holds a reference to the State, preventing GC, and after dispose the closure still runs `if (mounted) setState(() {})` which is a setState-after-dispose assertion in debug builds)

**Description:**
In `initState` the screen creates a closure `onFieldChanged` and registers it on every controller:

```dart
// user_onboarding_screen.dart:229-242
void onFieldChanged() {
  _saveCache();
  if (mounted) setState(() {});
}

_nameController.addListener(onFieldChanged);
_emailController.addListener(onFieldChanged);
_addressController.addListener(onFieldChanged);
_dobController.addListener(onFieldChanged);
_fatherNameController.addListener(onFieldChanged);
_motherNameController.addListener(onFieldChanged);
_bankNameController.addListener(onFieldChanged);
_bankAccountController.addListener(onFieldChanged);
_bankIfscController.addListener(onFieldChanged);
```

But in `dispose`, the wrong function is removed:

```dart
// user_onboarding_screen.dart:277-298
void dispose() {
  _nameController.removeListener(_saveCache);     // ← removes _saveCache (not onFieldChanged)
  _emailController.removeListener(_saveCache);
  _addressController.removeListener(_saveCache);
  _dobController.removeListener(_saveCache);
  _fatherNameController.removeListener(_saveCache);
  _motherNameController.removeListener(_saveCache);
  _bankNameController.removeListener(_saveCache);
  _bankAccountController.removeListener(_saveCache);
  _bankIfscController.removeListener(_saveCache);
  // ... then dispose the controllers
  _nameController.dispose();
  ...
}
```

`_saveCache` is a *different* function (defined at line 180-201, no `setState`). The `onFieldChanged` closure is never removed. The controllers' `removeListener` calls are no-ops because the function reference doesn't match any registered listener.

**Why it matters:**
- After `dispose`, the controllers still hold a reference to the `onFieldChanged` closure, which holds a reference to `this` (the State).
- If the user is mid-typing when the screen is disposed (e.g., on rapid forward navigation after `_handleNext` succeeds, which is line 612-614 calling `widget.onNext?.call()`), the listener fires and calls `if (mounted) setState(() {})` on a disposed State. In debug mode this is a Flutter framework assertion ("setState() called after dispose()"). In release it's a silent no-op but the State is leaked until the controller is GC'd.
- The user-facing impact: a rider who quickly taps "Continue" at the end of KYC step 3 has a small but real chance of triggering the assertion if a text-change event is in flight.

**Recommended fix:**
In `dispose`, remove the closure that was actually added:
```dart
_nameController.removeListener(onFieldChanged);
_emailController.removeListener(onFieldChanged);
...
```

---

### P1-2 — Top-up proof `_submit()` has no double-tap guard

**File:** `D:\voltium\flutter\lib\features\wallet\presentation\screens\top_up_proof_screen.dart:333-348`
**Severity:** P1 (rapid double-tap can fire two `onSubmit` calls; the second may navigate to the wrong screen or create a duplicate navigation)

**Description:**
```dart
// top_up_proof_screen.dart:333-348
Future<void> _submit() async {
  setState(() => _isUploading = true);
  // ... compute methodStr, refVal, fileToSubmit ...
  await widget.onSubmit?.call(fileToSubmit, methodStr, refVal);
  if (mounted) setState(() => _isUploading = false);
}
```

There is no `if (_isUploading) return;` at the top. The `setState` is synchronous, so `_isUploading` is `true` after the first call returns, but until the `await` completes, no rebuild has happened. A second tap during the await is not blocked by the visual `canSubmit` (line 824) check, because the build hasn't run yet.

**Why it matters:**
- For the dashboard top-up flow, the `onSubmit` callback is at `top_up_flow.dart:98-158` — it calls `wProvider.topUpWallet` (which has the `Idempotency-Key` header per the API client at `api_client.dart:486-518`, line 518 generates `_newCorrelationId()`). The server's 5-min idempotency bucket may catch the duplicate, but a rider who double-taps during a slow network and the second tap lands after the first completes will create two `Transaction` rows.
- For the active onboarding flow, the `onSubmit` is the P0-1 no-op — but if P0-1 is fixed to call `topUpWallet`, the same double-tap risk applies.
- The `OtpVerifyButton` and other buttons in the codebase have explicit `if (X) return;` guards at the top of their async methods; the proof screen is the outlier.

**Recommended fix:**
Add at the top of `_submit`:
```dart
if (_isUploading) return;
```

---

### P1-3 — OTP verify handler lacks double-tap guard

**File:** `D:\voltium\flutter\lib\features\auth\presentation\screens\otp_verification_screen.dart:169-171`
**Severity:** P1 (rapid double-tap of the Verify button or auto-verify on completion can fire two `verifyOtp` calls)

**Description:**
```dart
// otp_verification_screen.dart:169-171
Future<void> _handleVerify() async {
  final code = _readOtpValue();
  if (code.length != 6) return;

  setState(() => _isLoading = true);
  try {
    // ... verifyOtp call ...
```

The `if (code.length != 6) return;` is the only early-return. The completion callback on the OTP input (line 427) auto-calls `_handleVerify()`. The button's `onPressed` (line 272) also calls it. Both paths converge on the same method without a re-entry guard.

**Why it matters:**
- Auto-complete fires when the 6th digit is entered. The verify button is enabled at the same time (`canVerify: _isOtpComplete` at line 270). A user who holds the 6th key down longer than the auto-verify latency could trigger two calls.
- The downstream `verifyOtp` is idempotent server-side (the OTP is single-use), so the second call will return an error, but the rider will see a confusing "Invalid OTP" error after a successful auto-verify.

**Recommended fix:**
Add `if (_isLoading) return;` at the top of `_handleVerify`.

---

### P1-4 — `intent_of_use_screen` `setState` race between submit and navigate

**File:** `D:\voltium\flutter\lib\features\kyc\presentation\screens\intent_of_use_screen.dart:192-217`
**Severity:** P1 (the user can re-tap "Confirm Selection" in the brief window between the `finally` reset and the `widget.onNext?.call()`)

**Description:**
```dart
// intent_of_use_screen.dart:192-217
setState(() => _isSubmitting = true);
try {
  await VoltiumApiClient(ApiClient()).putRiderProfile(...);
  await provider.refresh();
  PostHogService.capture('intent_of_use_submitted', ...);
} catch (_) {
  // snackbar
  return;
} finally {
  if (mounted) {
    setState(() => _isSubmitting = false);   // ← button re-enables here
  }
}
if (!mounted) return;
widget.onNext?.call();                        // ← navigate
```

After `await provider.refresh()` succeeds, the `finally` block runs, resetting `_isSubmitting = false` **before** `widget.onNext?.call()`. The button is briefly re-enabled (the framework hasn't navigated yet), and the user can tap it again to start a second `putRiderProfile` call.

**Why it matters:**
- The first call is already committed; the second is a redundant `PUT` that, on a slow network, can race with the navigate.
- The PostHog `intent_of_use_submitted` event fires twice (once per real submit), polluting analytics.
- Less serious than P1-1 / P1-2 because the rider is being navigated away immediately after; the window is microseconds in practice. But the test for "can the rider double-tap" is the same.

**Recommended fix:**
Reorder so the navigate happens before the `finally`:
```dart
setState(() => _isSubmitting = true);
try {
  await VoltiumApiClient(...).putRiderProfile(...);
  await provider.refresh();
  PostHogService.capture('intent_of_use_submitted', ...);
  if (!mounted) return;
  widget.onNext?.call();
} catch (_) {
  if (mounted) messenger.showSnackBar(...);
  return;
} finally {
  if (mounted) setState(() => _isSubmitting = false);
}
```

---

### P1-5 — Phone field: dead `.copyWith(color: ...)` followed by a second `.copyWith(color: ...)`

**File:** `D:\voltium\flutter\lib\features\auth\presentation\widgets\phone_entry_widget.dart:313-316`
**Severity:** P1 (a real bug: the hint color is `onSurfaceDisabled`, not `onSurfaceMuted` as the visual intent suggests; the first copyWith is dead code)

**Description:**
```dart
// phone_entry_widget.dart:313-316
hintStyle: AppTypography.bodyMedium
    .copyWith(color: AppColors.onSurfaceMuted)
    .copyWith(color: AppColors.onSurfaceDisabled),
```

The first `.copyWith(color: AppColors.onSurfaceMuted)` is overwritten by the second `.copyWith(color: AppColors.onSurfaceDisabled)`. The intent appears to have been a two-color hint (different for empty vs. filled), but the implementation collapses to a single color.

**Why it matters:**
- This is in the same file that ships the "belt-and-suspenders" IME workaround (line 78-86). It's a sign the file is being touched by multiple people without review. A code reviewer would catch this; a physical tester would see a wrong color.
- Future maintainers will read `onSurfaceMuted` and assume it's the active color, leading to more wrong-color edits.

**Recommended fix:**
Delete the first `.copyWith(color: AppColors.onSurfaceMuted)`. Or, if two-tone was the intent, use a separate `TextStyle` for the filled state via `suffixStyle` or input decoration theme overrides.

---

### P1-6 — `OtpGrid` (pickup) has no `onCompleted` callback; parent must always tap "Verify"

**File:** `D:\voltium\flutter\lib\features\pickup\widgets\pickup_hub_widgets.dart:331-396`
**Severity:** P1 (small UX bug; the rider has to tap "Verify OTP" instead of auto-verifying on the 6th digit like the auth OTP does)

**Description:**
The widget exposes only `controller` and `onChanged` (a no-op here). The parent calls `_verifyEmergencyOtp` only on button press (`pickup_hub_screen.dart:960-961`).

**Why it matters:**
- The auth OTP (`UnderlineOtpInput` and `SparkOtpInput`) has an `onCompleted` callback. The pickup OTP does not.
- The rider's mental model is "type 6 digits, done." The extra tap is friction and a small abandonment risk on the pickup step (which is the last step before `hangTight`).

**Recommended fix:**
Add `final ValueChanged<String>? onCompleted;` and call it when `controller.text.length == 6`. The `UnderlineOtpInput` has the exact pattern at `underline_otp_input.dart:121-123`.

---

### P1-7 — `TopUpAmountScreen` has unused `onAmountChanged` callback wired to dead code

**File:** `D:\voltium\flutter\lib\features\wallet\presentation\screens\top_up_amount_screen.dart:15, 82-88` and `D:\voltium\flutter\lib\app\router_body.dart:324-343`
**Severity:** P1 (the amount is not propagated through the callback; the router reads it via the `_customAmountCtrl`'s listener closure on the screen — the result is a hidden coupling)

**Description:**
`TopUpAmountScreen` declares `onAmountChanged` (line 15) and registers a listener (line 82-88) that calls the callback if the parent provides one. The router does **not** provide `onAmountChanged` (router_body.dart:324-343 shows only `securityDeposit`, `rentalPrice`, `onBack`, `onProceed`). The amount is only persisted in `state._topUpAmount` when the user taps "Proceed" (router_body.dart:339: `state._topUpAmount = amount;`).

But `topUpAmount` re-routes the user back here if the user navigates back from `topUpProof` (router.dart:725-732: `_navigateToLocal(_isOnboarding ? AuthState.choosePlan : AuthState.dashboard)`). The screen re-reads `state._topUpAmount` only via the constructor's `securityDeposit` / `rentalPrice` arguments, which are derived from the rider's plan — not from the previous `_topUpAmount`.

**Why it matters:**
- The `onAmountChanged` callback is **dead code** in the active path (and in the dashboard top-up via `TopUpFlow` it's not used either; `top_up_flow.dart:75-92` wires only `onProceed`).
- The screen's initial value is `planTotal > 0 ? planTotal : 1000` (line 61), not the previously-entered amount. If the rider went to proof, came back, the amount is reset to the plan default.
- This is the exact "flow state in the router" smell the user prompt called out. `_topUpAmount` in `router.dart:115` is the only durable store.

**Recommended fix:**
1. Either thread `initialAmount: state._topUpAmount` through the router's `TopUpAmountScreen` constructor (the widget already supports `initialAmount` per line 18).
2. Or remove the `_topUpAmount` from the router and have the amount live in a Riverpod provider scoped to the top-up flow. (Better, but a larger refactor.)

---

### P1-8 — `login_screen` `_handleLogin` swallows `provider.refresh()` failure on `Intent` step

**File:** `D:\voltium\flutter\lib\features\kyc\presentation\screens\intent_of_use_screen.dart:194-202` (already noted in P1-4) plus `login_screen.dart:127-141`
**Severity:** P1 (the rider sees a generic "Network error" instead of a specific reason)

**Description:**
```dart
// login_screen.dart:127-141
} catch (e) {
  appDebug('[LoginScreen] Error in sendOtp: $e');
  PostHogService.captureError(e, null, reason: 'otp_request_failed');
  if (mounted) {
    String errorMsg = 'Network error. Please try again.';
    if (e is ApiException) {
      errorMsg = e.message;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(errorMsg),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
```

If `e is ApiException && e.statusCode == 429` (rate-limited), the rider sees the generic 429 message which may not be actionable. If `e.statusCode == 401`, the rider is told the auth failed but their session is fresh — confusing.

**Why it matters:**
- The OTP flow is the entry point. A rider who hits a 429 from a network blip (common in metro stations per the pickup comments) will see the wrong error.
- The OTP screen has the same pattern at line 208-222: same generic message.

**Recommended fix:**
Add per-status code branching like `pickup_hub_screen.dart:293-298` (which does `if (e is ApiException && e.statusCode! < 500)` for retry logic).

---

### P1-9 — `documents_screen` is not reachable from the active onboarding path

**File:** `D:\voltium\flutter\lib\features\kyc\presentation\screens\documents_screen.dart` (full file) and `D:\voltium\flutter\lib\app\app_state.dart:42-44`
**Severity:** P1 (the `AuthState.myDocuments` is for the post-onboarding profile screen; documents are uploaded inline on the `userForm` step. The active path skips the standalone `documents_screen` entirely.)

**Description:**
The active path is `userForm (kyc) → intentOfUse → ... → guarantorForm → ...` — the `userForm` is `user_onboarding_screen.dart` (line 156-165), which embeds the document upload in steps 2 and 3 (`IdentityVerificationCard`, `SelfieCard`, `SignatureCard`). The standalone `documents_screen.dart` is not in the active path. The `AuthState.myDocuments` enum value exists but is only reachable from the dashboard's "My Documents" entry point.

**Why it matters:**
- If the rider needs to re-upload a single document after a KYC rejection, the rejection path goes back to the `userForm` step (the audit notes the `kycEditableFields` mechanism at line 721-729). That's correct.
- But the existence of `documents_screen.dart` (19.6 KB) suggests it was the original path and `userForm` is a consolidation. The two surfaces may have diverged. A rider who finds a bug in `documents_screen` and one in `userForm`'s document card may report two different bugs.
- This is more design-smell than user-facing bug. The audit prompt asks about it ("Lifecycle gate bypasses — can a rider reach `dashboard` without completing onboarding?"), so flagging it.

**Recommended fix:**
Verify the `documents_screen` is reachable only from the dashboard's "My Documents" (which is fine). If it's dead, archive it to `legacy/`.

---

### P1-10 — `login_screen` `_handleLogin` early-return doesn't check `mounted` for snackbar

**File:** `D:\voltium\flutter\lib\features\auth\presentation\screens\login_screen.dart:127-141` (already noted in P1-8)
**Severity:** P1 — the `if (mounted)` guard is there; the issue is the `ScaffoldMessenger.of(context)` is called inside the `if (mounted)` but the `mounted` check is for the **State**, not the `BuildContext`. The context may still be active even when the State is disposed (rare but possible during rapid navigation).

**Why it matters:**
- Less serious than it looks; the `mounted` check covers the common case.

**Recommended fix:**
Replace `if (mounted)` with `if (mounted && context.mounted)`.

---

### P1-11 — `OtpResendWidget` and `OtpVerifyButton` re-render on every OTP digit

**File:** `D:\voltium\flutter\lib\features\auth\presentation\screens\otp_verification_screen.dart:163-167` and the widget at `D:\voltium\flutter\lib\features\auth\presentation\widgets\otp_verify_button.dart` (referenced in import)
**Severity:** P1 (minor performance / battery — every keystroke triggers a full screen rebuild)

**Description:**
`_onOtpChanged` calls `setState(() => _isOtpComplete = value.length == 6;)` on every digit. The screen contains the entire OTP widget tree, the bouncing icon, the ambient glow, and the bottom button. The `RepaintBoundary` on the bouncing icon (line 340) is the only isolation.

**Why it matters:**
- The `UnderlineOtpInput` already calls `setState(() {})` on every digit (line 125 of `underline_otp_input.dart`). Combined with the parent's `_onOtpChanged`, the screen rebuilds 2× per keystroke.
- The `_isOtpComplete` boolean is the only thing that needs to update. Everything else (the ambient glow, the bouncing icon) re-runs.

**Recommended fix:**
Use a `ValueListenableBuilder` over the OTP controller's `TextEditingValue` for `_isOtpComplete`, and only `setState` when the boolean actually flips.

---

## 4. Medium bugs (P2)

### P2-1 — Splash screen has a hard-coded `voltium_saved_auth_state` `splash` exclusion

**File:** `D:\voltium\flutter\lib\app\router_body.dart:50-95` (splash case) — `savedStateStr` restore
**Severity:** P2 (if a rider is killed while the splash is showing and the cached state is `splash`, the splash re-runs, but the cached rider + permissions check still happens. The `cacheIsStale` check at line 47-49 covers `pickupDone` drift but not lifecycle rank drift.)

**Description:**
The splash restore path (line 50-95) checks `cachedPickupDone != livePickupDone` and `liveRider == null` and `isStaleLifecycle` (SUSPENDED or TERMINATED). It does **not** check that the cached rank matches the live rank. A rider whose rank advanced (e.g., admin moved them from `KYC_SUBMITTED` to `KYC_APPROVED` while the app was killed) will be restored to the old state, and the lifecycle gate in `didChangeDependencies` will re-route within a frame.

**Why it matters:**
- The re-route is fast (< 16 ms) and the rider sees a flash of the wrong surface. The team has accepted this in earlier comments (the splash comment at line 109-111 says "didChangeDependencies would re-route within a frame"). So this is a documented P2.

**Recommended fix:**
Compare `riderRank(cached)` vs `riderRank(live)` and discard the cached state if they differ by more than 1 (allow small advances to avoid losing the rider's exact position).

---

### P2-2 — `phone_entry_widget.dart` IME workaround is fragile

**File:** `D:\voltium\flutter\lib\features\auth\presentation\widgets\phone_entry_widget.dart:78-86`
**Severity:** P2 (the `TextInput.show()` after 300 ms is a code smell, not a bug — but the `mounted` check on line 80 is not enough; the `BuildContext` may also be invalid)

**Description:**
```dart
// phone_entry_widget.dart:78-86
if (widget.autoFocus) {
  Future.delayed(const Duration(milliseconds: 300), () {
    if (mounted) {
      SystemChannels.textInput.invokeMethod('TextInput.show');
    }
  });
}
```

The comment says it's "belt-and-suspenders" for a known device issue. The 300 ms is hard-coded and may not be enough on slower devices.

**Why it matters:**
- If the `BuildContext` is deactivated before the timer fires, the method channel call is harmless but the IME never shows.
- The fix that actually worked (per the comment) was to remove the custom `focusNode` (line 196-200), not to add the timer. The timer is now redundant.

**Recommended fix:**
Delete the timer; the `autofocus: true` on the field is sufficient.

---

### P2-3 — The `_computeIsOnboarding` heuristic reads the rider every navigation

**File:** `D:\voltium\flutter\lib\app\router.dart:516-550`
**Severity:** P2 (every navigation re-evaluates `ref.read(riderProvider).rider`; the cost is small but the function is called from `didChangeDependencies` which runs frequently)

**Description:**
```dart
// router.dart:539-549
final target = RiderLifecycleGate.redirect(rider);
return target != LifecycleTarget.dashboard &&
    target != LifecycleTarget.terminated &&
    target != LifecycleTarget.suspended;
```

This duplicates the gate's logic. The lifecycle gate already returns the `LifecycleTarget`; the router could just check `target.isOnboarding` (the helper exists on `RiderLifecycleGate` at line 244-256) instead of re-implementing the comparison.

**Why it matters:**
- Two sources of truth for "is this rider onboarding?". If a new `LifecycleTarget` is added (e.g., `pickupDraft`), the router's comparison must be updated too.

**Recommended fix:**
Replace with `RiderLifecycleGate.isOnboarding(rider)`.

---

### P2-4 — Pickup draft persists on logout only if logout is called via accountClosed button

**File:** `D:\voltium\flutter\lib\app\router_body.dart:677-693` (account-closed Logout button) and `D:\voltium\flutter\lib\app\router.dart:481-494` (rider null branch)
**Severity:** P2 (the rider null branch in `didChangeDependencies` at line 486 does call `clearPickupDraft()`, but only for the case where the rider is null. If the rider is not null but their `pickupDone` is true, the draft is also cleared at line 435-439. The gap is: a rider who logs out via a different path, e.g., the dashboard's "Log out" button, may not have their draft cleared.)

**Description:**
The account-closed `Logout` button at `router_body.dart:677-693` calls `state.clearPickupDraft()`. The rider-null branch at `router.dart:481-494` also calls `clearPickupDraft()`. But other logout paths (the dashboard's account menu) may not.

**Why it matters:**
- The cleanup is correct for the paths audited (account-closed, splash). For other paths, the draft may linger in SharedPreferences.

**Recommended fix:**
Audit the dashboard's logout button to confirm it also calls `clearPickupDraft()`.

---

### P2-5 — `OtpResendWidget` countdown is reset to 30 unconditionally on resend success

**File:** `D:\voltium\flutter\lib\features\auth\presentation\screens\otp_verification_screen.dart:228-262`
**Severity:** P2 (the rider who just resends gets a fresh 30s timer; this is correct for most cases. The edge case is a rider who entered a wrong OTP and is now being rate-limited — they have to wait 30s before resending. The rate limit window is server-side; the client and server may disagree.)

**Why it matters:**
- If the server returns a 429 on a 5th resend in 5 minutes, the client doesn't show that — it just shows the API error message and the rider can try again.

**Recommended fix:**
Inspect the response for a `retryAfter` field and use that for the countdown.

---

### P2-6 — `OtpResendWidget` countdown is stateful per-screen; the screen is rebuilt when returning from background

**File:** `D:\voltium\flutter\lib\features\auth\presentation\screens\otp_verification_screen.dart:148-161`
**Severity:** P2 (the `Timer.periodic` pauses when the app is backgrounded, but the screen's `_resendCountdown` doesn't update on resume. The rider returns to the screen and sees a stale countdown that resumes counting from the saved value.)

**Description:**
```dart
// otp_verification_screen.dart:148-161
void _startCountdown() {
  if (AppConstants.isTestMode) {
    setState(() => _resendCountdown = 0);
    return;
  }
  _countdownTimer?.cancel();
  _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
    if (!mounted || _resendCountdown <= 0) {
      timer.cancel();
      return;
    }
    setState(() => _resendCountdown--);
  });
}
```

No `didChangeAppLifecycleState` override to recompute the countdown based on the wall clock on resume.

**Why it matters:**
- If the rider backgrounds the app for 25 s during the 30 s countdown and returns, they see "5" instead of the actual 5 s remaining. The 25 s is lost. They wait 5 s and can resend, but the server may have already invalidated the OTP at 30 s wall clock, leading to a confusing 401 on the resend.

**Recommended fix:**
Use `DateTime.now().difference(_resendStartedAt)` to compute the actual remaining time on `resumed`.

---

### P2-7 — `documents_screen` and `myDocuments` are both reachable from different paths; visual divergence

**File:** `D:\voltium\flutter\lib\features\kyc\presentation\screens\documents_screen.dart` (full file) and the `AuthState.myDocuments` route at `D:\voltium\flutter\lib\app\app_state.dart:44`
**Severity:** P2 (already noted in P1-9; expanded here for the design-smell angle)

**Description:**
Two surfaces for documents:
- `documents_screen.dart` (19.6 KB) — standalone, not in the active path. Reachable from the dashboard's "My Documents".
- `IdentityVerificationCard` + `SelfieCard` + `SignatureCard` embedded in `userForm` (steps 2 and 3) — active path.

**Why it matters:**
- The two surfaces have different UIs and likely different validation (e.g., the dashboard's "My Documents" may allow replacing a single doc; the `userForm` step only allows uploading). A rider in mid-rejection who needs to re-upload one document may end up on the wrong surface.

**Recommended fix:**
Verify the surfaces converge. If not, consolidate.

---

### P2-8 — `_handleNext` in `user_onboarding_screen` swallows `provider.refresh()` failure

**File:** `D:\voltium\flutter\lib\features\kyc\presentation\screens\user_onboarding_screen.dart:585-635`
**Severity:** P2 (a refresh failure is silently swallowed; the rider is navigated forward to `guarantorForm` with stale state)

**Description:**
```dart
// user_onboarding_screen.dart:585-635
try {
  // ... upload + updateProfile ...
  await KycRepository.clearFormCache(riderId: riderId);
  await ref.read(riderProvider.notifier).refresh();    // ← failure swallowed
  PostHogService.capture('kyc_submitted', ...);
  if (mounted) {
    widget.onNext?.call();                             // ← navigates forward
  }
} catch (e) {
  if (mounted) {
    String userMessage = 'Something went wrong. Please try again.';
    // ...
    _showError(userMessage);
  }
} finally {
  ref.read(userOnboardingNotifierProvider.notifier).setUploading(false);
}
```

`refresh()` is called inside the `try`, so a failure does throw and is caught by the same `catch` block. But the rider has no idea whether the failure was the upload, the update, or the refresh. The error message is the same.

**Why it matters:**
- A rider whose network drops between the profile save and the refresh would see "Something went wrong" and have to re-enter the whole form. But the form data was already saved server-side; the rider is in limbo.

**Recommended fix:**
Catch and distinguish: `try { ... } on KycUploadException catch (...) { ... } on RefreshException catch (...) { ... }`.

---

### P2-9 — `_canProceedCurrentStep` reads controllers via getters, not `ref.watch`

**File:** `D:\voltium\flutter\lib\features\kyc\presentation\screens\user_onboarding_screen.dart:695-719`
**Severity:** P2 (the getter reads `_nameController.text` directly; Riverpod's `build` is called by `ref.watch(userOnboardingNotifierProvider)` at line 734, but the text-controller reads are not in a watcher context, so the UI doesn't rebuild when the text changes)

**Description:**
```dart
// user_onboarding_screen.dart:695-719
bool get _canProceedCurrentStep {
  if (AppConstants.isTestMode) return true;
  final state = ref.read(userOnboardingNotifierProvider);
  switch (state.currentStep) {
    case 1:
      return _nameController.text.isNotEmpty &&
          _dobController.text.isNotEmpty &&
          _addressController.text.isNotEmpty;
```

The `_nameController.text` is read inside a getter called from `build()`. The build is triggered when the notifier changes (line 734 watches the notifier). The text controllers are not watched, so the getter returns stale values until something else triggers a rebuild.

**Why it matters:**
- There is a workaround: the `onFieldChanged` closure (line 229-232) calls `setState(() {})` on every text change. So in practice, the UI does rebuild. But this is fragile — a maintainer who removes the `setState(() {})` call to "optimize" would break the UI silently.

**Recommended fix:**
Add `ref.listen` or `ref.watch` over the controllers' notifier.

---

### P2-10 — `pickup_hub_screen` `_applyInitialDraft` may overwrite newer choices on resume-refresh

**File:** `D:\voltium\flutter\lib\features\pickup\presentation\screens\pickup_hub_screen.dart:243-256` plus the `_initialDraftApplied` guard at line 153
**Severity:** P2 (the guard exists; the edge case is when the user navigates away and back within the same screen instance)

**Description:**
```dart
// pickup_hub_screen.dart:251-256
@override
void didChangeAppLifecycleState(AppLifecycleState state) {
  if (state == AppLifecycleState.resumed) {
    _fetchHubs();
  }
}
```

`_fetchHubs` calls `_applyInitialDraft` (line 280) which re-applies the persisted draft via the `_initialDraftApplied` guard (line 153). The guard prevents re-application within a single screen instance. But if the user backs out of `pickupHub` and re-enters (via the router back stack), a new `_PickupHubScreenState` is created and the guard resets. The draft is re-applied even if the user has since changed their selections.

**Why it matters:**
- Unlikely in practice (the back stack from `pickupHub` goes to `topUpProof`, not forward). But the state machine has the gap.

**Recommended fix:**
Document the behavior or invalidate the draft on `onNext` to `pickupVerification`.

---

### P2-11 — `_isOnboarding` flag uses `ref.read` inside a Router method

**File:** `D:\voltium\flutter\lib\app\router.dart:516-550`
**Severity:** P2 (the `ref.read` in a synchronous function is OK but the value is not a Riverpod-driven state; it's a derived value computed every navigation. If the rider is mid-`_isOnboarding = true` and the lifecycle re-routes, the flag is stale.)

**Description:**
The flag is recomputed in `_navigateToLocal` and `didChangeDependencies` (the two entry points). If a third entry point is added (e.g., a deep link), the flag would be stale.

**Why it matters:**
- Already mentioned as a design smell in the user prompt. No immediate bug.

**Recommended fix:**
Move `_isOnboarding` into a Riverpod provider.

---

### P2-12 — `splash_screen` `_startSequence` returns `widget.onComplete` from inside an `await`

**File:** `D:\voltium\flutter\lib\features\onboarding\presentation\screens\splash_screen.dart:97-123`
**Severity:** P2 (the `if (mounted) widget.onComplete();` checks are there; the issue is the 300 ms early-return for returning riders — if the cached session is invalid, the rider is sent through the full 2 s sequence before the error appears)

**Description:**
```dart
// splash_screen.dart:97-101
if (hasSession) {
  await Future.delayed(const Duration(milliseconds: 300));
  if (mounted) widget.onComplete();
  return;
}
```

A returning rider with a stale JWT is sent through this fast path, then `widget.onComplete` calls `_navigateToLocal` to a `preDashboard`-ish state, which immediately calls `refreshFromApi`, which 401s (per P0-4). The rider sees the splash for 300 ms, then a flash of an empty screen, then a "Pull to retry" error.

**Why it matters:**
- 300 ms is too short to be useful. The full 2 s sequence is too long. The middle ground (1 s) is missing.

**Recommended fix:**
Either drop the 300 ms fast path (let every rider see the full sequence) or add a 401 check before navigating.

---

### P2-13 — `AuthState` enum has 28 values; the router switches on all 28. Adding a new state requires editing 4 files.

**File:** `D:\voltium\flutter\lib\app\app_state.dart` (the enum) and the router's switch statements
**Severity:** P2 (no immediate bug, but the `D-P1-4` audit comment at the top of `auth_state_group.dart` calls out the maintenance burden)

**Description:**
Adding a new `AuthState` value requires:
- Adding to the enum (`app_state.dart`)
- Adding a case to `router.dart:_lifecycleTargetToAuthState` (or the switch in `router_body.dart`)
- Adding to `router.dart:_canPop`
- Adding to `router.dart:_handleSystemBack`
- Adding to `auth_state_group.dart:isPreDashboardOrSub` (if it's a sub-screen)
- Adding to `auth_state_group.dart:isUnauthenticatedGate` (if it's a pre-auth state)

**Why it matters:**
- 5+ files to touch, easy to miss one. A missed case is a runtime crash (the switch falls through to `default` which renders `AppShell`).

**Recommended fix:**
Use sealed classes (per the existing `OnboardingStep` / `Onboarding` pattern) or a `Map<AuthState, WidgetBuilder>`.

---

### P2-14 — `onboarding-flow-redesign.html` and `onboarding-flow-mockup.html` are workspace clutter

**File:** `D:\voltium\onboarding-flow-redesign.html` and `D:\voltium\onboarding-flow-mockup.html`
**Severity:** P2 (these are mockup artifacts at the workspace root; they should be in `docs/design/` or `docs/mockups/` if they need to be kept)

**Description:**
Two HTML files at the workspace root, 2 MB and 1.2 MB respectively. Not referenced from any code.

**Why it matters:**
- The user is a "physical tester with a device" who "drives the project from the user side". Mockups are useful for the user-facing team, but the location makes them easy to miss.

**Recommended fix:**
Move to `docs/design/onboarding/` or `.deprecated/`.

---

## 5. Low / observations (P3)

### P3-1 — `try { ... } catch (_) {}` empty catches in `posthog_service.dart`

**File:** `D:\voltium\flutter\lib\core\observability\posthog_service.dart:38, 51, 61, 67, 82`
**Severity:** P3 (PostHog is best-effort observability; empty catches are intentional, but the lack of any logging on failure is unusual)

**Description:**
```dart
} catch (_) {}
} catch (_) {}
} catch (_) {}
} catch (_) {}
```

Four empty catches in one file. The service is observability, so the failure is non-critical. But if PostHog is silently failing because of a config issue, no one will know.

**Recommended fix:**
Add `appDebug('PostHog.capture failed: $e')` in at least the `capture` method.

---

### P3-2 — `rider_logout_orchestrator.dart` has two empty catches

**File:** `D:\voltium\flutter\lib\core\state\rider_logout_orchestrator.dart:128, 137`
**Severity:** P3 (logout is best-effort, but a partial logout that leaves the rider in an inconsistent state is a known data-leak risk. The orchestrator is new (per `D-P0-3` audit comment) and may not have the correct error paths yet.)

**Description:**
The orchestrator wraps `authRepository.logout()` and per-feature reset. Empty catches mean a failed logout can leave the rider with a stale local state.

**Why it matters:**
- Cross-account leak guards are the orchestrator's reason to exist. A partial failure is worse than no orchestrator.

**Recommended fix:**
Add at least `appDebug` for each catch.

---

### P3-3 — `splash_screen.dart` line 107 has `} catch (_) {}` in a `Future.microtask`

**File:** `D:\voltium\flutter\lib\features\onboarding\presentation\screens\splash_screen.dart:104-108`
**Severity:** P3 (the comment says "Hydrate background caches" but the body is empty — dead code)

**Description:**
```dart
Future.microtask(() {
  try {
    // Hydrate background caches
  } catch (_) {}
});
```

**Recommended fix:**
Delete the entire `Future.microtask` block; it does nothing.

---

### P3-4 — `router.dart` line 359 has `} catch (_) { ... }` around `init` calls in postFrame

**File:** `D:\voltium\flutter\lib\app\router.dart:350-360`
**Severity:** P3 (the comment says "Ignored if element tree is deactivated during test frame rebuilds" — this is the pattern, but the catch swallows anything that goes wrong during init, including programming errors)

**Description:**
```dart
try {
  ref.read(riderProvider.notifier).init();
  ref.read(supportProvider.notifier).initSupportData();
  ref.read(engagementProvider.notifier).initEngagementData();
  ref.read(devicePolicyProvider.notifier).checkSystemPermissions();
} catch (_) {
  // Ignored if element tree is deactivated during test frame rebuilds
}
```

**Recommended fix:**
Log the error with `appDebug` and rethrow if `kDebugMode` and not in test mode.

---

### P3-5 — `router_body.dart` line 667, 682 have `catch (_)` around `launchUrl` and `logout()`

**File:** `D:\voltium\flutter\lib\app\router_body.dart:663-693`
**Severity:** P3 (the `support` button silently failing on `mailto:` is fine; the `logout` silently failing is risky)

**Description:**
The account-closed `Logout` button's `catch (_)` block at line 681-685 then runs `clearPickupDraft()` and `CacheService().remove('voltium_saved_auth_state')` and `_navigateToLocal(AuthState.login)`. If the rider's network is down, the server-side logout is skipped but the local state is wiped. A rider with a weak network who taps Logout is now "logged out" locally but still has a valid JWT server-side. If they log in again, the server sees a "new" login and may not invalidate the previous session.

**Recommended fix:**
Show a "Logout failed, please try again" snackbar and don't proceed.

---

### P3-6 — `flutter/lib/core/localization/locale_provider.dart:137` has empty catch

**File:** `D:\voltium\flutter\lib\core\localization\locale_provider.dart:137`
**Severity:** P3 (locale persistence failure is non-critical; empty catch is acceptable)

---

### P3-7 — `flutter/lib/features/onboarding/presentation/screens/legal_screen.dart:93, 123` have empty catches

**Severity:** P3 (legal screen caches acceptance; failure to read is best-effort)

---

### P3-8 — Multiple `.copyWith(color: ...)` chains across screens

**File:** Multiple (e.g., `flutter/lib/features/kyc/presentation/widgets/doc_tile.dart:65-67`, `selfie_card.dart:42-44`, `signature_card.dart:23-25`)
**Severity:** P3 (the pattern is widespread; same dead-code risk as P1-5 but cosmetic)

**Description:**
```dart
// doc_tile.dart:65-67
child: Opacity(
  opacity: enabled ? 1.0 : 0.5,
  child: content,
),
```

This is the "disabled state" pattern repeated in 3+ files. A central `AppDisabled` widget or a theme-driven opacity would reduce duplication.

**Recommended fix:**
Centralize the disabled-state pattern.

---

### P3-9 — `_handleSystemBack` is a long switch statement

**File:** `D:\voltium\flutter\lib\app\router.dart:693-760`
**Severity:** P3 (already noted in P2-13; the back-handling logic could be a `Map<AuthState, AuthState>` for clarity)

---

### P3-10 — `documents_screen.dart` and `user_onboarding_screen.dart` have overlapping form-cache logic

**File:** `D:\voltium\flutter\lib\features\kyc\data\kyc_repository.dart` and the `_saveCache` / `_loadCache` at `user_onboarding_screen.dart:180-222`
**Severity:** P3 (two surfaces caching KYC form data in different shapes; consolidation is a refactor, not a bug)

---

### P3-11 — `flutter/lib/utils/date_utils.dart:75, 82` have empty catches

**Severity:** P3 (date parsing fallback to a default is intentional; empty catch is fine but should be commented)

---

## 6. Open questions

Things I could not determine from code alone:

1. **Does the `topUpAmount` screen's `onAmountChanged` callback fire anywhere?** The router does not pass it. The legacy `TopUpFlow` (line 84) uses `setState(() => _amount = amount)` directly, not the callback. So the callback at `top_up_amount_screen.dart:82-88` may be dead in both paths. (Likely dead code, not a bug.)

2. **Does the `documents_screen.dart` route ever get used?** The `AuthState.myDocuments` value exists; the router case for it is at `router_body.dart:588-590`. I traced the only `navigateTo(myDocuments)` call from the dashboard's profile screen; it's a one-way trip. No regression risk.

3. **What is the server-side behavior on a duplicate `POST /api/transaction/topup`?** The `Idempotency-Key` header plumbing exists in `api_client.dart:486-518`, and a new correlation ID is generated on every call (line 518). The `Idempotency-Key` header is per-call, so two calls have two different keys. The server's 5-min idempotency bucket is not the same as the `Idempotency-Key` header. Without the server code, I can't confirm the server's bucket is keyed on the rider + amount, the header, or both. The audit's claim of a 5-min bucket is from the user prompt; I did not verify.

4. **Is the `_topUpAmount` in `router.dart:115` ever used in the dashboard top-up path?** The dashboard uses the legacy `TopUpFlow` widget (line 17-22 of `top_up_flow.dart`), which stores its own `_amount` in its own `State`. The router's `_topUpAmount` is for the active onboarding path. The two are independent. No state leak.

5. **Does the `user_onboarding_screen` cache (`_saveCache` / `_loadCache`) survive an app kill?** It writes to a `KycRepository.saveFormCache` (line 200). I did not audit the `KycRepository` cache. The pickup draft's `kPickupDraftCacheKey` is centralized in `rider_provider.dart` (per the `D-P2-11` comment at router.dart:147-149); the KYC cache key is not. Same smell, different feature.

6. **Why is the `Idempotency-Key` header not used for `topUpWallet`?** `WalletNotifier.topUpWallet` at `wallet_provider.dart:113-146` calls `_repo.submitTopup(req)` and `_repo.getTransactionHistory(...)`. Neither passes an `idempotencyKey`. The `_repo` (`WalletRepositoryImpl`) is a thin wrapper that calls `_apiClient.postTransactionTopup(request)` and `_apiClient.getTransactionHistory(...)` — no `idempotencyKey` parameter. The two-tier flow (`submitTopup` → `getTransactionHistory`) means the server's idempotency bucket (if any) would need to be on the first call, but the key is generated per-call. Likely the dashboard top-up creates a duplicate on rapid double-tap; the audit prompt's question stands.

7. **What is `_applyInitialDraft`'s behavior when the rider changes hub on the pickup screen and then the screen is killed?** The `_initialDraftApplied` guard prevents re-application within a single screen instance, but on a new screen instance the guard resets. I did not verify whether the persistent draft is overwritten with the new choices before kill (line 605: `_persistPickupDraft()` is called from `updatePickupData`, which is called on each step's `onNext`).

---

## 7. Severity summary table

| # | File:line | Severity | Short description |
|---|-----------|----------|-------------------|
| P0-1 | `router_body.dart:519-540` | P0 | Active-path top-up proof is a no-op; deposit never recorded |
| P0-2 | `underline_otp_input.dart:172-201` | P0 | C2 IME bug anti-patterns (Opacity(0.0) + custom focusNode + cursorWidth:0) |
| P0-3 | `pickup_hub_widgets.dart:331-396` | P0 | OtpGrid C2 IME bug + no onCompleted |
| P0-4 | `rider_provider.dart:279-289` | P0 | 401 silently swallowed except in HangTight |
| P1-1 | `user_onboarding_screen.dart:277-298` | P1 | dispose removes wrong listener; memory leak + setState-after-dispose |
| P1-2 | `top_up_proof_screen.dart:333-348` | P1 | `_submit()` no double-tap guard |
| P1-3 | `otp_verification_screen.dart:169-171` | P1 | `_handleVerify` no double-tap guard |
| P1-4 | `intent_of_use_screen.dart:192-217` | P1 | setState race; brief double-tap window |
| P1-5 | `phone_entry_widget.dart:313-316` | P1 | Dead `.copyWith(color: ...)` chain; hint color is wrong |
| P1-6 | `pickup_hub_widgets.dart:331-396` | P1 | OtpGrid missing onCompleted |
| P1-7 | `top_up_amount_screen.dart:15, 82-88` | P1 | `onAmountChanged` dead code; flow state in router |
| P1-8 | `login_screen.dart:127-141` | P1 | Generic "Network error" hides 429/401 |
| P1-9 | `documents_screen.dart` | P1 | Surface divergence; design smell |
| P1-10 | `login_screen.dart:127-141` | P1 | `if (mounted)` not `context.mounted` |
| P1-11 | `otp_verification_screen.dart:163-167` | P1 | 2× rebuild per keystroke |
| P2-1 | `router_body.dart:50-95` | P2 | Splash restore doesn't compare lifecycle rank |
| P2-2 | `phone_entry_widget.dart:78-86` | P2 | 300 ms IME-show timer is fragile |
| P2-3 | `router.dart:516-550` | P2 | `_computeIsOnboarding` re-implements gate |
| P2-4 | `router_body.dart:677-693` | P2 | Pickup draft cleanup on logout depends on entry path |
| P2-5 | `otp_verification_screen.dart:228-262` | P2 | Resend countdown ignores server retryAfter |
| P2-6 | `otp_verification_screen.dart:148-161` | P2 | Countdown doesn't recompute on resume |
| P2-7 | `documents_screen.dart` | P2 | Two surfaces for documents |
| P2-8 | `user_onboarding_screen.dart:585-635` | P2 | `refresh()` error indistinguishable from upload error |
| P2-9 | `user_onboarding_screen.dart:695-719` | P2 | `_canProceedCurrentStep` reads controllers via getter |
| P2-10 | `pickup_hub_screen.dart:243-256` | P2 | `_initialDraftApplied` doesn't survive screen re-entry |
| P2-11 | `router.dart:516-550` | P2 | `_isOnboarding` should be a Riverpod provider |
| P2-12 | `splash_screen.dart:97-123` | P2 | 300 ms splash for stale JWT is wrong window |
| P2-13 | `app_state.dart` | P2 | 28-value enum touches 4+ files per new value |
| P2-14 | workspace root | P2 | Mockup HTMLs at workspace root |
| P3-1 | `posthog_service.dart:38, 51, 61, 67, 82` | P3 | 4 empty catches |
| P3-2 | `rider_logout_orchestrator.dart:128, 137` | P3 | 2 empty catches in cross-account orchestrator |
| P3-3 | `splash_screen.dart:104-108` | P3 | Empty `Future.microtask` with try/catch |
| P3-4 | `router.dart:350-360` | P3 | Empty catch around init calls |
| P3-5 | `router_body.dart:663-693` | P3 | Logout silent failure on weak network |
| P3-6 | `locale_provider.dart:137` | P3 | Empty catch |
| P3-7 | `legal_screen.dart:93, 123` | P3 | Empty catches |
| P3-8 | `doc_tile.dart:65-67` et al | P3 | Disabled-state pattern repeated |
| P3-9 | `router.dart:693-760` | P3 | `_handleSystemBack` long switch |
| P3-10 | `kyc_repository.dart` | P3 | KYC form cache key not centralized |
| P3-11 | `date_utils.dart:75, 82` | P3 | Empty catches |

---

## 8. 3-line worst-3 summary

1. **Active-path top-up is a silent no-op (`router_body.dart:519-540`)** — the router's `onSubmit` callback only navigates; the deposit proof, amount, and UPI ref are discarded, so every rider who completes `topUpProof` during onboarding has no `Transaction` row on the server and will be re-prompted for the deposit on cold restart.
2. **`UnderlineOtpInput` and `OtpGrid` (pickup) re-introduce the C2 IME bug** (`Opacity(0.0)` + custom `FocusNode` + `cursorWidth:0`/`showCursor:false`) — the same three anti-patterns the C2 investigation documented, in two widgets, with tests that all use `tester.enterText` and never open the real keyboard.
3. **Session-expiry 401s are silently swallowed everywhere except `HangTightScreen`** — `RiderNotifier._doRefreshFromApi` (`rider_provider.dart:279-289`) sets a generic "Pull to retry" message for all errors; a rider whose JWT expires mid-onboarding has no path to recovery except force-quit.
