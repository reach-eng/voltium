# Voltium Kinetic Precision — Design System Specification

This document defines the single, authoritative design specification for the Voltium platform across Web (Next.js) and Mobile (Flutter).

---

## 1. Color System & Tokens

### **Primitive Palette**
- **Brand Primary**: `#0053C1` (Voltium Blue)
- **Volt Accent**: `#00E5FF` (Electric Cyan) — *EV/Energy highlight token*
- **Success / Emerald**: `#10B981`
- **Warning / Amber**: `#F59E0B`
- **Danger / Red**: `#EF4444`
- **Slate Scale**: `#F8FAFC` (50), `#F1F5F9` (100), `#E2E8F0` (200), `#CBD5E1` (300), `#94A3B8` (400), `#64748B` (500), `#475569` (600), `#334155` (700), `#1E293B` (800), `#0F172A` (900).

### **Semantic Theme Tokens (`ThemeColors` / CSS Variables)**

| Role Token | Light Mode | Dark Mode | Description |
| :--- | :--- | :--- | :--- |
| `surface` | `#F7F9FB` | `#0F172A` | Primary app scaffold background |
| `surfaceAlt` | `#F5F7FA` | `#1E293B` | Secondary page/input background |
| `card` | `#FFFFFF` | `#1E293B` | Raised cards, sheets, dialog surfaces |
| `onSurface` | `#101828` | `#F1F5F9` | Primary text & icons |
| `onSurfaceVariant` | `#475467` | `#94A3B8` | Subtitles, section headers |
| `onSurfaceMuted` | `#667085` | `#64748B` | Captions, secondary labels |
| `actionPrimary` | `#0053C1` | `#0053C1` | Primary CTA buttons |
| `statusSuccess` | `#16A34A` | `#34D399` | Positive feedback, verified status |
| `statusWarning` | `#F59E0B` | `#FBBF24` | Warnings, pending reviews |
| `statusError` | `#EF4444` | `#FCA5A5` | Errors, emergency SOS |
| `divider` | `#E0E3E5` | `#334155` | Dividers & card outlines |

---

## 2. Typography Specification

Font Family: **Plus Jakarta Sans**

### **Canonical 19-style system (R2.1, 2026-07-31)**

This is the canonical naming. Every text style in the app must map to one
of these 19 styles — any new typography is a **domain-specific extension**
(see below) and should not bypass the scale.

| Group | Style Tier | Font Size | Weight | Tracking | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1. Display | `displayLarge` | `40px` | `w800` | `-1.0px` | Hero titles & splash brand |
| 1. Display | `displayMedium` | `32px` | `w800` | `-0.8px` | Wallet balance & main headers |
| 2. Headings | `headingLarge` | `28px` | `w800` | `-0.5px` | Primary screen headers (H1) |
| 2. Headings | `headingMedium` | `24px` | `w800` | `-0.4px` | Section titles & greetings (H2) |
| 2. Headings | `headingSmall` | `20px` | `w800` | `-0.3px` | Sub-sections & card titles (H3) |
| 3. Titles | `titleLarge` | `18px` | `w700` | `-0.2px` | Dialog headers & list headers |
| 3. Titles | `titleMedium` | `16px` | `w700` | `-0.1px` | ListTile titles & card labels |
| 3. Titles | `titleSmall` | `14px` | `w700` | `0.0px` | Dense headers |
| 4. Body | `bodyLarge` | `16px` | `w500` | `0.0px` | Prominent body text |
| 4. Body | `bodyMedium` | `14px` | `w500` | `0.0px` | Default body text |
| 4. Body | `bodySmall` | `12px` | `w500` | `0.0px` | Secondary text & captions |
| 5. Labels | `labelLarge` | `14px` | `w600` | `0.0px` | Interactive chips, tabs, **CTAs (with `.copyWith(fontWeight: w700)`)** |
| 5. Labels | `labelMedium` | `12px` | `w600` | `0.0px` | Status badges, **bottom nav labels** |
| 5. Labels | `labelSmall` | `11px` | `w600` | `0.0px` | Micro badges & fine print |
| 6. Utility | `overline` | `10px` | `w800` | `+1.0px` | Category overlines (Uppercase) |
| 6. Utility | `otpDigit` | `24px` | `w700` | `0.0px` | OTP code fields |
| 6. Utility | `priceDisplay` | `22px` | `w800` | `0.0px` | Standalone prices |
| 7. Code | `codeMedium` | `14px` | `w500` | `0.0px` | OTP digits, verification codes, wallet refs (JetBrains Mono) |
| 7. Code | `codeLarge` | `16px` | `w600` | `+0.5px` | Prominent codes, 6-digit OTP input (JetBrains Mono) |

