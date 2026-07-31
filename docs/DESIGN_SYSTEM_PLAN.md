# Voltium — Design System Remediation Plan

**Date:** 2026-07-29
**Source:** `docs/AUDIT_DESIGN_SYSTEM.md` (50+ findings, ~47 KB)
**Scope:** `flutter/lib/theme/*` (3 files), `flutter/lib/widgets/*` (79 files), `design-tokens.json`, `docs/design-system.md`, `docs/DESIGN.md`
**Total findings:** 53 (15 P0, 26 P1, 9 P2, 3 P3)
**Already done:** ~5 items (from Phase 1/3/7)
**Total estimated effort:** ~12 focused days across 7 PRs

> **Read this first.** This plan turns the raw audit findings into review-ready PRs. Each PR is small, has explicit acceptance criteria, and ships a single, verifiable change.
>
> **The big win:** the audit's #1 finding (six different "primary" blues across the codebase) is **already half-fixed** by the Phase 7 work — Flutter now uses `#0053C1` to match the docs. The remaining drift is `design-tokens.json` (still says `#2563EB`) and `tailwind.config.ts` (uses CSS vars from `--color-vf-primary`, which IS `#0053C1`). One more PR closes the loop.

---

## What's already done (Phase 1, 3, 7)

| Audit ref | Item | Where it was fixed |
|---|---|---|
| 3.1, 4.1, 4.6, 7.5, 7.2 (partial) | `AppColors.primary` aligned to `#0053C1`; `primaryCyan` is now a deprecation alias | Phase 7 (Q1) — `flutter/lib/theme/app_theme.dart:6` |
| 3.3 (partial) | `--vf-*` brand tokens now wired in `web/src/app/globals.css` (lines 46-62); `--color-vf-primary: #0053c1` | Phase 3 |
| 8.1 (web side) | `docs/design-system.md` and `docs/DESIGN.md` now agree on `#0053C1` as brand primary | Phase 3 + Phase 7 |
| 10.4 | `extensions: [ThemeColors.dark]` is correctly set in `darkTheme` (line 491) | already in code (was a worry) |
| 2.7 (custom) | `theme_icons.dart` flagged in Phase 3 dead-code cleanup — but **file still exists** | partial: identified, not removed |

**Net for this plan:** ~53 audit findings, ~5 already done, ~48 remaining. Of those, ~10 are P0 and **the most important one (6 different primary blues) is mostly fixed**.

---

## Total scope

| Severity | Audit count | Already done | Remaining in this plan | Total effort |
|---|---|---|---|---|
| P0 | 15 | ~3 | **12** | ~5 days |
| P1 | 26 | ~2 | 24 | ~5 days |
| P2 | 9 | 0 | 9 | ~1.5 days |
| P3 | 3 | 0 | 3 | ~0.5 day |
| **Total** | **53** | **~5** | **~48** | **~12 days** |

Two months ≈ 18-20 working days per contributor. **All P0s are shippable inside the runway** if started now.

---

## Sequencing principle

Each PR is **independently deployable**. None depend on a future PR. Order is by **risk (lowest first) so we ship easy wins while the harder ones cook**.

**Lowest-risk PRs** (script/config, no UI changes):
- PR-1: Align `design-tokens.json` primary to `#0053C1` (5 min, no code)
- PR-2: Delete `theme_icons.dart` dead code (already 0 importers) (5 min)
- PR-3: Delete the 5 alias duplicates in `AppColors` (1 hr, mechanical)

**Medium-risk PRs** (UI changes, low visual risk):
- PR-4: Replace `Colors.amber/green/red/blue/grey` with `AppColors.*` (~30+ sites)
- PR-5: Fix dark-mode card theme bug + disabled button color

**Highest-risk PRs** (large refactors, requires careful review):
- PR-6: Refactor 448 raw values to design system tokens (multi-day)
- PR-7: Add monospace `codeMedium`/`codeLarge` to typography + replace 9 `FontWeight.w900` usages

---

# The plan: 7 PRs

## PR-1 — Align `design-tokens.json` to `#0053C1` (close the primary-color loop)

