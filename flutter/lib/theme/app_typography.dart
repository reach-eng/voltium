import 'package:flutter/material.dart';

/// Centralized typography system for Voltium.
///
/// ALL text in the app MUST use Plus Jakarta Sans.
///
/// Usage:
/// - Primary: Use named semantic styles like `AppTypography.bodyMedium` or `AppTypography.headingLarge`.
/// - Modifiers: Use `.copyWith(fontWeight: FontWeight.w700)` to emphasize standard tier styles.
///
/// R2.1 (2026-07-31) — removed 7 redundant aliases that duplicated canonical
/// tiers. The canonical set is now 19 styles grouped as:
///   1. Display  (2): displayLarge, displayMedium
///   2. Headings (3): headingLarge, headingMedium, headingSmall
///   3. Titles   (3): titleLarge, titleMedium, titleSmall
///   4. Body     (3): bodyLarge, bodyMedium, bodySmall
///   5. Labels   (3): labelLarge, labelMedium, labelSmall
///   6. Utility  (3): overline, otpDigit, priceDisplay
///   7. Code     (2): codeMedium, codeLarge
///
/// Migration targets for the removed aliases (all references in the codebase
/// have been updated; this is the doc for the next person reading the file):
///   - defaultText  → use the body tier (bodyMedium is the most common)
///   - button       → labelLarge.copyWith(fontWeight: FontWeight.w700)
///   - buttonSmall  → labelLarge.copyWith(fontWeight: FontWeight.w700)
///   - input        → labelLarge (already 16px / w600)
///   - inputHint    → bodyMedium.copyWith(color: AppColors.slate500)
///   - navLabel     → labelMedium (already 12px / w600)
///   - priceLarge   → displayMedium (already 32px / w800)
class AppTypography {
  AppTypography._();

  /// Primary font family name for Voltium design system.
  static const String fontFamily = 'Plus Jakarta Sans';
  static const String monoFontFamily = 'JetBrains Mono';

  // ── 1. Display / Hero ──────────────────────────────────────────────────

  /// Display Large: 40px, w800, -1.0 tracking. Splash screen & hero headers.
  static const TextStyle displayLarge = TextStyle(
    fontFamily: fontFamily,
    fontSize: 40,
    fontWeight: FontWeight.w800,
    letterSpacing: -1.0,
    height: 1.2,
  );

  /// Display Medium: 32px, w800, -0.8 tracking. Wallet balance, hero metrics.
  static const TextStyle displayMedium = TextStyle(
    fontFamily: fontFamily,
    fontSize: 32,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.8,
    height: 1.2,
  );

  // ── 2. Headings ────────────────────────────────────────────────────────

  /// H1: 28px, w800, -0.5 tracking. Screen main headers.
  static const TextStyle headingLarge = TextStyle(
    fontFamily: fontFamily,
    fontSize: 28,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.5,
    height: 1.2,
  );

  /// H2: 24px, w800, -0.4 tracking. Section titles & greetings.
  static const TextStyle headingMedium = TextStyle(
    fontFamily: fontFamily,
    fontSize: 24,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.4,
    height: 1.2,
  );

  /// H3: 20px, w800, -0.3 tracking. Sub-sections & card titles.
  static const TextStyle headingSmall = TextStyle(
    fontFamily: fontFamily,
    fontSize: 20,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.3,
    height: 1.3,
  );

  // ── 3. Titles ──────────────────────────────────────────────────────────

  /// Title Large: 18px, w700, -0.2 tracking. Dialog titles, list headers.
  static const TextStyle titleLarge = TextStyle(
    fontFamily: fontFamily,
    fontSize: 18,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.2,
    height: 1.4,
  );

  /// Title Medium: 16px, w700, -0.1 tracking. ListTile titles, card labels.
  static const TextStyle titleMedium = TextStyle(
    fontFamily: fontFamily,
    fontSize: 16,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.1,
    height: 1.4,
  );

