import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Centralized typography system for Voltium.
///
/// ALL text in the app MUST use Plus Jakarta Sans. Never use raw `GoogleFonts.plusJakartaSans()`
/// — always use `GoogleFonts.plusJakartaSans()` or a named style from this class.
///
/// Usage:
/// - For one-off styles: `GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600)`
/// - For common patterns: `AppTypography.bodyMedium` or `AppTypography.headingLarge`
class AppTypography {
  AppTypography._();

  // ── Display / Hero ──────────────────────────────────────────────────────

  /// Hero title: 40px, w800, -1 letter spacing. Used for splash screen brand name.
  static TextStyle get displayLarge => GoogleFonts.plusJakartaSans(
        fontSize: 40,
        fontWeight: FontWeight.w800,
        letterSpacing: -1,
        height: 1.2,
      );

  /// Large display: 32px, w800. Used for wallet balance, main headings.
  static TextStyle get displayMedium => GoogleFonts.plusJakartaSans(
        fontSize: 32,
        fontWeight: FontWeight.w800,
        height: 1.2,
      );

  // ── Headings ────────────────────────────────────────────────────────────

  /// H1: 28px, w900, -0.5 letter spacing. Used for screen titles, login brand name.
  static TextStyle get headingLarge => GoogleFonts.plusJakartaSans(
        fontSize: 28,
        fontWeight: FontWeight.w900,
        letterSpacing: -0.5,
        height: 1.2,
      );

  /// H2: 24px, w900, -0.5 letter spacing. Used for dashboard greeting, section titles.
  static TextStyle get headingMedium => GoogleFonts.plusJakartaSans(
        fontSize: 24,
        fontWeight: FontWeight.w900,
        letterSpacing: -0.5,
        height: 1.2,
      );

  /// H3: 22px, w800, -0.5 letter spacing. Used for card titles, welcome text.
  static TextStyle get headingSmall => GoogleFonts.plusJakartaSans(
        fontSize: 22,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.5,
        height: 1.3,
      );

  /// H4: 20px, w800. Used for card headings, rider name.
  static TextStyle get titleLarge => GoogleFonts.plusJakartaSans(
        fontSize: 20,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.3,
        height: 1.3,
      );

  /// H5: 18px, w700. Used for section headers, dialog titles.
  static TextStyle get titleMedium => GoogleFonts.plusJakartaSans(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        height: 1.4,
      );

  /// H6: 16px, w700. Used for list tile titles, button labels.
  static TextStyle get titleSmall => GoogleFonts.plusJakartaSans(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        height: 1.4,
      );

  // ── Body ────────────────────────────────────────────────────────────────

  /// Large body: 16px, w500. Used for prominent body text.
  static TextStyle get bodyLarge => GoogleFonts.plusJakartaSans(
        fontSize: 16,
        fontWeight: FontWeight.w500,
        height: 1.5,
      );

  /// Medium body: 14px, w500. Default body text.
  static TextStyle get bodyMedium => GoogleFonts.plusJakartaSans(
        fontSize: 14,
        fontWeight: FontWeight.w500,
        height: 1.5,
      );

  /// Small body: 12px, w500. Used for secondary text, captions.
  static TextStyle get bodySmall => GoogleFonts.plusJakartaSans(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        height: 1.5,
      );

  // ── Labels ──────────────────────────────────────────────────────────────

  /// Large label: 14px, w700. Used for tab labels, chip text.
  static TextStyle get labelLarge => GoogleFonts.plusJakartaSans(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        height: 1.4,
      );

  /// Medium label: 12px, w700. Used for section labels, badges, timestamps.
  static TextStyle get labelMedium => GoogleFonts.plusJakartaSans(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        height: 1.4,
      );

  /// Small label: 11px, w700, 1.2 letter spacing. Used for overline labels.
  static TextStyle get labelSmall => GoogleFonts.plusJakartaSans(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        height: 1.3,
      );

  // ── Specialized ─────────────────────────────────────────────────────────

  /// Uppercase section label: 10px, w800, 1.0 letter spacing.
  /// Used for "ACTIVE HUB", "TEAM LEADER", category labels.
  static TextStyle get overline => GoogleFonts.plusJakartaSans(
        fontSize: 10,
        fontWeight: FontWeight.w800,
        letterSpacing: 1.0,
        height: 1.4,
      );

  /// OTP digit: 24px, w700. Used for OTP input fields.
  static TextStyle get otpDigit => GoogleFonts.plusJakartaSans(
        fontSize: 24,
        fontWeight: FontWeight.w700,
      );

  /// Price display: 22px, w800. Used for monetary amounts.
  static TextStyle get priceDisplay => GoogleFonts.plusJakartaSans(
        fontSize: 22,
        fontWeight: FontWeight.w800,
      );

