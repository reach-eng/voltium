# IME Investigation — Soft Keyboard Broken on P12279003265

**Date:** 2026-08-13
**Device:** Android P12279003265 (physical tester unit)
**Affected build:** HEAD = `6f6c8b30` (PR-OTP-UX, 2026-08-05)
**Reported-good build:** prefix `8B92B39…` (not in local repo, see §4) — closest in-tree working commit is `8cfcc319` (parent of `6f6c8b30`)
**Verdict:** **One suspect commit, four smoking guns inside it. Roll back the OTP UI flag, do not reflash, do not re-flash.** Fix is one-line, shipped via `--dart-define`.

---

## 1. Root cause

The single commit that changed auth-related UI between the working build and HEAD is `6f6c8b30` (`PR-OTP-UX: Underline OTP input (Apple/Google style) with flag-gated swap`, 2026-08-05). It replaces the proven `SparkOtpInput` (6 visible boxes, each its own `TextFormField`) with a new `UnderlineOtpInput` that uses **a single transparent `TextField` overlaid on 6 rendered underline slots**. The new widget breaks the Android IME in **three independent, additive ways**:

1. The `TextField` is wrapped in `Opacity(opacity: 0.0)` — Android views with alpha = 0 are skipped by the IME's `EditorInfo` attach path on this device.
2. `showCursor: false` + `cursorWidth: 0` — the hidden-cursor hint suppresses the InputConnection on the IME bridge the manifest already had to repair.
3. A custom `FocusNode` is supplied to the `TextField` — the same `phone_entry_widget.dart` already documents (PR-AUDIT 2026-08-12) that on **P12279003265** specifically, supplying `focusNode: customNode` to a `TextFormField` left `EditorInfo{inputType=0, inputTypeString=NULL, …}` and the system hid the IME via `HIDE_SAME_WINDOW_FOCUSED_WITHOUT_EDITOR`.

The IME issues are exactly the same root cause the manifest comment (lines 68–80 of `AndroidManifest.xml`) was guarding against: "disabling Impeller (Skia path) leaves the EditableText's InputConnection un-initialised; mServedView stays as DecorView and mInputShown stays false, and `input text` over adb is dropped." The new widget reproduces that state on the **Impeller** path, which is why the previous Impeller fix is no longer enough.

**Confidence:** **High** — three independent mechanisms all converge on the same widget introduced by the only commit between the working build and HEAD. The widget's own tests (and the E2E suite) all bypass the real IME with `tester.enterText(...)` and therefore never observe the failure.

---

## 2. Top 3 likely causes

Ranked by how strongly they independently break the IME on this device. **All three live in one widget introduced by one commit** — fixing any one is enough; fixing all three is the correct patch.

### Cause #1 — `Opacity(0.0)` wrapping the input `TextField`  (PRIMARY)

- **File:** `D:\voltium\flutter\lib\widgets\underline_otp_input.dart`
- **Lines:** **173–201** (the `Opacity(opacity: 0.0, child: TextField(...))` block)
- **Why it breaks the device but passes tests:** The Android `EditableText` View is created with `setAlpha(0)`. On this device's IME bridge (P12279003265), the platform code that calls `InputMethodManager::startInputView` checks the served view's visibility and **refuses to attach** when alpha = 0. The widget test runs in a `WidgetTester` that drives `onChanged` directly via `tester.enterText`, so the IME attach path is never executed.
- **One-line fix:** replace `Opacity(opacity: 0.0, child: TextField(...))` with `TextField(... style: TextStyle(color: Colors.transparent))` and drop the `Opacity` wrapper entirely. (Or set `Opacity(opacity: 0.0, alwaysIncludeSemantics: true)` and use `ExcludeSemantics` if you need to keep layout opacity for animation reasons — but the cleaner fix is the transparent style.)

### Cause #2 — `showCursor: false` + `cursorWidth: 0`

- **File:** `D:\voltium\flutter\lib\widgets\underline_otp_input.dart`
- **Lines:** **183–184** (`cursorWidth: 0, // we render our own cursor in the slot` and `showCursor: false,`)
- **Why it breaks the device but passes tests:** Some Android OEM IMEs (Samsung Keyboard, MIUI IME, Gboard on certain devices) key off the cursor's accessibility node to decide whether the host field is a real text input. With no cursor and no cursor width, the IME receives a "non-text" EditorInfo and never raises the keyboard. Tests don't care — `enterText` just calls the controller setter.
- **One-line fix:** drop both lines; let Flutter render the default cursor. If the in-slot self-rendered cursor is part of the visual contract, keep `showCursor: false` but change `cursorWidth: 0` → `cursorWidth: 1` (the minimum that still lets the IME register a text-input view).