**Effort:** 5 minutes
**Risk:** zero (data file, no app behavior change)
**Audit ref:** 3.1 (residual)
**Blocks:** the design-token CI check (if/when added) would fail until this ships

### Problem

The `actionPrimary` color in `design-tokens.json` is `#2563EB` (light + dark). The Flutter code, web CSS, and docs all say `#0053C1`. **One file out of sync.**

### Current state

```json
// design-tokens.json:36, 50
"actionPrimary": "#2563EB",   // light
"actionPrimary": "#2563EB",   // dark
```

### Fix

```json
// design-tokens.json:36, 50
"actionPrimary": "#0053C1",   // light
"actionPrimary": "#0053C1",   // dark
```

### Acceptance criteria

- [ ] `grep "actionPrimary" design-tokens.json` shows `#0053C1` in both light and dark
- [ ] `npx tsx scripts/check-design-tokens.ts` (if/when added in PR-7) passes
- [ ] No app behavior changes (JSON is a data file)

### Reviewer focus

- Is this the only out-of-sync token? (Run a JSON-vs-Dart diff to confirm.)

### Rollback

Revert the file change.

---

## PR-2 — Delete `flutter/lib/widgets/theme_icons.dart` (dead code)

**Effort:** 5 minutes
**Risk:** zero (file is unused; `flutter analyze` already passed in Phase 7)
**Audit ref:** 9.1, 11.1, 11.2
**Blocks:** nothing — the audit flagged it; nobody imports it

### Problem

`flutter/lib/widgets/theme_icons.dart` (6.7 KB, 30+ named icons) has **zero importers**. The 175 `Icons.*` references in widgets bypass it entirely. The file is in `widgets/` but isn't a widget — it's a theme file in the wrong place.

### Decision

**Delete, don't refactor.** Refactoring 175 callsites to use `ThemeIcons` is a 1-week job that the audit itself rates as P1. The dead code is worse than the refactor (it's actively misleading to new devs). Delete now; refactor later if the team decides they want it.

### Fix

```bash
mavis-trash flutter/lib/widgets/theme_icons.dart
```

Verify no importers:
```bash
grep -r "theme_icons\|ThemeIcon" flutter/lib | grep -v "//" | wc -l
# Expected: 0
```

If any test files import it, update them too. (None do per the audit.)

### Acceptance criteria

- [ ] `flutter/lib/widgets/theme_icons.dart` is gone
- [ ] `grep -r "theme_icons\|ThemeIcon\b" flutter/` returns 0 non-comment matches
- [ ] `flutter analyze flutter/lib/**` still clean (0 issues)
- [ ] No `flutter test` regressions

### Reviewer focus

- Confirm the file is truly unused (no test imports, no dynamic imports).
- Confirm the deletion doesn't break any IDE autocompletion or analysis.

### Rollback

Restore the file from git history.

---

## PR-3 — Delete alias duplicates in `AppColors` (single source of truth)

**Effort:** 1 hour
**Risk:** low (renaming public API; need to verify all call sites)
**Audit ref:** 4.3, 4.4

### Problem

`AppColors` has 3 sets of aliases for the same values:
- `textPrimary` = `onSurface`, `textSecondary` = `onSurfaceVariant`, `textMuted` = `onSurfaceMuted`, `textTertiary` = `onSurfaceDisabled` (4 aliases for 4 actual values)
- `errorRed` = `error`, `errorRedAlt` = `error` (2 aliases for 1 value)
- `successGreen` = `success` (1 alias)

Plus from Phase 7: `primaryCyan` = `primary` (already deprecated, removal scheduled for v2.0.0).

**Code smell:** 3 different names for the same color. A maintainer changes `error` and `errorRed` doesn't follow. A designer asks "where's textPrimary?" and gets pointed to `onSurface` — same value.

### Fix

