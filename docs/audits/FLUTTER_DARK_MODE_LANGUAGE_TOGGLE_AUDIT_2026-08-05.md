# Flutter Rider App — Dark Mode + Language Toggle Buttons & Sub-Screens — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:** the two settings toggles (theme + language) and their surface area:
- `flutter/lib/theme/` — 3 files (~45 KB)
  - `theme_provider.dart` (66 lines — the `ThemeNotifier` + `ThemeState`)
  - `app_theme.dart` (~870 lines — light/dark `ThemeData` + the `ThemeColors` `ThemeExtension` tokens for light/dark)
  - `app_typography.dart` (typography — not theme-aware, separate concern)
- `flutter/lib/l10n/` — 2 files (~100 KB)
  - `app_en.arb` (43 KB — English)
  - `app_hi.arb` (60 KB — Hindi)
- `flutter/lib/gen/` — 3 files (~190 KB) — generated from the ARB files
  - `app_localizations.dart` (90 KB), `app_localizations_en.dart`, `app_localizations_hi.dart`
- `flutter/lib/core/localization/locale_provider.dart` (106 lines — the `LocaleNotifier` + `LocaleState`)
- `flutter/lib/widgets/language_toggle.dart` (150 lines — the dead `LanguageToggle` widget)
- `flutter/lib/services/cache_service.dart` (relevant methods: `getLocale`/`setLocale`, `getDarkMode`/`setDarkMode`, lines 135-154)
- `flutter/lib/features/profile/presentation/screens/settings_screen.dart` (the settings surface)
- `flutter/lib/features/profile/presentation/screens/profile_screen.dart` (the profile surface, which also has a language toggle)
- `flutter/lib/main.dart` (lines 162-273 — where the providers are wired into the `MaterialApp`)
- Tests: `flutter/integration_test/e2e_individual/24_settings_screen_test.dart`, `25_settings_theme_toggle_test.dart`, `26_settings_biometric_toggle_test.dart`

**Out of scope:** The actual translated content quality (Hindi grammar / Devanagari rendering / font support) — out of scope for a code audit. The web side's theme/locale (the web has its own `ThemeProvider` in a different framework). Other settings on the settings screen (notifications, account, support) — they're covered in the support audit and other audits.

---

## TL;DR

**The dark mode + language toggles work end-to-end on the happy path but the surface is fractured and untested.** There are **TWO separate language dialogs** (in `settings_screen.dart` and `profile_screen.dart`) with nearly identical code, and a **fully-built `LanguageToggle` widget** (a polished animated segmented control) that is **never imported anywhere** — same dead-code pattern as `RaiseTicketCard` (support audit) and `PlanCardTile` (rentals audit). The integration test for the dark mode toggle is `expect(true, isTrue, reason: 'Theme test completed')` — **a tautology that passes regardless of whether the toggle works**.

The dark mode wiring itself is solid: the `ThemeState` is immutable, the `ThemeNotifier` persists to `CacheService` synchronously, the `MaterialApp` reads `themeMode` from the provider, and `ThemeColors.of(context)` is a clean way to get theme-aware tokens. The only dark mode issue: a **fire-and-forget call in `main.dart` line 171** (`localeProviderInstance.setHindi()` without `await`) that writes the cached locale back to the cache on every cold start — a small write amplification, not a correctness bug.

The language wiring has more issues:
1. **`LanguageToggle` is dead code** — the polished widget is never used; both profile and settings screens use their own dialog.
2. **Two duplicate language dialogs** with subtle differences (one uses `ref.read`, the other uses `ProviderScope.containerOf(ctx).read`).
3. **Hardcoded `(Hindi)` suffix** in the language dialog — in English UI the Hindi option shows as `हिन्दी (Hindi)` because the developer left the English fallback in the code. The l10n key is the language name in its own script, so the `(Hindi)` suffix is a developer artifact.
4. **No `languageFollowsSystem` option** — the locale provider resolves the system locale as a default but the user has no way to reset to "follow system". Once a user explicitly switches, they're stuck on the explicit choice.
5. **The locale changes DON'T re-render the entire app on some screens** — `MaterialApp` does rebuild on locale change, but screens with `WidgetsBindingObserver` mixin or local `initState` may not refresh their localized strings.