#### R2.1 cleanup (2026-07-31)

Seven redundant aliases were removed from `flutter/lib/theme/app_typography.dart`:

| Removed alias | Use this instead | Notes |
| :--- | :--- | :--- |
| `defaultText` | `bodyMedium` | Was just `GoogleFonts.plusJakartaSans()` with no overrides |
| `button` | `labelLarge.copyWith(fontWeight: FontWeight.w700)` | 16px w700 → 14px w700 (1px down, design decision) |
| `buttonSmall` | `labelLarge.copyWith(fontWeight: FontWeight.w700)` | 15px w700 → 14px w700; **22 call-sites migrated** |
| `input` | `labelLarge` | Already 16px / w600 — exact match |
| `inputHint` | `bodyMedium.copyWith(color: AppColors.slate500)` | Form hint text |
| `navLabel` | `labelMedium` | Already 12px / w600 — exact match |
| `priceLarge` | `displayMedium` | Already 32px / w800 — exact match (was a duplicate) |

After R2.1: **0 call-sites** reference any of the removed aliases
(verified via `grep -r "AppTypography\.\(defaultText\|button\|buttonSmall\|input\|inputHint\|navLabel\|priceLarge\)\b" lib/`).

#### Domain-specific extensions (legacy)

These **do not** exist in the current `app_typography.dart` but were
documented in the pre-R2.1 design system. They are kept here for
historical reference only. **Do not use them in new code.** If you see
them in a code review, flag and replace with the canonical equivalent.

| Old alias (pre-R2.1) | Use this instead |
| :--- | :--- |
| `bodyMediumEmphasis` / `bodyMediumStrong` | `bodyMedium.copyWith(fontWeight: w600 / w700)` |
| `bodySmallEmphasis` / `bodySmallStrong` | `bodySmall.copyWith(fontWeight: w600 / w700)` |
| `bodySmallTracked` | `bodySmall.copyWith(letterSpacing: 0.4)` |
| `bodyCompact` | `bodyMedium` (use `.copyWith(fontSize: 13)` if 13px is required) |
| `bodyCompactEmphasis` / `bodyCompactStrong` | `bodyCompact.copyWith(fontWeight: w600 / w700)` |
| `bodyLargeEmphasis` | `bodyLarge.copyWith(fontWeight: w600)` |
| `microLabel` | `labelSmall` |
| `microBadge`, `smallBadge` | `labelSmall` (`.copyWith(fontSize: ...)` if needed) |
| `microOverline` | `overline` |
| `titleMediumLarge` | `titleLarge` |
| `buttonMedium` | `labelLarge.copyWith(fontWeight: FontWeight.w700)` |

**Rule of thumb for new code:** pick the closest canonical tier. If you
need a new style that doesn't fit any of the 19, propose adding it to
the scale — don't add a domain-specific alias.

*Rules*: Never use `w900` weights. Apply weight modifiers via `.copyWith(fontWeight: ...)` rather than defining new raw styles.

---

## 2.5 Color Tokens (`AppColors`)

Source of truth: `flutter/lib/theme/app_theme.dart` (`AppColors` class).
Web equivalent: `web/src/app/globals.css` (`--color-*` variables).

### **Canonical 6-base × 3-variant system (R2.2, 2026-07-31)**

Every color used in the app maps to one of these 6 base tokens, with up to
3 variants each (`Light`, `Dark`, `Surface`, `Border`).

| Base | Light variant | Dark variant | Surface (50/100) | Border (200) | Use case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `primary` | `primaryLight` | `primaryDark` | `primarySurface` | — | Brand blue (`#0053C1`) |
| `success` | `successLight` | `successDark` | `successSurface` | `successBorderLight` | Positive states |
| `warning` | `warningLight` | `warningDark` | `warningSurface` | `warningBorder` | Caution / pending |
| `error` | `errorLight` | `errorDark` | `errorSurface` | `errorBorder` | Destructive / failure |
| `info` | `infoLight` | — | — | — | Informational |
| `surface` | `surfaceBright` | `slate900` | `surfaceSubtle` | `divider` | Backgrounds & containers |