Step 1: find all call sites of the aliases (the audit's grep was a snapshot; verify against the current code).
```bash
grep -rn "AppColors\.textPrimary\|AppColors\.textSecondary\|AppColors\.textMuted\|AppColors\.textTertiary" flutter/lib/
grep -rn "AppColors\.errorRed\|AppColors\.errorRedAlt" flutter/lib/
grep -rn "AppColors\.successGreen" flutter/lib/
```

Step 2: replace each call site with the canonical name:
- `textPrimary` → `onSurface`
- `textSecondary` → `onSurfaceVariant`
- `textMuted` → `onSurfaceMuted`
- `textTertiary` → `onSurfaceDisabled`
- `errorRed`, `errorRedAlt` → `error`
- `successGreen` → `success`

Step 3: delete the alias lines in `app_theme.dart`.

### Acceptance criteria

- [ ] `grep -rn "AppColors\.textPrimary\|AppColors\.textSecondary\|AppColors\.textMuted\|AppColors\.textTertiary\|AppColors\.errorRed\|AppColors\.errorRedAlt\|AppColors\.successGreen" flutter/lib/` returns 0 matches
- [ ] `AppColors` class is shorter by 7 lines
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] No visual regression (text and error colors are identical to before)

### Reviewer focus

- Are all call sites using the alias names, or are some using the canonical names already? (Mixed usage is expected; this normalizes them.)
- Is there any documentation, comment, or test that references the alias names? (Update if so.)

### Rollback

Revert the PR.

---

## PR-4 — Replace `Colors.amber/green/red/blue/grey` with `AppColors.*` (Material defaults bypass)

**Effort:** 1 day
**Risk:** low-medium (visual change; need to verify each replacement matches the intent)
**Audit ref:** 5.1, 7.3

### Problem

15+ widget files use Flutter's Material `Colors.amber`, `Colors.green`, `Colors.red`, `Colors.blue`, `Colors.grey` directly. The Voltium palette uses `#F59E0B` (warning), `#10B981` (success), `#EF4444` (error), `#0053C1` (primary) — slightly different hues from Material defaults. **Visual inconsistency across the app.**

Known call sites from the grep audit:
- `flutter/lib/widgets/animated_bottom_nav.dart:273` — `Colors.red` (error indicator)
- `flutter/lib/widgets/battery_charge_indicator.dart:65, 67` — `Colors.red`, `Colors.amber` (battery level)
- `flutter/lib/widgets/cached_image.dart:65` — `Colors.grey` (placeholder icon)
- `flutter/lib/widgets/confetti_celebration.dart:17-19` — `Colors.red, green, blue` (confetti)
- `flutter/lib/widgets/dialogs.dart:24` — `Colors.red` (destructive button text)
- `flutter/lib/widgets/display_widgets.dart:35, 148, 197, 198, 237, 238, 287` — 7 uses of Material defaults (chart colors, accent colors)
- `flutter/lib/widgets/form_widgets.dart:18` — `ChipWidget` default color (the audit's example)

### Fix

For each call site, replace with the semantic `AppColors.*` equivalent:

| Current | Replace with |
|---|---|
| `Colors.red` (error) | `AppColors.error` |
| `Colors.amber` (warning) | `AppColors.warning` |
| `Colors.green` (success) | `AppColors.success` |
| `Colors.blue` (info / link) | `AppColors.primary` or `AppColors.info` |
| `Colors.grey` (neutral) | `AppColors.onSurfaceVariant` |
| `Colors.white` (text on color) | `Colors.white` (Material built-in is fine; not a "color of the brand" case) |

**Special case:** `confetti_celebration.dart:17-19` — the 3 confetti colors are decorative. Recommend keeping them as Material defaults for variety (confetti is supposed to be random multi-color), OR switching to a curated `AppColors.celebration*` set. Product decision.

### Acceptance criteria

- [ ] `grep -rn "Colors\.amber\|Colors\.green\|Colors\.red\|Colors\.blue\|Colors\.grey" flutter/lib/widgets/ flutter/lib/features/` returns 0 matches (or only the confetti file, with a product-approved exception comment)
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] Visual diff: each replaced widget looks identical to before (the Voltium palette is close to Material, so the change is small)
- [ ] No regression in the 33 E2E tests

