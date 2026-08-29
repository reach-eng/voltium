# Form widgets (Voltium)

The rider app's form widgets live in `lib/widgets/forms/`. They
wrap Flutter's primitives (`TextFormField`, `Form`, `InkWell`) with
Voltium's visual identity and accessibility contracts. The widgets
were introduced in the audit/PR-A–E cleanup; this document is the
contract for new widgets and new call sites.

## The four widgets

| Widget | Purpose |
|---|---|
| `VoltiumTextField` | Standard text input. Use for free text, names, addresses, emails, phone numbers (read-only), vehicle numbers, etc. |
| `VoltiumPhoneField` | Interactive phone field with SEND OTP / RESEND / VERIFIED state machine and an optional OTP-box slot. |
| `VoltiumDateField` | Read-only date input that opens a `showDatePicker` on tap. |
| `VoltiumFormCard` | Section header + `Form` wrapper. The `Form` is the parent of all child fields; `formKey` and `autovalidateMode` are exposed. |

All widgets are exported from `lib/widgets/forms/forms.dart` (the
barrel). Always import from the barrel in feature code, not from
the individual files — the individual files are an implementation
detail.

## Contract for new form widgets

A new form widget must:

1. Live under `lib/widgets/forms/`.
2. Be exported from `forms.dart`.
3. Accept a `Key? fieldKey` and pass it through to its internal
   `TextFormField` (or equivalent). This is what makes the widget
   testable and addressable in golden tests.
4. Wrap its build output in `Semantics(textField: true, label: label)`
   so screen readers (TalkBack, VoiceOver) announce the field
   group correctly. The `label` is the localized string the user
   sees.
5. Not have a hardcoded `Key('sendOtpButton')` /
   `Key('verifyOtpButton')`. The two OTP buttons in
   `VoltiumPhoneField` derive their keys from `fieldKey` because
   two phone-field instances on the same screen (e.g. the
   guarantor onboarding flow) would otherwise collide on a single
   hardcoded key.

## `textCapitalization` rules

The default for `VoltiumTextField.textCapitalization` is
`TextCapitalization.none`. The previous default
(`TextCapitalization.sentences`) silently auto-capitalized the
first character of any typed input, which broke regex validation
for identifier fields (PAN, Aadhaar, email, IFSC, bank account,
vehicle number).

For free-text fields (address, description), pass an explicit
`textCapitalization: TextCapitalization.sentences`. For proper-noun
fields (names, place names), pass
`textCapitalization: TextCapitalization.words`. For identifier
fields (everything else), leave the default.

## `Semantics` rules

`Semantics(textField: true, label: label)` is added to the
build output of every form widget. The wrapper is on the outermost
`return` in the build method, not nested inside a sub-widget
(which would scope the semantics to a child subtree only).

The `textField: true` flag tells the screen reader this is an
editable text input. For read-only variants (the rider phone in
`VoltiumPhoneField`'s read-only mode), omit `textField:` so the
screen reader announces it as a labeled value, not an editable
field.

## When to add a `Semantics` wrapper vs use a `RawKeyboardListener` etc.

- Form fields → `Semantics` wrapper. Always.
- Tap targets (buttons, FABs) → use the standard Flutter
  `Material` widget; it adds its own Semantics.
- Whole-screen wrappers → `Semantics(container: true, label: ...)`
  on the outermost `Scaffold` body.

## Tests for form widgets

The widget tests live under `test/widgets/forms/`. Each widget
has at least:

1. Read-only mode test (where applicable).
2. Editable mode + validation test.
3. Field-key passthrough test (verify `fieldKey` is passed to
   the internal `TextFormField`).

Test files for form widgets must include `MaterialApp` with
`localizationsDelegates: AppLocalizations.localizationsDelegates`
and `supportedLocales: AppLocalizations.supportedLocales` —
without them, `AppLocalizations.of(context)` returns null and the
form widget throws at first build.

See `test/widgets/forms/voltium_text_field_test.dart` for the
canonical example.

## See also

- `flutter/docs/l10n.md` — the 7 form-widget unique keys, the
  no-fallback rule, and the casing conventions.