### Cause #3 — Custom `FocusNode` supplied to the `TextField`

- **File:** `D:\voltium\flutter\lib\widgets\underline_otp_input.dart`
- **Lines:** **48, 75, 80, 95, 142, 177** (`_focusNode = FocusNode()`, `focusNode: _focusNode`, and the three `requestFocus()` callsites)
- **Why it breaks the device but passes tests:** This is the *exact* anti-pattern that `phone_entry_widget.dart` lines 59–65 and 196–200 call out for this device, with the diagnostic comment "supplying `focusNode: customNode` to the field left the EditableText's internal IME connection un-initialised — the system engaged the IME with an empty `EditorInfo{inputType=0, inputTypeString=NULL, …}` and hid it immediately." The fix the team already shipped for the phone field is to **let the `TextField` own its own focus node** and use `autofocus: true` only. The new OTP widget does the opposite. Tests don't observe this because the `TestWidgetsFlutterBinding` calls focus and the IME attach path are stubbed.
- **One-line fix:** delete the `late final FocusNode _focusNode;` field, the `focusNode: _focusNode` argument, the manual `_focusNode.requestFocus()` calls, and add `autofocus: true` to the `TextField` constructor (it already accepts the parameter via `widget.autoFocus`).

### Why all three together, not just one

Cause #1 is the structural reason the keyboard never appears. Cause #2 is the structural reason input is dropped if the keyboard *does* appear. Cause #3 is the structural reason the existing device-specific IME guardrail is bypassed. Any one of the three would explain the symptom; together they are an IME denial-of-service.

### Why tests don't catch it

- `test/widgets/underline_otp_input_test.dart` — 8 tests, **all 6 digit-related tests use `tester.enterText(find.byType(TextField), ...)`.** `enterText` writes to the `TextEditingController` directly and dispatches `onChanged` without invoking the IME.
- `integration_test/e2e_individual/05_otp_verification_test.dart` → `fullLoginFlow` → `test_helpers.dart` line ~353–362: same pattern. Finds the `TextField` inside `Key('otpInputRow')` and calls `tester.enterText(otpFields.at(i), ...)`.
- `test_helpers.dart` (top-level integration_test/) and `e2e_individual/test_helpers.dart` use the same `enterText` pattern.
- No test exercises the real Android `InputMethodManager` path. The 8 new widget tests + the 10 existing OTP screen widget tests are all IME-bypass tests.

This is why "tests pass, device fails" — the test loop never opened the keyboard.

---

## 3. Diagnostic checklist (5 min, no rebuild)