### Reviewer focus

- The 7 replacements in `display_widgets.dart` are the biggest. Are the chart/indicator colors truly "warning" / "error" / "neutral" semantically, or are they intentional decorative choices?
- The confetti exception needs a product call (keep Material or migrate to palette).
- `Colors.white` is **not** on the list — it's a Material constant for "white", and we want pure white for text on color buttons. Don't migrate that.

### Rollback

Revert the PR.

---

## PR-5 — Fix dark-mode card theme bug + disabled button color

**Effort:** 2 hours
**Risk:** low (small change; visible difference in dark mode only)
**Audit ref:** 4.11, 5.3, 5.4, 10.1, 10.2

### Problem

Three theme bugs in dark mode:
1. **Card theme hardcodes `color: Colors.white`** in both light and dark themes (`app_theme.dart:368, 479`). In dark mode, cards are bright white on a dark background. Visual disaster.
2. **`elevatedButton.disabledBackgroundColor: Color(0xFFE2E8F0)`** in light theme — hardcoded slate-200, no semantic name. The dark theme has the correct `#334155`. **Light and dark themes should reference the same semantic token, not duplicate hex values.**
3. **`InputDecorationTheme.fillColor: Color(0xFFF1F5F9)`** — hardcoded slate-100, should be `AppColors.iconBackground` (the same value with a semantic name).

### Fix

**Fix 1: Card theme per brightness**
```dart
// app_theme.dart
// Light theme (line 368)
cardTheme: CardThemeData(
  color: AppColors.card,  // = #FFFFFF light, #1E293B dark via ThemeColors
  // ...
),

// Dark theme (line 479)
cardTheme: CardThemeData(
  color: AppColors.card,  // same reference; resolves to #1E293B in dark
  // ...
),
```

The cleanest fix is to read from `ThemeColors` (the `ThemeExtension`) so the same `AppColors.card` reference resolves to different values per brightness.

**Fix 2: Disabled button colors**
```dart
// Add to AppColors:
static const Color disabledBackgroundLight = Color(0xFFE2E8F0);
static const Color disabledBackgroundDark = Color(0xFF334155);
static const Color disabledForegroundLight = Color(0xFF94A3B8);
static const Color disabledForegroundDark = Color(0xFF64748B);

// Or: add to ThemeColors extension so brightness is automatic
```

**Fix 3: InputDecorationTheme fillColor**
```dart
// app_theme.dart:343, 451
fillColor: AppColors.iconBackground,  // = #F1F5F9 (was hardcoded)
```

### Acceptance criteria

- [ ] Dark mode shows dark cards (`#1E293B`), not white
- [ ] Disabled buttons use semantic colors (not hardcoded hex)
- [ ] Input fields use `AppColors.iconBackground` (not hardcoded hex)
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] Visual: open the app in dark mode, navigate to any screen with cards, verify they look dark
- [ ] Device test per `docs/DEVICE_TEST_PLAYBOOK.md` Section 8.3 (App settings → toggle dark)

### Reviewer focus

- Does the existing `AppColors.card` exist with a dark variant? (Check the `ThemeColors` extension — it has `card: Color(0xFFFFFFFF)` light and `card: Color(0xFF1E293B)` dark. Use that.)
- Is the disabled-foreground color (`#94A3B8` light, `#64748B` dark) the right one? Verify against the existing palette.

### Rollback

Revert the PR.

---

## PR-6 — Refactor 448 raw values to design system tokens (the big one)

**Effort:** 3 days
**Risk:** **medium-high** (448 sites; mechanical but tedious; some sites may be off-grid and need design decisions)
**Audit ref:** 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 7.1, 8.1, 8.2, 8.3, 8.4, 8.5

### Problem

The audit's biggest single P0: 448 widget sites bypass the design system:
- **70** `EdgeInsets.all(N)` (should use `Spacing.*`)
- **128** `BorderRadius.circular(N)` (should use `AppRadius.*`)
- **223** `SizedBox(N)` (should use `Spacing.*` or a `Gap` widget)
- **27** `Color(0xFF...)` (should use `AppColors.*`)