Plus 5 categorical neutrals that don't fit the 6-base pattern:
- `onSurface` / `onSurfaceMuted` / `onSurfaceVariant` / `onSurfaceDisabled` — text on surfaces (4-step opacity ladder)
- `iconBackground` / `iconBackgroundBlue` *(renamed → `iconBackground` only as of R2.2)* — icon-tile backgrounds

Plus a 6-step **slate scale** (`slate400`…`slate900`) for dark mode surfaces, text on light backgrounds, and divider lines. The slate scale is the **only** place raw hex is allowed in `app_theme.dart` outside the tokens — every other `Color(0xFF...)` is forbidden.

### **R2.2 cleanup (2026-07-31)**

Removed 2 dead colors that had **0** call-sites in `flutter/lib/`:

| Removed | Reason | Replaced with |
| :--- | :--- | :--- |
| `iconBackgroundBlue` (`#F0F4FA`) | Unused | `iconBackground` |
| `inputBorder` (`#D0D5DD`) | Duplicate of `outline` (9 callers) | `outline` |

### **PR-91 cleanup (DS-T-1, 2026-08-04)**

Removed 3 more dead colors that the original R2.2 header had documented as
removed but were actually still in `app_theme.dart` (and in
`design-tokens.json` for the `voltAccent` ones). The header comment in
`app_theme.dart` was therefore inaccurate until this PR.

| Removed | Reason | Replaced with |
| :--- | :--- | :--- |
| `voltAccent` (`#00E5FF`) | Unused; "electric cyan" was a flavor-of-the-month | n/a (use `primary` for any high-energy accent) |
| `purpleIconVivid` (`#6D28D9`) | Unused after caller migration | `purpleIcon` (caller migrated) |
| `orangeAccentLight` (`#FFE082`) | Unused after caller migration | `warningBorder` (caller migrated) |

`voltAccent` was also stripped from the `ThemeColors` extension (light +
dark factory constants, constructor, `copyWith`, `lerp`) and from
`design-tokens.json` (semantic light + dark `voltAccent` keys, plus the
`voltCyan` primitive it implied).

After R2.2 part 1: 82 named colors (down from 87 pre-R2.2). After PR-91: 79.

### **Group 7 candidates for R2.2 part 2 (NOT YET CONSOLIDATED)**

These are still in the file but have low usage (1-9 call-sites each). They
are documented here for the next consolidation pass. **Do not add new
call-sites to these** — pick the canonical 6-base equivalent instead.