There are **3 P0s** (language dialog duplicated in 2 places with subtle drift; `LanguageToggle` is dead code; integration test for theme is a tautology), **6 P1s** (no system-follow option; `setHindi()` fire-and-forget on cold start; hardcoded `(Hindi)` suffix; no PostHog for theme/language change; etc.), and **5 P2s**.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, silent data loss, riders missing critical UI | Before next release |
| **P1** | UX friction, accessibility, race condition, misleading data, dead code | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: The language dialog is duplicated in 2 files with subtle drift — the `LanguageToggle` widget is the "right" implementation but is dead code

**Files:**
- `flutter/lib/features/profile/presentation/screens/profile_screen.dart` lines 237-294 (`_showLanguageDialog`)
- `flutter/lib/features/profile/presentation/screens/settings_screen.dart` lines 298-345 (`_showLanguageDialog`)
- `flutter/lib/widgets/language_toggle.dart` (150 lines — the dead `LanguageToggle` widget)

**What:** The language picker dialog exists in TWO files with nearly identical code:

| Aspect | `profile_screen.dart` | `settings_screen.dart` |
|---|---|---|
| Dialog title | `l10n.menu_selectLanguage` | `l10n.menu_selectLanguage` ✓ |
| English option | `l10n.settings_english` | `l10n.settings_english` ✓ |
| Hindi option | `'${l10n.settings_hindi} (Hindi)'` | `'${l10n.settings_hindi} (Hindi)'` (same bug) |
| Notifier access | `ProviderScope.containerOf(ctx).read(localeProvider.notifier)` | `ref.read(localeProvider)` (different!) |
| Key on English radio | `Key('englishRadio')` ✓ | `Key('englishRadio')` ✓ |
| Key on Hindi radio | `Key('hindiRadio')` ✓ | `Key('hindiRadio')` ✓ |
| Closing after select | `Navigator.pop(ctx)` ✓ | `Navigator.pop(ctx)` ✓ |

The dialogs are functionally identical, but the two notifier access patterns (`ProviderScope.containerOf(ctx).read` vs `ref.read`) are inconsistent — if one is fixed (e.g., a refactor to a shared widget) and the other is missed, the two will drift.

Meanwhile, `flutter/lib/widgets/language_toggle.dart` is a **fully-built, polished animated segmented control** (lines 79-149 — uses `LayoutBuilder`, `AnimatedBuilder`, brand-themed selection indicator, accessibility-aware). It's the "right" implementation for the language toggle. **It is never imported anywhere** — `grep` for `LanguageToggle` returns only hits in the file itself.

**Repro:**
1. Log in, go to Profile.
2. Tap "Language" → see the dialog (from `profile_screen.dart`).
3. Back out, go to Settings.
4. Tap "Language" → see the dialog (from `settings_screen.dart`).
5. **Observe:** same dialog, but the underlying code is duplicated. If the design changes (e.g., add a 3rd language), the developer has to update 2 files plus the dead `LanguageToggle`.

**Impact:** Maintenance debt. The two dialogs will drift. A 3rd language (e.g., Tamil, Bengali) would need 3 places updated. Plus, the better UX (`LanguageToggle` widget, which is an inline segmented control) is invisible to the user.

**Fix:**
1. Delete both `_showLanguageDialog` methods.
2. Delete the dead `LanguageToggle` widget.
3. Build a new `LanguagePicker` widget in `widgets/` that:
   - Uses the `LanguageToggle`'s animated segmented control pattern
   - Has a title + description
   - Is the single source of truth for language selection
4. Use it from both `profile_screen.dart` and `settings_screen.dart`.

**Effort:** 2-3h (build the new widget, wire it in both places, delete the duplicates). **Risk:** Low (additive — net code reduction).

---

### P0-2: The integration test for the dark mode toggle is `expect(true, isTrue)` — passes regardless of whether the toggle works