Plus the 175 `Icons.*` direct calls (audit 9.1; deferred — see "What NOT in this plan").

### Step 1: Catalog the off-grid values

Grep the actual values to know what we're dealing with:
```bash
grep -roh "EdgeInsets.all(\d\+)" flutter/lib/ | sort -u
grep -roh "BorderRadius.circular(\d\+)" flutter/lib/ | sort -u
grep -roh "SizedBox(height: \d\+)\|SizedBox(width: \d\+)" flutter/lib/ | sort -u
```

Likely off-grid values: 2, 6, 10, 14, 18, 20, 22, 28 (spacing) and 6, 10, 14, 18, 20, 28 (radius).

### Step 2: Decide on-grid vs off-grid

For each off-grid value, pick one:
- **Refactor to on-grid** (recommended): change `EdgeInsets.all(6)` to `EdgeInsets.all(Spacing.xs)` (closest is 4 — accept the 2px visual difference)
- **Add to the system**: introduce `Spacing.xs2 = 6` as a new token

**Audit's recommendation: refactor.** Off-grid values indicate the design system was incomplete; better to commit to the 6/7-token scale than to expand it.

### Step 3: Mechanical refactor (3 sub-tasks)

**3a. Spacing (70 sites):**
```dart
// Before
EdgeInsets.all(8)   → EdgeInsets.all(Spacing.sm)
EdgeInsets.all(16)  → EdgeInsets.all(Spacing.md)
EdgeInsets.all(24)  → EdgeInsets.all(Spacing.lg)
EdgeInsets.symmetric(horizontal: 8, vertical: 16)  → keep as is OR
                                                       add Spacing.horizontalMd helper
```

**3b. Radius (128 sites):**
```dart
// Before
BorderRadius.circular(8)   → BorderRadius.circular(AppRadius.sm)
BorderRadius.circular(12)  → BorderRadius.circular(AppRadius.md)
BorderRadius.circular(16)  → BorderRadius.circular(AppRadius.lg)
```

**3c. SizedBox (223 sites):**
The most common. Add a `Gap` widget (or use the `gap` package) for horizontal/vertical gaps:
```dart
// Before
SizedBox(height: 16)  → Gap(Spacing.md)
SizedBox(width: 8)    → Gap(Spacing.sm, axis: Axis.horizontal)
```

**3d. Color (27 sites):**
The bulk of these should already be `AppColors.*` per PR-4. The remaining 12+ are likely:
- `Color(0xFFA7F3D0)` (emerald-200) — should be a new `AppColors.successLight` token if it appears in multiple files
- `Color(0xFF991B1B)` (red-800) — should be `AppColors.errorDark` if it appears in multiple files
- `Color(0xFFFFE082)` (amber-200) — should be `AppColors.warningLight`
- `Color(0xFFFFF7ED)` (orange-50) — should be a new `AppColors.warningSurfaceAlt` or `AppColors.infoSurface`
- `Color(0xFFEA580C)` (orange-600) — should be `AppColors.warningDark`
- `Color(0xFFBBF7D0)` (green-200) — should be a new `AppColors.successLightAlt`

Each unique off-system hex: count occurrences, add to `AppColors` only if used in 3+ files. Otherwise, refactor the site to use the closest existing `AppColors.*` token.

### Step 4: Off-grid spacing decisions

For each off-grid value, write a one-line decision in the PR description:
- `2` → `Spacing.xs` (4) — accept 2px diff
- `6` → `Spacing.xs` (4) or `Spacing.sm` (8) — pick per context
- `10` → `Spacing.sm` (8) or `Spacing.md` (16) — pick per context
- `14` → `Spacing.sm` (8) or `Spacing.md` (16) — pick per context
- `18` → `Spacing.md` (16) or `Spacing.lg` (24) — pick per context
- `20` → `Spacing.md` (16) or `Spacing.lg` (24) — pick per context
- `22` → `Spacing.lg` (24) — accept 2px diff
- `28` → `Spacing.lg` (24) or `Spacing.xl` (32) — pick per context

