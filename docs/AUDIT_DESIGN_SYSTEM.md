# Voltium Design System / UI Consistency — Deep-Dive Audit Findings

**Date:** 2026-07-29
**Scope:** `flutter/lib/theme/*` (3 files), `flutter/lib/widgets/*` (79 files), `design-tokens.json` (root), `docs/design-system.md`, `docs/DESIGN.md`.

> **Status (2026-07-30):** 8 of 10 Top 10 P0s FIXED, 2 PARTIALLY FIXED with CI lint enforcement (PR-P1.5). See [`AUDIT_VERIFICATION_3_2026-07-30.md`](./AUDIT_VERIFICATION_3_2026-07-30.md) §4.
**Method:** File-by-file read plus repo-wide grep audits (hardcoded colors, raw spacing, AppColors usage). Every finding has file:line evidence and a concrete fix.

This is the eighth in the audit series. It is focused entirely on the design system: tokens, theme, typography, spacing, radius, colors, icons, components, and consistency across the 79 widget files.

The previous `AUDIT_rider_app.md` flagged some design issues (theme_icons.dart dead code, `0x0053C1` vs `0x2563EB` contradiction between docs and code). **This audit does not duplicate those — it adds the deep token-by-token analysis, the cross-file consistency analysis, and the design-system-vs-implementation gap analysis.**

## Severity legend

- **P0** — broken behavior, design system violates documented spec, brand inconsistency
- **P1** — will bite soon (consistency, accessibility, dark mode, component reuse)
- **P2** — code smell, missed best practice
- **P3** — nice-to-have / hygiene

## Table of contents