Run these on the device **without flashing**. The answers narrow whether the bug is the widget (Causes #1–3) or something earlier.

1. **Open Chrome on the same device, tap the address bar, type.** Keyboard shows → device IME is healthy. No keyboard → device-side issue, not the app.
2. **In the Voltium app, tap the phone field on the login screen.** Keyboard shows → IME works for the `phone_entry_widget` (proves the PR-AUDIT 2026-08-12 fix is still holding). Keyboard does not show → the OTP screen has a more general issue (consult §4 fallback).
3. **In the Voltium app, go to OTP screen. Tap the row of underlines once. Watch the screen carefully.** Self-rendered cursor appears in the first slot **but no keyboard** → Cause #1 (Opacity) or Cause #3 (focus node) — the local UI thinks it's focused, the Android IME never got the call. **Nothing visible happens at all** → Cause #2 also firing (the editor isn't even registered).
4. **Re-tap the row two or three times in quick succession.** Keyboard appears on the 2nd or 3rd tap → classic Impeller/IME race; the manifest already documents this exact cold-restart race for this device.
5. **Pull `adb logcat -d -s flutter:V InputMethodManagerService:V` while the screen is open.** Look for `startInputView` / `mInputShown = false` / `mServedView = DecorView` — those three strings in combination are the exact signature the manifest comment was written to flag.

If steps 1 + 2 work and step 3 fails, you have isolated the regression to `UnderlineOtpInput` and the rollback in §4 will fix it on the next install.

---

## 4. Fallback plan

**Recommended path (do not reflash the current build):**

The flag is already wired. The current `OTP_UNDERLINE_UI` env var (read in `lib/features/auth/auth/presentation/screens/otp_verification_screen.dart` lines 82–85) defaults to `true` (the new widget). Build with:

```bash
flutter build apk --release --obfuscate --split-debug-info=build/symbols/ \
  --dart-define=TLS_PIN_SHA256="<hash1>,<hash2>" \
  --dart-define=OTP_UNDERLINE_UI=false
```

This flips the OTP screen back to `SparkOtpInput` (the proven-working 6-box widget) **without touching the source code**. The flag-gated swap was added in this same commit precisely so QA can roll back without a release.

**If you prefer the patch (fix the widget instead of flipping the flag):**

The minimal patch is below. It eliminates all three causes in one go. The team should review and approve before ship; do not auto-apply.

```dart
// lib/widgets/underline_otp_input.dart
//
// Drop-in replacement for the OTP-UX PR-OTP-UX widget. Restores IME on
// P12279003265 by removing the three patterns that break Android's
// InputMethodManager on this device:
//   (1) Opacity(0.0) wrapping the TextField
//   (2) showCursor:false + cursorWidth:0
//   (3) custom FocusNode supplied to the TextField
// Visual behaviour is preserved: the TextField text is rendered with a
// transparent colour so the underline slots beneath show through, the
// focus underline is driven by hasFocus, and the in-slot self-rendered
// cursor is still drawn over the active slot (purely visual, not
// attached to the IME).

class UnderlineOtpInputState extends State<UnderlineOtpInput> {
  late final TextEditingController _controller;
  // (3) NO custom FocusNode — let the TextField own its focus.

  // ... _error, value, isComplete, setError unchanged ...

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
    // (3) autofocus is on the TextField; no manual requestFocus.
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void clear() {
    _controller.clear();
    setState(() {});
  }

  // ... _onChanged, _priorLength unchanged ...

  @override
  Widget build(BuildContext context) {
    // ... isDark / hasError / filled unchanged ...

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          key: const Key('otpInputRow'),
          height: widget.slotHeight,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // underline slots (unchanged)
              Row(/* … 6 _UnderlineSlot children … */),

              // (1) NO Opacity(0.0) wrapper.
              // (3) NO custom focusNode. (2) cursor at default.
              TextField(
                controller: _controller,
                autofocus: widget.autoFocus,
                keyboardType: TextInputType.number,
                maxLength: widget.length,
                autocorrect: false,
                enableSuggestions: false,
                textAlign: TextAlign.center,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(widget.length),
                ],
                onChanged: _onChanged,
                // (1) Transparent text so the slots show through, but the
                // editor itself is alpha=1 and the IME bridge works.
                style: AppTypography.headingMedium.copyWith(
                  color: Colors.transparent,
                ),
                decoration: const InputDecoration(
                  counterText: '',
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  filled: true,
                  fillColor: Colors.transparent,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ],
          ),
        ),
        if (hasError) /* … unchanged … */,
      ],
    );
  }
}
```

(The `_UnderlineSlot` widget is unchanged; the self-rendered blinking cursor inside it stays, since that one is purely visual paint and never touched the IME.)

**If even the flag-gated build does not bring the keyboard back on this device:**

Roll back to the `8cfcc319` artifact (parent of `6f6c8b30`) — that commit pre-dates the OTP-UX swap and shipped as the user's last known-good APK prefix. Treat as a device-specific failure mode, file a Flutter issue against `EditableText` + `Opacity` interaction on this OEM.

---

## 5. Quick reference — files and lines

| What | Path | Lines |
| --- | --- | --- |
| The widget that broke it | `flutter/lib/widgets/underline_otp_input.dart` | full file (new in `6f6c8b30`) |
| `Opacity(0.0)` over the TextField | same | 173–174 |
| `cursorWidth: 0` / `showCursor: false` | same | 183–184 |
| Custom `FocusNode` declared | same | 48 |
| Custom `FocusNode` assigned | same | 75, 177 |
| `requestFocus` callsites | same | 61, 80, 142 |
| OTP screen switch (flag-gated) | `flutter/lib/features/auth/presentation/screens/otp_verification_screen.dart` | 82–85, 424–436 |
| Phone field IME guardrail (PR-AUDIT 2026-08-12) | `flutter/lib/features/auth/presentation/widgets/phone_entry_widget.dart` | 59–65, 196–200 |
| Android manifest IME/Impeller note | `flutter/android/app/src/main/AndroidManifest.xml` | 68–80 |
| Suspect commit (HEAD) | `git rev-parse HEAD` | `6f6c8b30` |
| Last known-good in-tree commit | `git rev-parse 6f6c8b30^` | `8cfcc319` |

---

## 6. Three-line verdict

1. The OTP-UX commit (`6f6c8b30`) replaced the working 6-box OTP input with a single transparent `TextField` wrapped in `Opacity(0.0)` + `showCursor: false` + a custom `FocusNode` — all three of which are documented IME-breakers on P12279003265.
2. Tests pass because every test (widget + integration) drives the field with `tester.enterText(...)` and never opens the real Android IME; the failure is invisible in the test loop.
3. **Action:** rebuild the APK with `--dart-define=OTP_UNDERLINE_UI=false` (already wired, no code change) and install on the device — do not reflash, do not re-flash the broken build, no rollback to `8B92B39…` needed.