### Acceptance criteria

- [ ] `grep -r "EdgeInsets.all(" flutter/lib/ | grep -v "Spacing\." | wc -l` returns 0 (all `EdgeInsets.all` use `Spacing.*`)
- [ ] `grep -r "BorderRadius.circular(" flutter/lib/ | grep -v "AppRadius\." | wc -l` returns 0
- [ ] `grep -r "SizedBox(height: \|SizedBox(width: " flutter/lib/ | wc -l` returns 0 (all use `Gap` or `Spacing.*`)
- [ ] `grep -r "Color(0xFF" flutter/lib/ | wc -l` returns 0 (or only the documented exception files: `electric_burst.dart`, `troubleshooter_tree.dart`)
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] No visual regression in any of the 33 E2E tests
- [ ] The off-grid decisions are documented in the PR description

### Reviewer focus

- This PR is large. **Review per file or per feature**, not the whole diff at once.
- The 4 sub-tasks (spacing, radius, SizedBox, color) should be reviewable separately. Recommend splitting into 4 PRs if the team prefers smaller review surface, or keep as 1 PR with clear sub-commits.
- The "off-grid → on-grid" decisions (Step 4) are the highest-judgment part. Push back on the author if a 2px visual diff doesn't make sense for a specific widget.

### Rollback

Revert the PR. Because the refactor is mechanical, the diff is fully revertible.

---

## PR-7 — Typography: monospace codes + eliminate `FontWeight.w900`

**Effort:** 2 hours
**Risk:** low
**Audit ref:** 4.15, 6.2, 6.6

### Problem

Two typography issues:

1. **`AppTypography` has no monospace tier.** OTP inputs, verification codes, wallet reference numbers all use `GoogleFonts.jetBrainsMono(...)` or similar directly, bypassing the typography system. Need `codeMedium` and `codeLarge`.

2. **9 widgets use `FontWeight.w900`**, violating the design spec ("Never use w900 weights"). The 9 sites:
   - `features/auth/presentation/screens/otp_verification_screen.dart:283`
   - `features/dashboard/widgets/dashboard_kpi_tile.dart:53`
   - `features/notifications/presentation/screens/notifications_screen.dart:585`
   - `features/support/presentation/widgets/support_widgets.dart:301`
   - `features/profile/presentation/screens/edit_profile_screen.dart:466`
   - `features/rentals/presentation/screens/choose_plan_screen.dart:551`
   - `features/support/presentation/screens/feedback_screen.dart:443`
   - `features/device_compliance/presentation/screens/emergency_sos_screen.dart:102`
   - `widgets/top_up_request_sent_card.dart:194`

### Fix

**Part 1: Add monospace tiers to `AppTypography`**

```dart
// flutter/lib/theme/app_typography.dart
// Add to the existing 15 tiers:

/// `codeMedium` — 14px / w500 / JetBrains Mono
/// Use for OTP, verification codes, wallet reference numbers.
static TextStyle get codeMedium => GoogleFonts.jetBrainsMono(
  fontSize: 14,
  fontWeight: FontWeight.w500,
  letterSpacing: 0,
  height: 1.4,
);

/// `codeLarge` — 16px / w600 / JetBrains Mono
/// Use for prominent codes (e.g. the 6-digit OTP in the input field).
static TextStyle get codeLarge => GoogleFonts.jetBrainsMono(
  fontSize: 16,
  fontWeight: FontWeight.w600,
  letterSpacing: 0.5,
  height: 1.4,
);
```

**Part 2: Replace 9 `FontWeight.w900` usages with `w800`**

The design spec says "Never use w900". w800 is the heaviest allowed weight. For each of the 9 sites:
- If the use is for "extra emphasis" (e.g. KPI numbers, large buttons), w800 is visually equivalent.
- If the use is decorative (e.g. confetti text), w700 may be sufficient — review per case.

```dart
// Before
fontWeight: FontWeight.w900
// After
fontWeight: FontWeight.w800  // (or w700 if w800 is too bold)
```