  /// Price large: 32px, w800. Used for wallet balance display.
  static TextStyle get priceLarge => GoogleFonts.plusJakartaSans(
        fontSize: 32,
        fontWeight: FontWeight.w800,
      );

  /// Button text: 16px, w700. Used for filled/elevated buttons.
  static TextStyle get button => GoogleFonts.plusJakartaSans(
        fontSize: 16,
        fontWeight: FontWeight.w700,
      );

  /// Button small: 15px, w700. Used for compact buttons.
  static TextStyle get buttonSmall => GoogleFonts.plusJakartaSans(
        fontSize: 15,
        fontWeight: FontWeight.w700,
      );

  /// Input text: 16px, w600. Used for text field input.
  static TextStyle get input => GoogleFonts.plusJakartaSans(
        fontSize: 16,
        fontWeight: FontWeight.w600,
      );

  /// Input hint: 14px, w400. Used for text field hints.
  static TextStyle get inputHint => GoogleFonts.plusJakartaSans(
        fontSize: 14,
        fontWeight: FontWeight.w400,
      );

  /// Nav label: 12px, w700. Used for bottom navigation labels.
  static TextStyle get navLabel => GoogleFonts.plusJakartaSans(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.2,
      );

  // ── Extended Body (gap-filling) ─────────────────────────────────────────

  /// 14px, w600. Used for emphasized body text, list tile subtitles.
  static TextStyle get bodyMediumEmphasis => GoogleFonts.plusJakartaSans(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        height: 1.5,
      );

  /// 14px, w800. Used for bold card values, highlighted amounts.
  static TextStyle get bodyMediumStrong => GoogleFonts.plusJakartaSans(
        fontSize: 14,
        fontWeight: FontWeight.w800,
        height: 1.4,
      );

  /// 12px, w600. Used for medium-emphasis captions, secondary labels.
  static TextStyle get bodySmallEmphasis => GoogleFonts.plusJakartaSans(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        height: 1.5,
      );

  /// 12px, w800. Used for bold captions, status badges.
  static TextStyle get bodySmallStrong => GoogleFonts.plusJakartaSans(
        fontSize: 12,
        fontWeight: FontWeight.w800,
        height: 1.4,
      );

  /// 12px, w900, 1.2 letter spacing. Used for uppercase tracking labels.
  static TextStyle get bodySmallTracked => GoogleFonts.plusJakartaSans(
        fontSize: 12,
        fontWeight: FontWeight.w900,
        letterSpacing: 1.2,
        height: 1.4,
      );

  /// 13px, w500. Used for compact body text, inline descriptions.
  static TextStyle get bodyCompact => GoogleFonts.plusJakartaSans(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        height: 1.5,
      );

  /// 13px, w600. Used for compact emphasized text.
  static TextStyle get bodyCompactEmphasis => GoogleFonts.plusJakartaSans(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        height: 1.5,
      );

  /// 13px, w700. Used for compact bold text, small headers.
  static TextStyle get bodyCompactStrong => GoogleFonts.plusJakartaSans(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        height: 1.4,
      );

  /// 15px, w700. Used for medium buttons, compact CTAs.
  static TextStyle get buttonMedium => GoogleFonts.plusJakartaSans(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        height: 1.4,
      );

  /// 15px, w600. Used for medium body emphasis.
  static TextStyle get bodyLargeEmphasis => GoogleFonts.plusJakartaSans(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        height: 1.5,
      );

  /// 11px, w700. Used for small badges, micro labels.
  static TextStyle get microLabel => GoogleFonts.plusJakartaSans(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        height: 1.3,
      );

  /// 9px, w600. Used for tiny badges, fine print.
  static TextStyle get microBadge => GoogleFonts.plusJakartaSans(
        fontSize: 9,
        fontWeight: FontWeight.w600,
        height: 1.3,
      );

  /// 10px, w600. Used for small badges, tag text.
  static TextStyle get smallBadge => GoogleFonts.plusJakartaSans(
        fontSize: 10,
        fontWeight: FontWeight.w600,
        height: 1.3,
      );

  /// 10px, w900, 1.5 letter spacing. Used for uppercase micro labels.
  static TextStyle get microOverline => GoogleFonts.plusJakartaSans(
        fontSize: 10,
        fontWeight: FontWeight.w900,
        letterSpacing: 1.5,
        height: 1.4,
      );

  /// 21px, w700. Used for medium section titles.
  static TextStyle get titleMediumLarge => GoogleFonts.plusJakartaSans(
        fontSize: 21,
        fontWeight: FontWeight.w700,
        height: 1.3,
      );

  /// Default text: no size/weight override. Used when only color/spacing is needed.
  static TextStyle get defaultText => GoogleFonts.plusJakartaSans();
}