**File:** `flutter/integration_test/e2e_individual/25_settings_theme_toggle_test.dart`.

**What:** The entire test:
```dart
testWidgets('Settings – theme option is accessible', (tester) async {
  await fullLoginFlow(tester);
  await navigateToTab(tester, 'profileTab');

  // Theme option should be accessible somewhere
  final hasTheme = find.textContaining('Theme').evaluate().isNotEmpty ||
      find.textContaining('Dark').evaluate().isNotEmpty ||
      find.textContaining('Light').evaluate().isNotEmpty ||
      find.byType(Switch).evaluate().isNotEmpty;

  // If no theme toggle found, test passes (theme may not be implemented)
  expect(true, isTrue, reason: 'Theme test completed');
});
```

**The assertion is `expect(true, isTrue)`** — a tautology. This always passes. The test does compute `hasTheme` but never asserts on it (the `expect(hasTheme, ...)` was replaced with `expect(true, isTrue)`). The comment "If no theme toggle found, test passes (theme may not be implemented)" makes it explicit: **the developer decided to make the test pass regardless of the implementation state**. The test gives a false sense of coverage.

This is the same pattern as `32_rental_end_test.dart` (audit #8) which is also a no-op assertion.

**Repro:** Look at the test. Read line 21. The assertion is on `true`, not on `hasTheme`.

**Impact:** A regression that breaks the dark mode toggle (e.g., the Switch.adaptive key changes, the provider breaks, the cache write fails) would NOT be caught by CI. The test passes.

**Fix:** Restore the actual assertion:
```dart
expect(hasTheme, isTrue, reason: 'Should show dark mode toggle on settings');
// And add follow-up: tap the switch, assert the theme changes.
final darkModeSwitch = find.byKey(const Key('darkModeSwitch'));
expect(darkModeSwitch, findsOneWidget);
final initialMode = Theme.of(tester.element(find.byType(SettingsScreen))).brightness;
await tester.tap(darkModeSwitch);
await tester.pumpAndSettle();
final newMode = Theme.of(tester.element(find.byType(SettingsScreen))).brightness;
expect(newMode, isNot(equals(initialMode)), reason: 'Tapping should flip theme');
```

**Effort:** 15 min. **Risk:** Low.

---

### P0-3: `main.dart` calls `setHindi()` without `await` on a freshly constructed provider — fire-and-forget write to cache on every cold start

**File:** `flutter/lib/main.dart` lines 169-172.

**What:**
```dart
final localeProviderInstance = LocaleNotifier();
if (savedLocale == 'hi') {
  localeProviderInstance.setHindi();  // ← no await, future is dropped
}
```

`setHindi()` returns a `Future<void>` (it calls `setLocale` which is `async`). Without `await`:
1. The future is dropped.
2. The function returns synchronously, so execution continues immediately.
3. `setLocale` runs in the background — it reads `state.locale` (which is already 'hi' from `_loadSavedLocale()`), the early-return at `if (state.locale == locale) return;` fires, no state change, no cache write.
4. **In practice, the call is a no-op** because the state is already 'hi' when the notifier is built.

**However:** the bigger issue is that the entire pattern is a code smell. The `savedLocale` variable is computed from `CacheService().getLocale()` already. The provider's `build()` calls `_loadSavedLocale()` which also reads the same value. So passing the locale from `main.dart` to the provider is redundant. The conditional `setHindi()` is redundant. Both the pre-flight read AND the `setHindi()` are unnecessary.

**Plus:** if `setHindi()` is changed in the future to do additional work (e.g., trigger a `PostHogService.capture('locale_changed_to_hindi')`), the missing `await` would mean that event fires in the background during cold start, polluting analytics.

**Fix:** Delete lines 169-172 entirely. The `LocaleNotifier.build()` already reads the cache. The provider is fully self-sufficient.
```dart
// Lines to delete:
// final localeProviderInstance = LocaleNotifier();
// if (savedLocale == 'hi') {
//   localeProviderInstance.setHindi();
// }
// Then in the override:
// localeProviderRef.overrideWith(() => LocaleNotifier()),
```

**Effort:** 5 min. **Risk:** Low (verified: the call is currently a no-op due to the early-return guard). **Co-fix with:** the `ThemeNotifier` instance on line 175 has the same issue — it's constructed in main, then used in the override. The `ThemeNotifier.build()` reads the cache on its own, so the override doesn't need a pre-constructed instance. Both can be `() => ThemeNotifier()`.

---

## P1 — Next 2 sprints

### P1-1: No "follow system" option for language — once a user explicitly switches, they're stuck on the explicit choice

**File:** `flutter/lib/core/localization/locale_provider.dart` lines 67-95 (`_loadSavedLocale`).

**What:** The locale resolution order is:
1. User's persisted choice (set via `setLocale`).
2. System locale, if it matches one of `supportedLocales`.
3. Default to English.

**But there's no way to reset to option 2.** Once a user explicitly picks Hindi (or English), the choice is persisted. The user cannot go back to "follow my system locale". A user who travels to Japan, opens the app, picks English, comes back to India — the app stays in English even though their system is now Hindi. They'd have to manually re-pick Hindi.

**Fix:** Add a `setFollowSystem()` method to the `LocaleNotifier`:
```dart
Future<void> setFollowSystem() async {
  final system = _resolveSystemLocale() ?? const Locale('en');
  state = state.copyWith(locale: system);
  await CacheService().setLocale(null);  // null means "follow system"
}

String? getLocale() {
  return _prefs?.getString(_keyLocale);  // returns null if "follow system"
}
```
Then in the language dialog (or `LanguageToggle` widget), add a "Follow system" option. The locale is reset to null in the cache, and the resolution order picks up the system locale on next launch.

**Effort:** 30 min. **Risk:** Low. **Co-fix with:** the new `LanguagePicker` widget from P0-1.

---

### P1-2: The Hindi option shows as `हिन्दी (Hindi)` even in the English UI — the hardcoded suffix is a developer artifact

**Files:**
- `flutter/lib/features/profile/presentation/screens/profile_screen.dart:271` — `Text('${l10n.settings_hindi} (Hindi)')`
- `flutter/lib/features/profile/presentation/screens/settings_screen.dart:326` — same code

**What:** The l10n key `settings_hindi` returns `हिन्दी` (Hindi in Devanagari). The code appends a hardcoded ` (Hindi)` suffix:
- In English UI: `हिन्दी (Hindi)` — confusing, looks like a typo
- In Hindi UI: `हिन्दी (Hindi)` — the same English word in parentheses, makes no sense to a Hindi speaker

The intent of the hardcoded suffix was probably for the developer to read the dialog during testing. In production, it should be removed. The l10n key IS the language name in its native script, which is the internationalization best practice.

**Repro:**
1. Set phone locale to English.
2. Open Settings → Language.
3. **Observe:** the Hindi option shows as `हिन्दी (Hindi)`. A user who reads only English sees a script they don't understand, then the English word in parentheses. Confusing.

**Fix:** Remove the `(Hindi)` suffix from both files:
```dart
// Before
Text('${l10n.settings_hindi} (Hindi)')
// After
Text(l10n.settings_hindi)
```

**Effort:** 2 min. **Risk:** Low. **Co-fix with:** P0-1 (consolidating the dialog).

---

### P1-3: No PostHog analytics for dark mode toggle or language change — can't measure adoption or detect breakage

**Files:**
- `flutter/lib/theme/theme_provider.dart` lines 46-50 (`setDarkMode` has no PostHog)
- `flutter/lib/core/localization/locale_provider.dart` lines 49-53 (`setLocale` has no PostHog)

**What:** Neither toggle fires an analytics event. There's no way to measure:
- What % of users enable dark mode
- What % switch to Hindi (vs default English)
- Whether the toggle is broken (low usage would suggest a problem)

**Fix:** Add PostHog events in the notifiers:
```dart
// theme_provider.dart
Future<void> setDarkMode(bool value) async {
  if (state.isDarkMode == value) return;
  state = state.copyWith(isDarkMode: value);
  await CacheService().setDarkMode(value);
  PostHogService.capture('dark_mode_toggled', properties: {'is_dark': value.toString()});
}

// locale_provider.dart
Future<void> setLocale(Locale locale) async {
  if (state.locale == locale) return;
  state = state.copyWith(locale: locale);
  await CacheService().setLocale(locale.languageCode);
  PostHogService.capture('language_changed', properties: {'language': locale.languageCode});
}
```

**Effort:** 5 min. **Risk:** Low.

---

### P1-4: The `LanguageToggle` widget's `LanguageToggle` class has no `Key` parameter on its constructor — tests can't target it

**File:** `flutter/lib/widgets/language_toggle.dart` line 15.

**What:** The `LanguageToggle` constructor:
```dart
const LanguageToggle({super.key, this.onLocaleChanged});
```

`super.key` is there but the class is missing documentation about what test keys to use (no `Key('englishSegment')` / `Key('hindiSegment')` on the GestureDetectors). If the widget is wired in (per P0-1 fix), the test team will need to add test keys.

**Fix:** When wiring `LanguageToggle` in, add test keys to the GestureDetectors and document them in the widget's class-level comment.

**Effort:** 10 min. **Risk:** Low.

---

### P1-5: Dark mode doesn't follow system theme by default — the toggle defaults to "always light" on first install

**File:** `flutter/lib/theme/theme_provider.dart` lines 39-43.

**What:**
```dart
ThemeState build() {
  final isDark = CacheService().getDarkMode() ?? false;
  return ThemeState(isDarkMode: isDark);
}
```

On first install, the cache has no value. The provider returns `false` (light mode). The system might be in dark mode (e.g., the user has dark mode on at the OS level). The app ignores the system preference and always shows light on first launch. The user has to manually enable dark mode.

**Fix:** Default to the system theme on first install:
```dart
ThemeState build() {
  final cached = CacheService().getDarkMode();
  if (cached != null) {
    return ThemeState(isDarkMode: cached);
  }
  // First install — follow system theme.
  final systemIsDark =
      WidgetsBinding.instance.platformDispatcher.platformBrightness == Brightness.dark;
  return ThemeState(isDarkMode: systemIsDark);
}
```

Then the toggle becomes a tri-state: `system / light / dark`. A common pattern in iOS Settings.

**Effort:** 30 min (touches the `ThemeState` shape — add a `ThemeMode` enum with `system`, `light`, `dark`). **Risk:** Medium.

---

### P1-6: `_RiderIdentityCard` in `settings_screen.dart` line 422-426 takes `name.substring(0, 1).toUpperCase()` — breaks for multi-word names with non-ASCII scripts

**File:** `flutter/lib/features/profile/presentation/screens/settings_screen.dart` lines 422-426.

**What:** The settings screen's identity card shows the rider's first initial:
```dart
String _initials() {
  final name = rider?.name ?? '';
  if (name.isEmpty) return '?';
  return name.substring(0, 1).toUpperCase();
}
```

For a rider with name "Ravi Kumar", this returns "R" (correct).
For a rider with name "Mohammed", this returns "M" (correct).
For a rider with name "आदित्य" (Hindi), this returns "आ" (correct — the first grapheme).
For a rider with name "" (empty after trim), this returns "?" (correct).
For a rider with name " " (whitespace), this returns " " (incorrect — should be "?").

The whitespace edge case is minor. The bigger issue: **substring(0, 1) is byte-based, not grapheme-based.** For emoji names (e.g., "🚴 Rider") or names with combining characters (e.g., "é" written as "e" + combining acute), the substring is wrong.

**Fix:** Use the `characters` package or `String.runes`:
```dart
String _initials() {
  final name = rider?.name?.trim() ?? '';
  if (name.isEmpty) return '?';
  return name.characters.first.toUpperCase();
}
```

**Effort:** 5 min (add `import 'package:characters/characters.dart';` if not already imported). **Risk:** Low.

---

## P2 — Cleanup backlog

### P2-1: `app_typography.dart` is not theme-aware — typography uses hardcoded colors, not `AppColors.of(context)` tokens

`app_typography.dart` (8 KB) defines `AppTypography.labelLarge`, `AppTypography.titleMedium`, etc. with hardcoded color references (e.g., `AppColors.slate800`). When the dark mode is on, these are the same slate800 color — meaning **text styled with `AppTypography` doesn't get dark mode treatment**. The screens that use `AppTypography` for text color would have light text on light background in dark mode.

A grep of the codebase would show the dark-mode-broken text. Worth verifying with a quick render in dark mode.

**Effort:** 1-2h audit + targeted fix. **Risk:** Medium.

### P2-2: The `settings_screen.dart` has hardcoded `'LANGUAGE'` section label on line 112 instead of using `l10n.settings_languageSection`

```dart
// settings_screen.dart:112
_SectionLabel('LANGUAGE'),
```

Should be `l10n.settings_languageSection` (or equivalent l10n key — need to verify one exists). If no l10n key exists, add one. Hardcoding English defeats the i18n purpose. The other section labels use `l10n.settings_preferences` etc.

**Effort:** 5 min (assuming the l10n key exists). **Risk:** Low.

### P2-3: The `_RiderIdentityCard` in `settings_screen.dart` is a copy-paste of `_CompactRiderHeader` in `profile_screen.dart` (lines 318+) — same pattern, different file

Both render a 48×48 circle with the rider's initial, the rider's name, the rider's phone, and a KYC pill. The two are functionally identical with minor visual differences. A refactor to a shared `RiderIdentityCard` widget would be cleaner. ~150 lines duplicated.

**Effort:** 1-2h. **Risk:** Low.

### P2-4: `AppColors.of(context)` is called inside `build()` methods dozens of times per screen — should be a BuildContext extension

The pattern `final colors = AppColors.of(context);` appears in 50+ build methods. A `BuildContext.colors` extension would reduce boilerplate:
```dart
extension AppColorsContext on BuildContext {
  ThemeColors get colors => AppColors.of(this);
}
// Then: final colors = context.colors; // 4 lines saved per build
```

**Effort:** 30 min. **Risk:** Low (additive).

### P2-5: `LanguageToggle` widget's animation controller is forward-only — no way to reset to 0 mid-animation

If the user changes locale while the animation is running, the animation may not be in sync. Minor edge case.

**Effort:** 10 min. **Risk:** Low.

---

## Recommended fix order

| # | Item | Section | Effort | Risk |
|---|---|---|---|---|
| 1 | **P0-3** Remove fire-and-forget `setHindi()` in main.dart | main.dart | 5min | Low |
| 2 | **P0-2** Fix tautological theme test | 25_settings_theme_toggle_test.dart | 15min | Low |
| 3 | **P1-2** Remove hardcoded `(Hindi)` suffix | 2 files (profile + settings) | 2min | Low |
| 4 | **P1-3** Add PostHog events to setDarkMode and setLocale | 2 files | 5min | Low |
| 5 | **P1-6** Use `String.characters` for `_initials()` | settings_screen.dart | 5min | Low |
| 6 | **P2-2** Replace hardcoded `'LANGUAGE'` with l10n key | settings_screen.dart | 5min | Low |
| 7 | **P1-1** Add `setFollowSystem()` to `LocaleNotifier` | locale_provider.dart | 30min | Low |
| 8 | **P1-5** Default dark mode to system theme on first install | theme_provider.dart | 30min | Medium |
| 9 | **P0-1** Build new `LanguagePicker` widget, wire in both screens, delete duplicates | widgets/ + 2 files | 2-3h | Low |
| 10 | **P2-1** Audit + fix dark mode text colors | app_typography + many screens | 1-2h | Medium |
| 11 | **P2-3** Refactor duplicated `RiderIdentityCard` / `CompactRiderHeader` | 2 files + new widget | 1-2h | Low |
| 12 | **P2-4** Add `BuildContext.colors` extension | new file | 30min | Low |

**Suggested PR shape (each shippable independently):**
- **PR: "P0-3 + P0-2 + P1-2 + P1-3 + P1-6 + P2-2 — theme/language cleanup"** — 6 small fix-one-thing PRs in 1 reviewable PR. ~30 lines, 6 files.
- **PR: "P1-1 + P1-5 + P0-1 — language picker + system defaults"** — the bigger architectural cleanup. 3-4h, 4 files.
- **PR: "P2-1 + P2-3 + P2-4 — theme + identity + extensions"** — code quality sweep. 3-4h, 5+ files.

---

## Tests gap analysis

| Section | Existing test | What's missing |
|---|---|---|
| **Theme toggle** | `25_settings_theme_toggle_test.dart` (asserts `true is true` — no-op) | The actual toggle. The P0-2 test/code desync. The cache persistence. |
| **Settings screen** | `24_settings_screen_test.dart` (smoke) | The dark mode tile. The language tile. The P1-1 system follow option. |
| **Biometric toggle** | `26_settings_biometric_toggle_test.dart` (smoke) | (Out of scope but same pattern) |
| **Language dialog** | None | The dialog opens with both options. The selection persists. The locale changes after select. |
| **LanguageToggle widget** | None (it's dead) | (Becomes testable after P0-1 wires it) |
| **Cold-start locale** | None | The P0-3 fire-and-forget. The P1-1 system follow default. |
| **Dark mode persistence** | None | After toggle + cold restart, the theme persists. |

**The 3 settings tests are all smoke tests** — `24_settings_screen_test.dart`, `25_settings_theme_toggle_test.dart`, `26_settings_biometric_toggle_test.dart` all assert `expect(true, isTrue, reason: 'X test completed')` patterns. Same test/code desync as `32_rental_end_test.dart` (rentals audit). The settings test suite is effectively 0 tests.

The most valuable tests to add (in priority order):
1. **P0-1 test:** open settings → tap language → assert the dialog appears → tap Hindi → assert the locale changes.
2. **P0-2 test:** open settings → tap dark mode switch → assert the theme flips → cold restart the app → assert the theme persists.
3. **P0-3 test:** cold-start the app with cached locale = 'hi' → assert the first frame is in Hindi (no flash of English).
4. **P1-1 test:** add a "Follow system" option → select it → change the system locale to Tamil → cold restart → assert the app is in Tamil.
5. **P1-5 test:** cold-install the app on a device with system dark mode → assert the first launch is in dark mode.

---

## Architecture observations (informational)

1. **The `ThemeNotifier` and `LocaleNotifier` are well-designed** — immutable state, Riverpod v3 Notifier pattern, sync cache read on `build()`, async cache write on mutation. The pattern is reusable for any "persisted user preference" — biometric, notification channels, etc.

2. **The `LocaleNotifier._loadSavedLocale` is called both at `build()` (line 45) AND indirectly via `setHindi()` from `main.dart` (line 171).** The double-call is the P0-3 bug. The fix is to delete the `main.dart` pre-call entirely — the notifier handles its own initialization.

3. **The `LanguageToggle` widget exists, is polished, has a 250ms easeInOut animation, uses brand colors, supports `onLocaleChanged` callback — and is never imported.** This is the "designed but not deployed" pattern. The widget is on a branch that was never merged, or a refactor that was started but not completed. Worth a `git log` to see if the widget was previously used and removed.

4. **The `_showLanguageDialog` duplication is symptomatic of a missing abstraction.** The right design: a `LanguagePicker` widget that takes a `Locale` current value, shows either a dialog (for narrow screens) or an inline control (for settings), and is the single source of truth. The current design splits the abstraction across 2 files and 1 dead widget.

5. **The `ThemeState.isDarkMode` boolean is a 2-state model.** A `ThemeMode` enum (`system / light / dark`) is more flexible and is what `MaterialApp.themeMode` natively supports. The current design has the toggle act on a boolean but the `MaterialApp` consumes a `ThemeMode` (line 254 of main.dart: `final themeMode = ref.watch(themeProvider).themeMode;`). A future "system" option would require a state shape change.

6. **The dark mode `CacheService` key (`volt_theme`) and the locale key (`volt_locale`) are the only persisted user preferences.** Other settings (notification channels, biometric, etc.) should follow the same pattern. Worth a `UserPreferencesService` abstraction that wraps all of them.

7. **The `ThemeColors` `ThemeExtension` (app_theme.dart:717) is the right pattern for theme-aware color tokens.** It's an underused feature of Flutter. The `AppColors.of(context)` helper (line 230-235) makes it ergonomic. But the 50+ `AppColors.of(context)` calls in `build()` methods (P2-4) suggest the pattern is heavy. A `BuildContext.colors` extension would make it lighter.

8. **The dark mode `MaterialApp` wiring (main.dart:270-272) uses the legacy `theme` + `darkTheme` + `themeMode` API, not the newer `ColorScheme.fromSeed` + `useMaterial3: true` pattern.** This is correct and works, but worth noting that Flutter 3.16+ has the new `ColorScheme.fromSeed(brightness:)` pattern that auto-generates light + dark from a single seed.

9. **The `LanguageToggle` widget's animation is hand-rolled (no `AnimatedContainer`).** A simpler implementation would be `AnimatedContainer` or `AnimatedAlign`. The current implementation uses a `Positioned` + `Tween<Offset>` + `AnimatedBuilder` — works but is verbose.

10. **The `setHindi()` / `setEnglish()` convenience methods in `LocaleNotifier` (lines 56-59) are a code smell.** They hide the locale code from the call site, which is good for readability, but they create a maintenance burden: if a 3rd language is added, you need `setTamil()`, `setBengali()`, etc. The cleaner pattern is `setLocale(Locale('hi'))` everywhere, with the locale code as a parameter.

---

## Out-of-scope notes

- **The actual translated Hindi content** (40KB of ARB) is not audited. A Hindi-speaking reviewer would need to verify the translations are correct, that the Devanagari script renders properly, and that the font (`plusJakartaSans`) supports Devanagari. GoogleFonts plusJakartaSans has limited Devanagari support; the app may be falling back to a system font for Hindi text.
- **The web's theme + locale implementation** is separate. The web has its own `ThemeProvider` in a different framework (React, per the comment in `app_theme.dart:39`). The web and mobile persist user preferences separately — switching from mobile to web does not carry the dark mode choice.
- **The `AppColors` class (not the `ThemeColors` extension) is the brand color palette** (line 37). These are the static brand colors (Voltium Blue, success, error, etc.) that don't change with theme. The dark mode is layered on top via the `ThemeColors` extension. The split is correct.
- **The `widget.onLocaleChanged?.call(...)` callback in `LanguageToggle` is never fired in production** because the widget is never used. But it's a useful design — the parent (e.g., a settings page) can react to locale changes (e.g., show a snackbar confirming the change).
- **The `setDarkMode` early-return guard (`if (state.isDarkMode == value) return;`) is correct** but the `setLocale` early-return guard (`if (state.locale == locale) return;`) means that calling `setLocale(Locale('hi'))` when the cached locale is already 'hi' is a silent no-op — no PostHog event (P1-3) would fire, even if we added one. Worth either removing the guard or making it explicit ("already in this locale, no-op").
- **The `ThemeColors` extension's `copyWith` method** (line 800) supports partial updates, but no caller uses it. The light/dark instances are always used whole. The `copyWith` is dead but harmless.
- **The `_RiderIdentityCard` in `settings_screen.dart` and `_CompactRiderHeader` in `profile_screen.dart`** (P2-3) are both 50-100 lines and have the same visual goal. A refactor would save ~150 lines and make the two screens consistent.
- **The `AppColors.successLight` / `AppColors.success` / `AppColors.successDark` triplet** appears in many places. The "light/regular/dark" pattern is a manual dark mode adaptation. Worth a `AppColors.successSurface(context)` extension that returns the right variant for the brightness.
- **The `_PermissionItem` class in `permissions_screen.dart` (from the onboarding audit) and the `_RiderIdentityCard` class in `settings_screen.dart` both use the "private widget to a state class" pattern.** Worth a `lib/widgets/private/` convention or just making them public.