| Low-usage group | Call-sites | Migration target |
| :--- | :--- | :--- |
| `orangeAccent`, `orangeAccentDark`, `orangeAccentBorder`, `orangeAccentSurface` | 9 total | `warning` + `warningLight` + `warningBorder` + `warningSurface` |
| `royalBlue`, `royalBlueTint`, `royalBlueStrong` | 6 | `primary` + `primarySurface` + `primaryLight` |
| `purpleIcon`, `purpleIconSurface`, `purpleLightSurface` | 8 | `primary` (if it's just a "premium tier" badge) or new `accentPurple` token |
| `tealIcon`, `tealIconSurface` | 8 | `success` (teal is the success variant) |
| `amberIcon`, `amberIconSurface` | 6 | `warning` |
| `skySpark`, `skySparkSurface` | 2 | `info` / `infoLight` |
| `evPurple`, `purpleDark`, `purpleDeep`, `purpleSurface` | 19 | Consolidate to 1 `accentPurple` or merge with rewards feature |
| `successBright`, `successOutline`, `successSurfaceAlt`, `successSurfaceLight`, `successTint` | 31 | `success` + `successLight` + `successDark` (only keep canonical) |
| `shimmerBase`, `shimmerHighlight`, `shadowSoft`, `shadowPrimaryStrong`, `shadowSuccessStrong`, `white70` | 22 | `AppShadows` (move to dedicated class) |
| `dangerText`, `dangerShadow` | 5 | `errorDark` + `AppShadows.errorShadow` |
| `whatsappGreen` | 1 | n/a — keep, semantic (third-party brand) |

### **Rule of thumb for new code**

1. **First choice:** one of the 6-base tokens (`primary`, `success`, `warning`, `error`, `info`, `surface`).
2. **Need a variant?** Use the `Light` / `Dark` / `Surface` / `Border` companion from the canonical table.
3. **Need text on a surface?** Use one of the 4 `onSurface*` steps.
4. **Need dark mode support?** Use `ThemeColors.of(context).xxx` (the brightness-aware wrapper).
5. **Reaching for a "Group 7" color?** Stop. Either:
   - Pick the canonical equivalent (most have one)
   - Or open a discussion in the design-system channel before adding

**Automated guard:** `flutter/test/theme/app_colors_no_dead_test.dart` fails CI if any
`AppColors.*` constant has 0 call-sites in `lib/`. This prevents the
file from drifting back into dead-color territory.

---

## 3. Spacing & Radius System

### **Spacing Tokens (`Spacing`)**
- `xs`: `4px`
- `sm`: `8px`
- `md`: `16px`
- `lg`: `24px`
- `xl`: `32px`
- `xxl`: `48px`

### **Recalibrated Geometric Radius Tokens (`AppRadius`)**
- `xs`: `4px` (Chips, small badges)
- `sm`: `8px` (Inputs, dense controls)
- `md`: `12px` (Alerts, standard inputs)
- `lg`: `16px` (Standard cards)
- `xl`: `24px` (Large hero containers, modals)
- `xxl`: `32px` (Bottom sheet surfaces)
- `full`: `9999px` (Pill buttons, avatars)

---

## 4. Cross-Platform Token Synchronization

Cross-platform parity between Next.js CSS variables (`web/src/app/globals.css`) and Flutter Theme Extensions (`flutter/lib/theme/app_theme.dart`) is asserted via the central spec file `design-tokens.json` using `npm run check:tokens`.

---

## 5. Mobile Screen Catalog Reference

### 5.1 Preamble & Global Routing
- **Splash Screen** (`splash_screen.dart`): Centered Logo (72x72) in `#0053C1` circle. `VoltMeshGradient` background. Authenticates session and routes to `LegalScreen` or `AuthWrapper`.
- **Legal Screen** (`legal_screen.dart`): BackdropFilter header (Blur 10), Scrollable HTML terms body, Sticky footer with "I Agree" button.
- **Permissions** (`permissions_screen.dart`): Sequential card stack for Camera/Location/Notifications with Grant buttons.
- **Onboarding** (`onboarding_screen.dart`): 3-slide PageView with Lottie animations, titles, and active blue pill indicator.
- **Auth Wrapper** (`auth_wrapper.dart`): Non-UI state machine checking `isAuthenticated` and `pickupDone`.

### 5.2 Authentication & Registration
- **Login Screen** (`login_screen.dart`): Header bolt logo, Pill Input (H56, `#E6EAEF`) with `+91` prefix, Primary gradient CTA.
- **OTP Verification** (`otp_verification_screen.dart`): 4-digit PinCode field with 60s countdown timer in `primary` blue.
- **User Onboarding** (`user_onboarding_screen.dart`): Avatar upload, Name, DOB, and Gender inputs.
- **Guarantor Onboarding** (`guarantor_onboarding_screen.dart`): Identity document camera capture UI + secondary contact details.

### 5.3 Vehicle Pickup & Mission Control
- **Pickup Hub** (`pickup_hub_screen.dart`): Google Maps view + navigation trigger card.
- **Pickup Vehicle** (`pickup_vehicle_screen.dart`): Camera-view QR Scanner with square overlay & fallback manual entry.
- **Active Dashboard** (`active_dashboard_screen.dart`): Mesh gradient base, 2x2 stats grid (Range, Battery, Speed, Temp), Overdue floating alert bar.
- **Wallet Screen** (`wallet_screen.dart`): Large balance card (`primaryGradient`), recent transaction history, Top-Up & Withdraw CTAs.

---

## 6. Interaction & Animation Specs

- **Screen Transitions**: `CupertinoPageRoute` (iOS) / `MaterialPageRoute` (Android).
- **Micro-interactions**:
  - **Button Tap**: `ScaleTransition` (0.95x scale on press).
  - **Form Error**: `ShakeAnimation` on input field + color shift to `statusError`.
  - **Success States**: Lottie `confetti.json` on transaction or pickup completion.
- **Empty States**: Centralized `EmptyState` widget featuring custom illustrations and primary CTA.