  /// Title Small: 14px, w700. Compact list titles, dense headers.
  static const TextStyle titleSmall = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    fontWeight: FontWeight.w700,
    height: 1.4,
  );

  // ── 4. Body ────────────────────────────────────────────────────────────

  /// Body Large: 16px, w500. Prominent reading text.
  static const TextStyle bodyLarge = TextStyle(
    fontFamily: fontFamily,
    fontSize: 16,
    fontWeight: FontWeight.w500,
    height: 1.5,
  );

  /// Body Medium: 14px, w500. Default body text throughout app.
  static const TextStyle bodyMedium = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    fontWeight: FontWeight.w500,
    height: 1.5,
  );

  /// Body Small: 12px, w500. Secondary text, captions, timestamps.
  static const TextStyle bodySmall = TextStyle(
    fontFamily: fontFamily,
    fontSize: 12,
    fontWeight: FontWeight.w500,
    height: 1.5,
  );

  // ── 5. Labels ──────────────────────────────────────────────────────────

  /// Label Large: 14px, w600. Tabs, chips, interactive elements.
  static const TextStyle labelLarge = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    fontWeight: FontWeight.w600,
    height: 1.4,
  );

  /// Label Medium: 12px, w600. Status tags, badge text.
  static const TextStyle labelMedium = TextStyle(
    fontFamily: fontFamily,
    fontSize: 12,
    fontWeight: FontWeight.w600,
    height: 1.4,
  );

  /// Label Small: 11px, w600. Micro badges, fine print.
  static const TextStyle labelSmall = TextStyle(
    fontFamily: fontFamily,
    fontSize: 11,
    fontWeight: FontWeight.w600,
    height: 1.3,
  );

  // ── 6. Specialized Controls & Utility ──────────────────────────────────

  /// Uppercase Overline: 10px, w800, +1.0 tracking. Category overlines.
  ///
  /// **Deprecated (DS-3b, 2026-08-04):** Zero active call-sites found outside tests.
  /// Use `labelSmall.copyWith(letterSpacing: 1.0, fontWeight: FontWeight.w800)` instead.
  /// Will be removed in DS-4.0 once all callers are migrated.
  @Deprecated(
    'Use labelSmall.copyWith(letterSpacing: 1.0, fontWeight: FontWeight.w800). '
    'Will be removed in DS-4.0.',
  )
  static const TextStyle overline = TextStyle(
    fontFamily: fontFamily,
    fontSize: 10,
    fontWeight: FontWeight.w800,
    letterSpacing: 1.0,
    height: 1.4,
  );

  /// OTP Digit: 24px, w700. OTP input cells.
  static const TextStyle otpDigit = TextStyle(
    fontFamily: fontFamily,
    fontSize: 24,
    fontWeight: FontWeight.w700,
  );

  /// Price Display: 22px, w800. Standalone prices.
  static const TextStyle priceDisplay = TextStyle(
    fontFamily: fontFamily,
    fontSize: 22,
    fontWeight: FontWeight.w800,
  );

  // ── 7. Monospace / Code ────────────────────────────────────────────────

  /// Code Medium: 14px, w500, JetBrains Mono. OTP digits, verification codes, wallet refs.
  ///
  /// **Deprecated (DS-3b, 2026-08-04):** Zero active call-sites found outside tests.
  /// Use `codeLarge` (16px/w600) or `otpDigit` (24px/w700) instead.
  /// Will be removed in DS-4.0 once all callers are migrated.
  @Deprecated(
    'Use codeLarge or otpDigit instead. '
    'Will be removed in DS-4.0.',
  )
  static const TextStyle codeMedium = TextStyle(
    fontFamily: monoFontFamily,
    fontSize: 14,
    fontWeight: FontWeight.w500,
    letterSpacing: 0,
    height: 1.4,
  );

  /// Code Large: 16px, w600, JetBrains Mono. Prominent codes (6-digit OTP input).
  static const TextStyle codeLarge = TextStyle(
    fontFamily: monoFontFamily,
    fontSize: 16,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.5,
    height: 1.4,
  );
}