### Acceptance criteria

- [ ] `AppTypography` has 17 tiers (15 existing + `codeMedium` + `codeLarge`)
- [ ] `grep -r "FontWeight.w900" flutter/lib/` returns 0 matches
- [ ] `grep -r "GoogleFonts.jetBrainsMono\|GoogleFonts.robotoMono" flutter/lib/` returns 0 matches (all monospace goes through `AppTypography.codeMedium/Large`)
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] No visual regression in OTP screen, dashboard KPI tiles, etc.

### Reviewer focus

- Is JetBrains Mono the right monospace? (Or should it be Roboto Mono, Space Mono, or a brand-specific font?)
- For each of the 9 w900 sites, is w800 the right replacement, or should some go to w700? (KPI numbers often look better at w800; decorative text at w700.)
- The audit's spec says "Never use w900". If the team wants to allow w900 for KPI numbers, document that exception in `docs/design-system.md` instead of removing the usages.

### Rollback

Revert the PR.

---

# What's NOT in this plan (and why)

The audit identified 53 findings. This plan covers the 7 highest-impact PRs (~48 of 53 items). The remaining 5 are:

| Audit ref | Item | Why deferred |
|---|---|---|
| 3.2 | Generate `app_theme.dart` from `design-tokens.json` (build_runner) | Large infra change; requires deciding the build pipeline. Recommend after PR-1: the JSON becomes a true source of truth, and a build step enforces it. |
| 3.3 | Consume `design-tokens.json` in web (generate Tailwind config) | Same as 3.2 but for web. The web's `--vf-*` tokens are wired but not generated; accept this for now. |
| 3.5 | Delete or merge `docs/DESIGN.md` (15.7 KB) into `design-system.md` | **Easy follow-up** — recommend filing as a 1-hr ticket for the dev team. Not a P0, but the two docs coexist and confuse new devs. |
| 3.6, 3.7, 3.8 | Add migration notes, info/neutral semantic colors, spacing/typography tokens to JSON | **Easy follow-up** — extend the JSON. Once PR-1 lands, this is just JSON file editing. |
| 9.1 (alt) | Refactor 175 `Icons.*` callsites to use `ThemeIcons` | Per PR-2 decision: delete instead. If the team wants a curated icon set later, that's a new design effort. |
| 11.3-11.6 | Consolidate 10+ card widgets, 2 empty-state widgets, 5 celebration widgets, 3 animation files | Large refactors; need product input on which widgets to keep. File as follow-up PRs after release. |
| 11.8 | Move 60% of `lib/widgets/*` (screen-specific) to `lib/features/*/widgets/*` | Large reorganization; defer to a separate "lib cleanup" pass. |
| 4.10 | `AppDurations.premiumCurve` is `easeOutCubic`, not the custom `Cubic(0.22, 1, 0.36, 1)` claimed in the comment | Small fix; defer. |
| 4.14 | `AppTypography` builds a new `TextStyle` on every getter call | Pre-build the 15 (now 17) styles in a static initializer. Performance micro-opt. |
| 6.3 | Hardcode the `Plus Jakarta Sans` font family as a constant | Trivial refactor; defer. |
| 6.4 | Doc's tier table is more detailed than the Dart | Add a `tierName`, `tierFontSize`, `tierWeight` docstring per getter. |
| 6.5 | No 13/15px body sizes (3 body sizes only) | Design system is intentionally 3 sizes. No fix needed. |
| 6.6 (lint) | `labelSmall` (11px) below WCAG min for body text | Add a lint rule. |
| 8.7 | Rename `AppRadius.xl/xxl` to `radiusModal/radiusBottomSheet` | Cosmetic; defer. |
| 10.3 | `AppColors.of(context)` fallback may be dead code | Verify with grep; if dead, remove. |
| 12.14 | Add CI lint for raw `Color(0xFF...)` and off-grid spacing | Trivial; defer. |

These are all real findings but they're **smaller, less-impactful, or larger refactors** than the 7 PRs in this plan. File them as follow-up tickets.

---

# Sequencing summary