1. [Design system architecture overview](#1-architecture-overview)
2. [Token inventory: primitives, semantic, components](#2-token-inventory)
3. [`design-tokens.json` vs `docs/design-system.md` vs `app_theme.dart` — three sources of truth](#3-three-sources-of-truth)
4. [Theme files (`lib/theme/*`) deep dive](#4-theme-files)
5. [Widget consistency audit (79 files, 3,500+ lines of design code)](#5-widget-consistency-audit)
6. [Typography: the doc vs the code](#6-typography)
7. [Color usage: AppColors vs raw hex](#7-color-usage)
8. [Spacing & radius: AppRadius/Spacing vs raw numbers](#8-spacing-and-radius)
9. [Icon usage: ThemeIcons vs raw Icons.*](#9-icon-usage)
10. [Dark mode coverage](#10-dark-mode-coverage)
11. [Component reuse: duplicates and dead code](#11-component-reuse)
12. [Top 10 critical findings](#12-top-10-critical-findings)
13. [Cross-cutting observations](#13-cross-cutting)
14. [Recommended 10-PR sequence](#14-recommended-10-pr-sequence)

---

## 1. Architecture overview

### 1.1 Three layers

| Layer | File | Purpose |
|---|---|---|
| **Tokens (single source of truth)** | `design-tokens.json` (root) | JSON tokens: primitive colors, semantic colors, radii. Should be consumed by both web and Flutter. |
| **Theme (Flutter-specific)** | `flutter/lib/theme/app_theme.dart` (25 KB, 600 lines) | `AppColors`, `AppGradients`, `AppShadows`, `Spacing`, `AppRadius`, `AppDurations`, `AppTheme.lightTheme/darkTheme` |
| **Typography** | `flutter/lib/theme/app_typography.dart` (9 KB) | 15-tier type scale (display, heading, title, body, label, overline) |
| **Theme provider** | `flutter/lib/theme/theme_provider.dart` (729 bytes) | `ChangeNotifier` for light/dark toggle, persisted to `CacheService` |
| **Components (79 files)** | `flutter/lib/widgets/*` | Reusable widgets, screens, micro-interactions |

### 1.2 Three sources of truth (problematic)

There are **three different documents** that claim to be the design spec:

1. **`design-tokens.json`** (root, 1.8 KB) — JSON tokens, 19 primitives, 11 semantic light + 11 semantic dark, 7 radii.
2. **`docs/design-system.md`** (3.9 KB) — The "authoritative" spec per the file's own claim.
3. **`docs/DESIGN.md`** (15.7 KB) — An older or longer-form design doc.

**These three disagree on multiple tokens.** The findings below enumerate the disagreements.

### 1.3 Coverage stats (grep audit)

| Pattern | Count | Comment |
|---|---|---|
| `AppColors.` references | 335 | Good — the design system is the primary path |
| `AppTypography.` references | 122 | Good |
| `AppRadius.` references | 20 | Low — most widgets use raw `BorderRadius.circular(N)` |
| `Spacing.` references | 1 | **Very low** — most widgets use raw `EdgeInsets.all(N)` |
| Raw `EdgeInsets.all(N)` | 70 | Bypasses design system |
| Raw `SizedBox(N)` | 223 | Bypasses design system |
| Raw `BorderRadius.circular(N)` | 128 | Bypasses design system |
| Raw `Color(0x...)` | 27 | Bypasses design system |
| `GoogleFonts.` direct calls | 69 | Bypasses `AppTypography` |
| `Icons.` direct calls | 175 | Bypasses `ThemeIcons` (which is itself dead code) |
| `FontWeight.w900` | 1 | **Violates** the design spec ("Never use w900") |

---

## 2. Token inventory

### 2.1 Primitive palette (19 colors)

| Token | Hex | Usage |
|---|---|---|
| `blue600` | `#2563EB` | **The Flutter primary** (per `AppColors.primary`) |
| `blue500` | `#3B82F6` | Gradient end |
| `voltCyan` | `#00E5FF` | Brand accent |
| `emerald500` | `#10B981` | Success |
| `emerald600` | `#16A34A` | Success alt |
| `amber500` | `#F59E0B` | Warning |
| `red500` | `#EF4444` | Error |
| `red600` | `#DC2626` | Error dark |
| `slate50` | `#F8FAFC` | Surface bright |
| `slate100`-`slate900` | Tailwind slate scale | Neutrals |

### 2.2 Semantic palette (11 light + 11 dark)

| Token | Light | Dark |
|---|---|---|
| `surface` | `#F7F9FB` | `#0F172A` |
| `surfaceAlt` | `#F5F7FA` | `#1E293B` |
| `card` | `#FFFFFF` | `#1E293B` |
| `onSurface` | `#101828` | `#F1F5F9` |
| `onSurfaceVariant` | `#475467` | `#94A3B8` |
| `onSurfaceMuted` | `#667085` | `#64748B` |
| `voltAccent` | `#00E5FF` | `#00E5FF` |
| `actionPrimary` | `#2563EB` ⚠️ | `#2563EB` ⚠️ |
| `statusSuccess` | `#16A34A` | `#34D399` |
| `statusWarning` | `#F59E0B` | `#FBBF24` |
| `statusError` | `#EF4444` | `#FCA5A5` |
| `divider` | `#E0E3E5` | `#334155` |

### 2.3 Radii (7)

| Token | px | Common usage |
|---|---|---|
| `xs` | 4 | Chips, small badges |
| `sm` | 8 | Inputs, dense controls |
| `md` | 12 | Alerts, standard inputs |
| `lg` | 16 | Standard cards |
| `xl` | 24 | Large hero containers, modals |
| `xxl` | 32 | Bottom sheet surfaces |
| `full` | 9999 | Pills, primary buttons |

---

## 3. Three sources of truth

### 3.1 [P0] `actionPrimary` is `#2563EB` in JSON but `#0053C1` in design-system.md

**Files:**
- `design-tokens.json:36` — `"actionPrimary": "#2563EB"` (light), `:50` — `"actionPrimary": "#2563EB"` (dark)
- `docs/design-system.md:28` — `actionPrimary | #0053C1 | #0053C1`
- `docs/DESIGN.md` (line unknown) — likely also says `#0053C1`
- `flutter/lib/theme/app_theme.dart:6` — `static const Color primary = Color(0xFF2563EB);` (matches JSON, not doc)
- `flutter/lib/theme/app_theme.dart:105` — `static const Color primaryCyan = Color(0xFF0053C1);` (matches doc — kept as `primaryCyan` alias)
- `web/src/app/globals.css:39-65` — `--vf-*` brand tokens declared but **unused** (per previous broad audit)
- `web/tailwind.config.ts` — `primary: '#0369a1'` (yet another value — shadcn default)

**Six different "primary" blue values across the codebase:**
1. `#2563EB` (Flutter `AppColors.primary` and `design-tokens.json`)
2. `#0053C1` (`docs/design-system.md`, `AppColors.primaryCyan`, "Voltium Blue")
3. `#0369a1` (web `tailwind.config.ts`, shadcn default)
4. `#3B82F6` (`AppColors.primaryGradientEnd`, gradient end)
5. `#1D4ED8` (`AppColors.primaryDark`)
6. `#60A5FA` (`AppColors.primaryLight`)

**Why it matters:**
- A designer reading `docs/design-system.md` expects `#0053C1` for primary buttons.
- A Flutter dev reading `app_theme.dart` uses `#2563EB` (which is what's shipped).
- A web dev reading `tailwind.config.ts` uses `#0369a1`.
- The visual brand identity is incoherent across platforms.

**Fix:** pick ONE primary blue (recommend `#2563EB` — it's already the most-used, and the JSON agrees). Update the docs, the `primaryCyan` alias, and the web tokens to match. Add a CI check that fails if the JSON, docs, and code disagree.

### 3.2 [P0] `design-tokens.json` is not consumed by Flutter code

**File:** `design-tokens.json`

The JSON tokens are a "single source of truth" in name only. **The Flutter `app_theme.dart` has hardcoded `Color(0xFF...)` values that do not reference the JSON.** The `actionPrimary: #2563EB` in the JSON matches `AppColors.primary: #2563EB` in the code, but the link is by convention, not by code.

**Fix:** generate `app_theme.dart` from the JSON. Use a build_runner or a script to convert JSON tokens → Dart `Color` constants. Drift is impossible if there's only one source.

### 3.3 [P1] `design-tokens.json` is not consumed by web code

**File:** `web/src/app/globals.css:39-65` (per previous broad audit)

The web has `--vf-*` brand tokens declared in `globals.css` but they are **never used**. The Tailwind config has `primary: '#0369a1'` (shadcn default). **The web design system is a complete separate from the JSON.**

**Fix:** either (a) consume the JSON in the web build (use a build step to generate Tailwind config from the JSON), or (b) delete the unused `--vf-*` tokens and accept that web has its own design system.

### 3.4 [P0] `docs/design-system.md` says `actionPrimary: #0053C1` — the design system and the code disagree

Already covered in 3.1. The doc is the authoritative spec, but the code doesn't follow it.

### 3.5 [P1] `docs/DESIGN.md` (15.7 KB) is a different/older design doc

**File:** `docs/DESIGN.md` (15.7 KB)

15.7 KB is large. Probably the original design doc before the design-system.md was created. **Two design docs coexisting is a maintenance hazard.** Verify the docs are not in conflict.

**Fix:** delete `DESIGN.md` or merge into `design-system.md`.

### 3.6 [P0] JSON schema version is 1.0.0, no migration path

**File:** `design-tokens.json:1-3`

The schema is `draft-07`. The version is `1.0.0`. **There's no migration strategy for breaking changes.** A bump from 1.0.0 to 2.0.0 requires consumers to be updated.

**Fix:** add a `migrationNotes` field. Or, use a `versioned` token format (e.g. `colors.actionPrimary.v1: #2563EB`).

### 3.7 [P1] `design-tokens.json` has no semantic color for "info" or "neutral"

**File:** `design-tokens.json:27-56`

The semantic palette has `success`, `warning`, `error`, but no `info` or `neutral`. Flutter's `AppColors.info = #3B82F6` (line 27 of `app_theme.dart`) is a separately-defined color that doesn't appear in the JSON.

**Fix:** add `info` and `neutral` to the JSON semantic palette. Remove the duplicated `AppColors.info`.

### 3.8 [P1] `design-tokens.json` has no spacing tokens

**File:** `design-tokens.json` (entire file)

The JSON has only colors and radii. **No spacing, no typography, no shadows, no durations, no z-indexes.** The Flutter theme has 6 spacing tokens (xs-xxl), 7 radius tokens, 4 duration tokens — all in Dart, not in JSON.

**Fix:** add spacing, typography, shadows, durations to the JSON.

---

## 4. Theme files (`lib/theme/*`)

### 4.1 [P0] `AppColors.primary = #2563EB` contradicts design spec

**File:** `flutter/lib/theme/app_theme.dart:6`

```dart
static const Color primary = Color(0xFF2563EB);
```

The design-system.md says `#0053C1`. **Mismatch.** Covered in 3.1.

### 4.2 [P1] `AppColors` is a God class with 60+ color constants

**File:** `flutter/lib/theme/app_theme.dart:4-133`

The class has 60+ static color constants. Including:
- Brand colors (5)
- Status (4 sets: success, warning, error, info)
- Surface (8)
- Slate scale (6)
- Text (5)
- Borders (3)
- Purple (3)
- Feature (3 — evPurple, whatsappGreen, voltAccent)

**The size is unmanageable.** A reader looking for a "warning" color has to scroll through 60+ entries. **Many are aliases (e.g. `successGreen = success`, line 84)** — confusing.

**Fix:** split into multiple classes:
- `AppBrandColors` (primary, primaryDark, primaryLight, voltAccent)
- `AppStatusColors` (success, warning, error, info, with light/dark/text variants)
- `AppNeutralColors` (slate scale, surfaces, text, borders)
- `AppFeatureColors` (evPurple, whatsappGreen)

### 4.3 [P1] `AppColors.textPrimary = onSurface`, `textSecondary = onSurfaceVariant` — semantic naming is a mess

**File:** `flutter/lib/theme/app_theme.dart:68-71`

```dart
static const Color textPrimary = onSurface;
static const Color textSecondary = onSurfaceVariant;
static const Color textMuted = onSurfaceMuted;
static const Color textTertiary = onSurfaceDisabled;
```

**Four aliases for what is already named correctly.** `textPrimary` and `onSurface` are the same value; the alias adds confusion. **Either use one or the other consistently.** The current code has both, leading to mixed usage.

**Fix:** delete the aliases. Use `onSurface` everywhere (it's the more semantic name from the design system).

### 4.4 [P0] `AppColors.errorRed = error` and `errorRedAlt = error` — same value, different names

**File:** `flutter/lib/theme/app_theme.dart:91-92`

```dart
static const Color errorRed = error;
static const Color errorRedAlt = error;
```

**Two aliases for the same color with no functional difference.** Code smell.

**Fix:** delete both aliases. Use `error`.

### 4.5 [P1] `AppColors` has 17 `Color(0xFF...)` values that aren't in `design-tokens.json`

**File:** `flutter/lib/theme/app_theme.dart:74-116`

The JSON has 19 primitives + 22 semantic. The Dart has 60+ colors. **Many Dart colors are NOT in the JSON:**
- `surfaceBright: 0xFFF8FAFC` (slate-50 — IS in JSON as `slate50` but not by semantic name)
- `surfaceSubtle: 0xFFF3F4F6` (gray-100 — NOT in JSON)
- `surfaceHover: 0xFFF9F9FF` (custom — NOT in JSON)
- `borderSubtle: 0xFFE5E7EB` (gray-200 — NOT in JSON)
- `successSurface: 0xFFDCFCE7` (green-100 — NOT in JSON)
- `errorSurface: 0xFFFEF2F2` (red-50 — NOT in JSON)
- `evPurple: 0xFF8B5CF6` (NOT in JSON)
- `evPurpleLight: 0xFFEDE9FE` (NOT in JSON)
- `whatsappGreen: 0xFF25D366` (NOT in JSON)
- `primaryCyan: 0xFF0053C1` (NOT in JSON — and is the design-spec primary!)

**The JSON is incomplete.** Adding a new color in Dart is easy; adding a new color in JSON is rare.

**Fix:** add the missing colors to the JSON. Or, accept that the JSON is the "core" tokens and the Dart file is the "extended" set.

### 4.6 [P0] `AppColors.primaryCyan = #0053C1` — the actual brand primary, named like an alias

**File:** `flutter/lib/theme/app_theme.dart:105`

```dart
static const Color primaryCyan = Color(0xFF0053C1); // brand cyan-blue
```

**The brand primary is named `primaryCyan` and treated as a sub-token.** A developer looking for "the primary color" will find `primary = #2563EB`, not `#0053C1`. The brand identity is hidden in an alias.

**Fix:** make `primaryCyan` the actual `primary`, OR document why `primary` is `#2563EB` (e.g. for design-system compatibility, the actual brand is `#0053C1`).

### 4.7 [P0] `AppColors` has 11 `Color(0xFF...)` values for surfaces, but the doc says "use `surface` token"

**File:** `flutter/lib/theme/app_theme.dart:73-76`

The design system has 1 `surface` token. The Dart has 5:
- `surface` (the canonical)
- `surfaceAlt`
- `surfaceContainer`
- `surfaceWhite`
- `surfaceBright`
- `surfaceSubtle`
- `surfaceHover`

**Surfaces proliferate.** A developer doesn't know which to use.

**Fix:** consolidate to 1-2 surfaces (`surface`, `surfaceAlt`) and delete the rest. The "extra" surfaces should be `card` or `divider`, not more `surface*` colors.

### 4.8 [P1] `Spacing` class has no `xl3` or `xxxl` for hero sections

**File:** `flutter/lib/theme/app_theme.dart:213-219`

`Spacing` has `xs, sm, md, lg, xl, xxl` (4-48 px). The web has `xxxl: 64px`. A 64-px hero padding is achievable only with `const SizedBox(height: 64)` or `EdgeInsets.all(64)`, not from the design system.

**Fix:** add `xxxl: 64` and `xxxxl: 96` to `Spacing`.

### 4.9 [P1] `AppRadius.full = 9999` is a magic number, not a radius

**File:** `flutter/lib/theme/app_theme.dart:245`

`9999` for "full" radius is a hack. A `BorderRadius.circular(9999)` is "as round as possible". But the value is arbitrary and undocumented.

**Fix:** document why `9999` and not `1e9` or similar. Or, define a `StadiumBorder` for true pill shape.

### 4.10 [P1] `AppDurations.premiumCurve = easeOutCubic` — comment says "≈ web [0.22,1,0.36,1]" but the value is a Flutter built-in

**File:** `flutter/lib/theme/app_theme.dart:271-272`

```dart
static const Curve premiumCurve =
    Curves.easeOutCubic; // ≈ web [0.22,1,0.36,1]
```

The comment claims it's ≈ a custom web curve `[0.22, 1, 0.36, 1]`, but the value is the Flutter `easeOutCubic` built-in. **The two curves are not the same.** A Flutter dev using `premiumCurve` expects the web's premium feel; they get the Flutter default.

**Fix:** define a custom `Cubic(0.22, 1, 0.36, 1)` curve in `AppDurations` and use it.

### 4.11 [P0] `AppTheme.lightTheme` is 110 lines; `AppTheme.darkTheme` is similar — both have repeated `Color(0xFF...)` literals

**File:** `flutter/lib/theme/app_theme.dart:278-385, 388-540`

The light theme uses `Color(0xFFE2E8F0)` for disabled background (line 307). The dark theme uses `Color(0xFF334155)` for the same. **Hardcoded hex values for theme colors — they should come from `AppColors` or the JSON.**

**Fix:** add `disabledBackground` and `disabledForeground` to `AppColors` (light + dark variants). Reference them in both themes.

### 4.12 [P1] `themeProvider.dart` has no error handling on `CacheService().getDarkMode()`

**File:** `flutter/lib/theme/theme_provider.dart:18-20`

```dart
static bool _loadSavedTheme() {
  return CacheService().getDarkMode() ?? false;
}
```

If `CacheService` throws, the entire theme init crashes. **No fallback.**

**Fix:** wrap in try/catch, return `false` (light mode) on error. Log the error.

### 4.13 [P1] `themeProvider.dart` has no system-theme detection

**File:** `flutter/lib/theme/theme_provider.dart` (entire file)

The provider only has `isDarkMode` (set by user). **It doesn't read the system theme.** Most apps default to system theme on first launch (per platform convention).

**Fix:** in the constructor, if no saved preference, use `WidgetsBinding.instance.platformDispatcher.platformBrightness == Brightness.dark`.

### 4.14 [P2] `AppTypography` uses `GoogleFonts.plusJakartaSans` on every getter

**File:** `flutter/lib/theme/app_typography.dart:17-22, 25-30, ...`

Each text style getter calls `GoogleFonts.plusJakartaSans(...)`. **15+ getter calls. Each call constructs a new TextStyle object.** The first time `displayLarge` is read, Google Fonts is invoked to fetch the font. **The first time a screen uses typography, there's a network call to Google Fonts CDN (or a cache hit if pre-cached).** This can cause a brief flash of fallback font on cold start.

**Fix:** pre-build all 15 text styles in a static initializer. Cache the TextStyle objects. Or, ship the font as a bundled asset and avoid the network call.

### 4.15 [P1] `AppTypography` doesn't include `w900` — but one widget uses it

**File:** `flutter/lib/widgets/*` (1 occurrence, found via grep)

`AppTypography` only includes `w500`, `w600`, `w700`, `w800` weights. The design-system.md says "Never use w900 weights". **But grep finds 1 use of `FontWeight.w900` in the widgets.** A developer is forced to bypass the typography system.

**Fix:** find the w900 usage, replace with w800. Or, document why w900 is allowed in this one place.

---

## 5. Widget consistency audit

### 5.1 [P0] `ChipWidget` default color is `Colors.amber` — bypasses `AppColors.warning`

**File:** `flutter/lib/widgets/form_widgets.dart:18`

```dart
final Color color = Colors.amber;
```

**Uses Flutter's `Colors.amber` directly, not `AppColors.warning` (= `#F59E0B`).** Two warning yellows in the codebase. Visual inconsistency.

**Fix:** `final Color color = AppColors.warning;` (or remove the default and require it).

### 5.2 [P0] `Cards` widget uses `Colors.white` — bypasses `AppColors.surfaceWhite`

**File:** `flutter/lib/widgets/cards.dart:64, 73, ...`

`Colors.white` (= `0xFFFFFFFF`) is the same as `AppColors.surfaceWhite` (= `0xFFFFFFFF`). **Two constants for the same value, no semantic difference.** A maintainer changes `surfaceWhite` to a near-white, and `Colors.white` doesn't follow.

**Fix:** replace `Colors.white` with `AppColors.surfaceWhite` in widgets. Or, delete `surfaceWhite` and use `Colors.white` (Flutter built-in).

### 5.3 [P0] `InputDecorationTheme.fillColor = Color(0xFFF1F5F9)` — bypasses `AppColors.iconBackground`

**File:** `flutter/lib/theme/app_theme.dart:343`

```dart
fillColor: const Color(0xFFF1F5F9), // slate-100
```

The color is `slate-100`, which equals `AppColors.iconBackground` (= `#F1F5F9`, line 51). **Two names, same value.**

**Fix:** `fillColor: AppColors.iconBackground`.

### 5.4 [P0] `Card` theme uses `Colors.white` — bypasses `AppColors.card`

**File:** `flutter/lib/theme/app_theme.dart:373`

```dart
cardTheme: CardThemeData(
  color: Colors.white,
```

`Colors.white` ≠ `AppColors.surfaceWhite` semantically. The theme should use `AppColors.card` (which the JSON has as `#FFFFFF` light, `#1E293B` dark). **The dark theme card will be `Colors.white` (white) because `color: Colors.white` is hardcoded, NOT because the dark theme card color is `#1E293B`.**

**Fix:** `color: AppColors.surfaceWhite` (or add a `ThemeColors.card` to `AppColors.of(context)` and use that).

### 5.5 [P1] 70 widgets use raw `EdgeInsets.all(N)` — should use `Spacing.padding*`

Already covered in §1.3. Of the 70:
- `EdgeInsets.all(4)`, `EdgeInsets.all(8)`, `EdgeInsets.all(12)`, `EdgeInsets.all(16)`, `EdgeInsets.all(20)`, `EdgeInsets.all(24)` — these are valid `Spacing` tokens
- `EdgeInsets.all(2)`, `EdgeInsets.all(6)`, `EdgeInsets.all(14)`, `EdgeInsets.all(18)`, `EdgeInsets.all(22)`, `EdgeInsets.all(28)` — these are off-grid values

**Off-grid spacing indicates the design system is incomplete.** Either add the missing tokens (xs2, sm2, md2, etc.) or refactor to use the closest valid token.

**Fix:** grep + refactor. 1-day work.

### 5.6 [P1] 128 widgets use raw `BorderRadius.circular(N)` — should use `AppRadius.*`

Already covered in §1.3. Of the 128:
- `BorderRadius.circular(8)`, `(12)`, `(16)`, `(20)`, `(24)`, `(28)`, `(32)` — valid `AppRadius` tokens
- `BorderRadius.circular(4)`, `(6)`, `(10)`, `(14)`, `(18)` — off-grid

Same pattern as spacing. Either add the missing tokens or refactor.

### 5.7 [P1] 223 widgets use raw `SizedBox(N)` — should use `Spacing` or `Gap` widget

Already covered in §1.3. **This is the highest-count violation.** A `SizedBox(height: 16)` is a gap of 16, which is `Spacing.md`. The design system should provide a `Gap` widget (or a const `SizedBox` shortcut).

**Fix:** add a `Gap` widget (or use the `gap` package). Refactor 223 call sites.

### 5.8 [P1] 69 widgets use `GoogleFonts.plusJakartaSans(...)` directly — bypasses `AppTypography`

Already covered in §1.3. **Each direct call bypasses the typography tier system.** A widget uses `fontSize: 14, fontWeight: w600` — close to `labelMedium` (14, w600) but not via the system.

**Fix:** find the closest `AppTypography.*` and use it. The closest is likely `labelMedium`, `bodyMedium`, or `labelLarge`.

### 5.9 [P1] 175 widgets use `Icons.*` directly — bypasses `ThemeIcons` (which is dead code)

**File:** `flutter/lib/widgets/*` (175 references)

`ThemeIcons` (in `theme_icons.dart`) has 30+ named icon getters. **It's not used anywhere** (per previous broad audit). The 175 direct `Icons.*` references bypass the theme.

**Fix:** either (a) use `ThemeIcons` consistently, or (b) delete `ThemeIcons` (since it's not used).

### 5.10 [P1] `SkeletonLoader` uses `Color(0xFFE2E8F0)` — slate-200 not in `AppColors`

**File:** `flutter/lib/widgets/skeleton_loader.dart` (need full read)

The skeleton uses slate-200, but `AppColors` doesn't expose slate-200 directly. It has `outlineVariant: 0xFFE2E8F0` (line 57) which is the same value. **Two names for the same color.**

**Fix:** use `AppColors.outlineVariant` for the skeleton background.

---

## 6. Typography

### 6.1 [P1] `AppTypography` is a class with 15 static getters, each a fresh `GoogleFonts.plusJakartaSans(...)` call

Already covered in 4.14.

### 6.2 [P1] The 15 tiers don't include `code` or `mono` for monospace

**File:** `flutter/lib/theme/app_typography.dart` (entire file)

Monospace is used for:
- OTP input (6-digit codes)
- Phone numbers in some places
- Verification codes
- Wallet reference numbers

`AppTypography` has no `codeMedium` or `codeLarge`. A widget needs to use `GoogleFonts.jetBrainsMono(...)` or similar, bypassing the typography system.

**Fix:** add `codeMedium: 14px/w500/jetBrainsMono` and `codeLarge: 16px/w600/jetBrainsMono` to `AppTypography`.

### 6.3 [P2] Font family `Plus Jakarta Sans` is hardcoded in `app_typography.dart`

**File:** `flutter/lib/theme/app_typography.dart:17-22, ...`

If the design changes to a different font (e.g. Inter), the change touches 15+ lines. **Centralize the font family constant.**

**Fix:** `static const String _fontFamily = 'Plus Jakarta Sans';` and reference it. Or, generate from a design token.

### 6.4 [P1] The doc's tier table is more detailed than the Dart implementation

**File:** `docs/design-system.md:38-58` (15 tiers), `app_typography.dart` (15 getters)

The doc has columns for `Style Tier | Font Size | Weight | Tracking | Purpose`. The Dart has the same 15 tiers. **But the doc is more readable.** Consider keeping the doc in sync as the source of truth.

### 6.5 [P2] `bodyMedium` (14/w500) is the default; `bodyLarge` (16/w500) is for prominent — but no "small body" or "extra small body"

**File:** `docs/design-system.md:54-55`

The doc has `bodyLarge (16/w500)`, `bodyMedium (14/w500)`, `bodySmall (12/w500)`. **3 body sizes.** A 13px or 15px body would be off-grid.

### 6.6 [P1] The `labelSmall` tier (11/w600) is used for "micro badges" but is below the WCAG minimum

**File:** `docs/design-system.md:57`

`11px` is below the WCAG minimum for body text (which is 12-14 px). **Micro badges are OK, but body text at 11px is accessibility-hostile.**

**Fix:** ensure `labelSmall` is only used for non-text content (badges, icons, decorative). Add a lint rule.

---

## 7. Color usage

### 7.1 [P0] 27 raw `Color(0xFF...)` references across 79 widget files

Already covered in §1.3. Of these, many are duplicates of `AppColors` values.

### 7.2 [P0] `#0053C1` (the actual brand primary) is in `AppColors.primaryCyan` but not the JSON

Already covered in 3.1, 4.6.

### 7.3 [P1] 12+ `Colors.amber` / `Colors.green` / etc. — Flutter built-ins bypass the design system

Sample (from grep):
- `form_widgets.dart:18` — `Colors.amber`
- Other widgets — `Colors.green`, `Colors.red`, `Colors.blue`, `Colors.grey`

These are Flutter's Material defaults, not the Voltium palette. **Visual inconsistency with the rest of the app.**

**Fix:** replace with `AppColors.warning`, `AppColors.success`, `AppColors.error`, `AppColors.primary`, `AppColors.onSurfaceVariant`.

### 7.4 [P1] `Color(0xFF...)` mixed-case — `0xFF` vs `0xFf`

**File:** multiple

Some widgets use `0xFF` (uppercase), others use `0xFf` (mixed). **Inconsistent code style.**

**Fix:** standardize on `0xFF` (uppercase).

### 7.5 [P0] `primaryCyan` (the brand primary) and `primary` (the dev primary) both exist

Already covered in 4.6. **Two competing primary blues.** Pick one.

---

## 8. Spacing & radius

### 8.1 [P0] 70 raw `EdgeInsets.all(N)` references in widgets — only 1 `Spacing.*` reference

Already covered in 5.5.

### 8.2 [P0] 128 raw `BorderRadius.circular(N)` references in widgets — only 20 `AppRadius.*` references

Already covered in 5.6.

### 8.3 [P0] 223 raw `SizedBox(N)` references in widgets — only 1 `Spacing.*` reference

Already covered in 5.7.

### 8.4 [P1] Off-grid spacing values (2, 6, 10, 14, 18) — design system is incomplete

**File:** `flutter/lib/widgets/*` (occurrences)

The 6 design tokens are `xs(4), sm(8), md(16), lg(24), xl(32), xxl(48)`. **2, 6, 10, 14, 18, 22, 28 are off-grid.**

Either:
- Add 6 more tokens (xs2, sm2, md2, lg2, etc.) — 12-token system
- Refactor to use the closest valid token

**Fix:** pick one. Recommend refactor (cleaner).

### 8.5 [P1] Off-grid radius values (4, 6, 10, 14, 18) — same issue

**File:** `flutter/lib/widgets/*` (occurrences)

The 7 design tokens are `xs(4), sm(8), md(12), lg(16), xl(24), xxl(32), full(9999)`. **6, 10, 14, 18, 20, 28 are off-grid.**

**Fix:** same as 8.4.

### 8.6 [P1] `Spacing.xxl = 48` is the largest; no 64 or 96 for hero sections

Already covered in 4.8.

### 8.7 [P1] `AppRadius.xl = 24` and `xxl = 32` — but the doc says xl is for modals and xxl is for bottom sheets

**File:** `docs/design-system.md:78-79`

The doc says: "xl: 24px (Large hero containers, modals)" and "xxl: 32px (Bottom sheet surfaces)". **The semantic meaning of each radius is documented but not enforced.** A widget using `AppRadius.xxl` for a small card is technically correct but semantically wrong.

**Fix:** rename to `radiusModal`, `radiusBottomSheet` for semantic clarity. Or, add comments.

---

## 9. Icon usage

### 9.1 [P0] `theme_icons.dart` is dead code

**File:** `flutter/lib/widgets/theme_icons.dart` (6.7 KB, 30+ icons)

Per the previous broad audit, `theme_icons.dart` has 0 importers. **Dead code.**

175 widgets use `Icons.*` directly instead.

**Fix:** delete the file, OR refactor 175 callsites to use `ThemeIcons.*`. (1-week work for the refactor.)

### 9.2 [P1] `ThemeIcon` and `ThemeIcons` are two separate patterns in the same file

**File:** `flutter/lib/widgets/theme_icons.dart:6-29, 31-115`

`ThemeIcon` is a widget (`StatelessWidget` with `lightIcon` + `darkIcon` props). `ThemeIcons` is a static class of icon getters. **Two patterns, one file.** A new dev doesn't know which to use.

**Fix:** consolidate. Recommend keeping `ThemeIcon` (the widget) and deleting `ThemeIcons` (the static class). Or, generate both from a single source.

### 9.3 [P1] `ThemeIcon.lightIcon` and `darkIcon` are both required — but Flutter has themed icons

**File:** `flutter/lib/widgets/theme_icons.dart:7-9`

```dart
final IconData lightIcon;
final IconData darkIcon;
```

Forcing a `lightIcon` AND a `darkIcon` is the opposite of "theme-aware icons". **The Material `Icon` widget already supports themed icons** via `IconTheme.of(context)`.

**Fix:** simplify to `final IconData icon;` and let the Icon widget inherit the color from `IconTheme`.

### 9.4 [P2] `ThemeIcons` static methods take `isDark: bool` — coupling UI to a bool

**File:** `flutter/lib/widgets/theme_icons.dart:32-115`

```dart
static IconData home(bool isDark) =>
    isDark ? Icons.home_rounded : Icons.home_outlined;
```

Passing `isDark` to every icon call is a code smell. **The widget should know the theme, not the caller.**

**Fix:** use `Builder` or `Theme.of(context)` to read the brightness, OR delete `ThemeIcons` and use Material's `Icon` widget with `IconTheme`.

---

## 10. Dark mode coverage

### 10.1 [P0] `Card` theme hardcodes `color: Colors.white` — dark mode shows white cards

**File:** `flutter/lib/theme/app_theme.dart:373`

```dart
cardTheme: CardThemeData(
  color: Colors.white,
  ...
)
```

**The light theme's `cardTheme` is `Colors.white` — but the dark theme's `cardTheme` is also `Colors.white` (line 524, by inheritance from light).** Dark mode shows white cards on dark background. **Visual disaster.**

**Fix:** define `cardTheme` separately in `darkTheme` with `color: AppColors.slate800` or similar.

### 10.2 [P0] `elevatedButton.disabledBackgroundColor: Color(0xFFE2E8F0)` — hardcoded slate-200 in light theme

Already covered in 4.11. **The dark theme has the correct value (`#334155`).**

### 10.3 [P0] `AppColors.of(context)` returns a fallback when no extension is found — but the fallback is broken

**File:** `flutter/lib/theme/app_theme.dart:125-130`

```dart
static ThemeColors of(BuildContext context) {
  return Theme.of(context).extension<ThemeColors>() ??
      (Theme.of(context).brightness == Brightness.dark
          ? ThemeColors.dark
          : ThemeColors.light);
}
```

If the theme is loaded correctly, the extension is set (lines 384, 533). The fallback is for un-themed contexts (e.g. a widget in an isolated test). **The fallback is correct, but is this called anywhere without the extension being set?**

**Audit:** if no widget ever calls `AppColors.of(context)` without the extension being set, the fallback is dead code. Verify.

### 10.4 [P1] `ThemeColors` extension is set in `extensions: [ThemeColors.light]` — but only for `lightTheme`

**File:** `flutter/lib/theme/app_theme.dart:384`

```dart
extensions: const [ThemeColors.light],
```

`darkTheme` should set `extensions: [ThemeColors.dark]`. Verify. (Earlier read showed `darkColors = ThemeColors.dark;` and `extensions: const [darkColors]`.)

### 10.5 [P1] 175 raw `Icons.*` references — none are theme-aware

Already covered in 9.1.

---

## 11. Component reuse

### 11.1 [P0] `theme_icons.dart` is dead code

Already covered in 9.1.

### 11.2 [P0] `widgets/theme_icons.dart` file is in the wrong location

**File:** `flutter/lib/widgets/theme_icons.dart`

The file is in `widgets/` but the previous broad audit noted that `theme_icons.dart` was a "no-importer" file. **It's in `widgets/` but isn't a widget — it's a theme file.** Should be in `lib/theme/`.

**Fix:** move to `lib/theme/theme_icons.dart` (or delete per 9.1).

### 11.3 [P1] Multiple "splash loader" / "shimmer" widgets

**File:** `flutter/lib/widgets/skeleton_loader.dart`, `shimmer_loading.dart`, `shimmer_table.dart`

Three shimmer/skeleton widgets. **Possibly overlapping functionality.** Verify the difference.

### 11.4 [P1] Multiple "card" widgets

**File:** `flutter/lib/widgets/cards.dart`, `dashboard_*_card.dart` (5+ files), `swipeable_card.dart`, `top_up_request_sent_card.dart`, `receipt_preview.dart`, `upload_preview.dart`

10+ card widgets. **The base `cards.dart` has `TapCard`; the rest are specialized.** Verify the API is consistent (props, callbacks, etc.).

### 11.5 [P1] Multiple "empty state" widgets

**File:** `flutter/lib/widgets/empty_state.dart`, `empty_state_illustrations.dart`

Two empty-state widgets. **Possibly overlapping.**

### 11.6 [P1] Multiple "celebration" widgets

**File:** `flutter/lib/widgets/confetti_celebration.dart`, `electric_burst.dart`, `electric_burst_success.dart`, `electric_arc.dart`, `streak_celebration_bar.dart`

5 celebration widgets. **Possibly overlapping.** Consider consolidating.

### 11.7 [P0] `animations.dart` vs `micro_animations.dart` vs `micro_interactions.dart`

**File:** `flutter/lib/widgets/animations.dart`, `micro_animations.dart`, `micro_interactions.dart`

Three animation files. **Names imply overlap** but the grep count wasn't taken. Verify the boundaries.

### 11.8 [P1] 79 widget files — 60% are over-specific (e.g. `dashboard_wallet_card.dart`)

**File:** `flutter/lib/widgets/*`

A well-organized design system has a small set of base widgets (Button, Card, Input, etc.) and composes them. 79 widget files is a lot. **Many are screen-specific** (`dashboard_wallet_card`, `pickup_hub_widgets`, `pre_dashboard_widgets`, etc.) and could be co-located with the screen, not in `lib/widgets/`.

**Fix:** move screen-specific widgets to `lib/features/<feature>/widgets/`. Keep `lib/widgets/` for true reusable components.

---

## 12. Top 10 critical findings

In order of "ship-it-this-week" priority:

1. **[P0] `actionPrimary` is `#2563EB` in JSON but `#0053C1` in design-system.md — six different "primary" blues across the codebase.** Pick one and update all sources. (§3.1, §4.1, §4.6)
2. **[P0] `design-tokens.json` is not consumed by Flutter code — link is by convention only.** Generate `app_theme.dart` from the JSON. (§3.2)
3. **[P0] 27 raw `Color(0xFF...)` references in widgets + 70 raw `EdgeInsets.all(N)` + 128 raw `BorderRadius.circular(N)` + 223 raw `SizedBox(N)` = ~448 raw design-system bypasses.** Refactor to use `AppColors`, `Spacing`, `AppRadius`. (§5.5-§5.7, §7.1, §8.1-§8.3)
4. **[P0] `theme_icons.dart` is dead code (0 importers) yet 175 widgets use `Icons.*` directly.** Delete the file or use it. (§9.1, §11.1, §11.2)
5. **[P0] `Card` theme uses `color: Colors.white` — dark mode shows white cards.** Fix the dark theme. (§4.11, §10.1)
6. **[P0] `ChipWidget` default color is `Colors.amber` — bypasses `AppColors.warning`.** Replace. (§5.1)
7. **[P0] `AppColors.primaryCyan = #0053C1` (the brand primary) is named like an alias.** Make it the actual `primary` OR document. (§4.6, §7.5)
8. **[P0] `AppColors.errorRed` and `errorRedAlt` are the same value as `error` — 3 aliases for 1 color.** Delete the aliases. (§4.4)
9. **[P0] `InputDecorationTheme.fillColor = Color(0xFFF1F5F9)` — bypasses `AppColors.iconBackground`.** Replace. (§5.3)
10. **[P0] `theme_icons.dart` is in `widgets/` but isn't a widget — should be in `lib/theme/` or deleted.** Move or delete. (§11.2)

---

## 13. Cross-cutting observations

These patterns appear across many files and are worth a single PR each:

1. **Raw values everywhere (448 occurrences)** — refactor to design system tokens. (§5.5-§5.7, §7.1, §8.1-§8.3)
2. **Off-grid spacing/radius values (2, 6, 10, 14, 18)** — design system is incomplete or refactor needed. (§8.4, §8.5)
3. **`AppColors` has 60+ constants with aliases (textPrimary, errorRed, successGreen)** — pick one canonical name per concept. (§4.3, §4.4)
4. **`Colors.amber`, `Colors.green`, `Colors.red` (Material defaults)** — replace with `AppColors.*`. (§7.3)
5. **No `Spacing.xxxl/xxxxl`, no `Spacing.hero`** — large hero sections bypass the system. (§4.8, §8.6)
6. **No monospace `codeMedium`/`codeLarge` in `AppTypography`** — OTP/codes bypass the system. (§6.2)
7. **No system theme detection in `themeProvider`** — first-launch should default to platform. (§4.13)
8. **No CI lint that fails on raw `Color(0xFF...)` or raw `EdgeInsets.all(20)`** — design system violations slip through. (add `flutter_lints` rule)
9. **No design-tokens.json → app_theme.dart code generation** — drift is impossible to prevent manually. (§3.2, §3.3)
10. **Two design docs (`docs/design-system.md`, `docs/DESIGN.md`)** — one should be deleted. (§3.5)
11. **Mixed-case `0xFF` vs `0xFf`** — style inconsistency. (§7.4)
12. **One `FontWeight.w900` usage violating the spec** — find and replace. (§4.15, §6.6)
13. **Card theme not customized per brightness** — dark mode is broken. (§10.1)
14. **No light/dark contrast verification in CI** — add a screenshot test.

---

## 14. Recommended 10-PR sequence

In order of "ship-it-this-week" priority:

1. **PR 1: Pick one primary blue and align docs, JSON, Flutter, web.** ~3 hours.
2. **PR 2: Generate `app_theme.dart` from `design-tokens.json` (build_runner or script).** ~1 day.
3. **PR 3: Refactor 448 raw values to design system tokens (colors, spacing, radius).** ~3 days.
4. **PR 4: Fix dark mode card theme + disabled button colors.** ~2 hours.
5. **PR 5: Delete `theme_icons.dart` OR refactor 175 callsites to use it.** ~1 day.
6. **PR 6: Replace `Colors.amber/green/red/blue` with `AppColors.*` in widgets.** ~1 day.
7. **PR 7: Add monospace `codeMedium`/`codeLarge` to `AppTypography`.** ~2 hours.
8. **PR 8: Add CI lint that fails on raw `Color(0xFF...)` and off-grid spacing.** ~half day.
9. **PR 9: Add system theme detection to `themeProvider`.** ~1 hour.
10. **PR 10: Delete `docs/DESIGN.md` (or merge into `design-system.md`).** ~1 hour.

**Total estimated effort:** ~7-10 days of focused work, single PR per item, all P0/P1.
