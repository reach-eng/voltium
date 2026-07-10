import 'package:flutter/material.dart';

class AppColors {
  // Brand Colors
  static const Color primary = Color(0xFF2563EB);
  static const Color primaryLight = Color(0xFF60A5FA);
  static const Color primaryLighter = Color(0xFFDBEAFE);
  static const Color primaryDark = Color(0xFF1D4ED8);
  static const Color primaryGradientEnd = Color(0xFF3B82F6);

  // Status & Semantic Colors
  static const Color success = Color(0xFF10B981); // emerald-500
  static const Color successLight = Color(0xFFD1FAE5); // emerald-100
  static const Color successDark = Color(0xFF059669);
  static const Color successText = Color(0xFF065F46); // emerald-900

  static const Color warning = Color(0xFFF59E0B); // amber-500
  static const Color warningLight = Color(0xFFFEF3C7);
  static const Color warningDark = Color(0xFFD97706);
  static const Color warningText = Color(0xFF92400E); // amber-800

  static const Color error = Color(0xFFEF4444);
  static const Color errorLight = Color(0xFFFEE2E2);
  static const Color errorDark = Color(0xFFB91C1C);

  static const Color info = Color(0xFF3B82F6);
  static const Color infoLight = Color(0xFFDBEAFE);

  // Neutral / Text Colors — matches web exactly
  static const Color onSurface = Color(0xFF101828); // web #101828
  static const Color onSurfaceAlt = Color(0xFF191C1E); // web #191c1e
  static const Color onSurfaceVariant =
      Color(0xFF475467); // web #475467 / #424653
  static const Color onSurfaceMuted = Color(0xFF737785); // web #737785
  static const Color onSurfaceDisabled = Color(0xFF98A2B3);

  // Surface / Background Colors
  /// Main scaffold background color (#F7F9FB)
  static const Color surface = Color(0xFFF7F9FB);

  /// Alternate background color for auth/login/onboarding pages and table rows (#F5F7FA)
  static const Color surfaceAlt = Color(0xFFF5F7FA);
  static const Color surfaceContainer = Color(0xFFF9FAFB);
  static const Color surfaceWhite = Color(0xFFFFFFFF);

  // Input
  static const Color inputBackground =
      Color(0xFFE6EAEF); // web #E6EAEF pill inputs
  static const Color inputBorder = Color(0xFFD0D5DD); // web border

  // Icon backgrounds
  static const Color iconBackground = Color(0xFFF1F5F9); // slate-100
  static const Color iconBackgroundBlue = Color(0xFFF0F4FA);

  // Misc
  static const Color divider = Color(0xFFE0E3E5); // web #e0e3e5
  static const Color outline = Color(0xFFD0D5DD);
  static const Color outlineVariant = Color(0xFFE2E8F0);

  // Slate palette
  static const Color slate400 = Color(0xFF94A3B8);
  static const Color slate500 = Color(0xFF64748B);
  static const Color slate600 = Color(0xFF475569);
  static const Color slate800 = Color(0xFF1E293B);

  // Feature Colors
  static const Color evPurple = Color(0xFF8B5CF6);
  static const Color evPurpleLight = Color(0xFFEDE9FE);

  AppColors._();
}