| PR | Title | Effort | Risk | Phase |
|---|---|---|---|---|
| PR-1 | Align `design-tokens.json` to `#0053C1` | 5 min | zero | Ship now |
| PR-2 | Delete `theme_icons.dart` | 5 min | zero | Ship now |
| PR-3 | Delete `AppColors` alias duplicates | 1 hr | low | After PR-1, PR-2 |
| PR-4 | Replace `Colors.amber/green/red/blue/grey` | 1 d | low-medium | After PR-3 |
| PR-5 | Fix dark-mode card + disabled button colors | 2 hr | low | After PR-4 |
| PR-6 | Refactor 448 raw values to design tokens | 3 d | medium-high | After PR-5 |
| PR-7 | Typography: monospace + kill `FontWeight.w900` | 2 hr | low | After PR-6 (or in parallel with PR-6) |
| **Total** | | **~5-6 days focused** | | |

**Recommended merge order for one team:**
1. **PR-A (PR-1 + PR-2 + PR-3):** 1.5 hours. Zero risk. Close the primary-color loop, delete dead code, normalize aliases.
2. **PR-B (PR-4 + PR-5):** 1 day. Low-medium risk. Visual consistency for dark mode + Material defaults.
3. **PR-C (PR-6 + PR-7):** 3 days. Medium-high risk. The big refactor + typography cleanup.

**3 PRs total, ~5-6 days of focused work.** All P0s in the audit get shipped.

---

# Risk register

| Risk | Mitigation |
|---|---|
| PR-4 visual diff in 30+ widgets | Each replacement is checked against the original. Take screenshots before/after. |
| PR-5 dark-mode card break | Take screenshots in dark mode. Run E2E test 8.3 from the device playbook. |
| PR-6 448-site refactor introduces typos | Mechanical refactor with grep verification at each step. Per-file or per-feature review, not whole-diff. |
| PR-6 off-grid decisions are wrong | Document each off-grid decision in the PR description; product can push back per widget. |
| PR-7 monospace font not bundled | Add JetBrains Mono to `pubspec.yaml` `fonts:` section. Verify it loads on cold start. |
| PR-7 9 w800 replacements are too bold visually | Per-site review; some may need w700. |
| `AppColors.primaryCyan` deprecation removal | Phase 7 marked it for v2.0.0 removal. Don't touch in this plan. |

---

# What you do next

**Reviewer (you):** this plan is for the dev team, not for you. The actionable items:

1. **Hand the 3-PR merge order to the dev team** — they can ship PR-A in one afternoon (1.5 hours, zero risk, immediate visual cleanup).
2. **PR-5 (dark-mode card) is a user-visible bug** — if you have a dark mode toggle in the app, open it and look at any screen with cards. If the cards are white-on-dark, that's the bug this PR fixes. (You can verify visually on your device.)
3. **PR-6 is the big refactor** — it has a 1-week turnaround for review. Make sure the dev team doesn't try to bundle it with feature work.
4. **The 175 `Icons.*` callsites decision is permanent** — deleting `theme_icons.dart` means the team has accepted raw `Icons.*` is fine. If they want a curated icon set later, that's a new design effort, not a refactor.

If you want to track these in your `docs/FOLLOWUP_TICKETS.md`, copy the 3-PR merge order in there. Or ping me and I'll do it.

---

# Pointers

- **Full audit:** `docs/AUDIT_DESIGN_SYSTEM.md` (53 findings, ~47 KB)
- **Prior remediation:** `SCOPE.md` (Phases 0-7)
- **Release readiness:** `docs/RELEASE_READINESS_2026-07-29.md`
- **Database plan:** `docs/DB_REMEDIATION_PLAN.md`
- **Phase 7 Q1 fix:** `flutter/lib/theme/app_theme.dart:6` (primary = #0053C1)
- **Design system source of truth:** `docs/design-system.md` (canonical) + `design-tokens.json` (data)
- **Device test playbook:** `docs/DEVICE_TEST_PLAYBOOK.md` Section 8.3 (test dark-mode toggle)
