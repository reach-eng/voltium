import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

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
  static const Color onSurfaceDisabled =
      Color(0xFF6B7280); // WCAG AA: 5.3:1 on surface

  // Surface / Background Colors
  static const Color surface = Color(0xFFF7F9FB); // web #f7f9fb (main bg)
  static const Color surfaceAlt = Color(0xFFF5F7FA); // web #F5F7FA (login bg)
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
  static const Color slate700 = Color(0xFF334155);
  static const Color slate800 = Color(0xFF1E293B);
  static const Color slate900 = Color(0xFF0F172A);

  // Extended text colors
  static const Color textPrimary = Color(0xFF111827); // gray-900
  static const Color textSecondary = Color(0xFF4B5563); // gray-600
  static const Color textMuted = Color(0xFF667085); // gray-500
  static const Color textTertiary = Color(0xFF6B7280); // gray-500 alt

  // Extended surface colors
  static const Color surfaceBright = Color(0xFFF8FAFC); // slate-50
  static const Color surfaceSubtle = Color(0xFFF3F4F6); // gray-100
  static const Color surfaceHover = Color(0xFFF9F9FF); // custom light

  // Extended border colors
  static const Color borderSubtle = Color(0xFFE5E7EB); // gray-200
  static const Color borderDefault = Color(0xFFD1D5DB); // gray-300
  static const Color borderMedium = Color(0xFFCBD5E1); // slate-300

  // Success extended
  static const Color successGreen = Color(0xFF16A34A); // green-600
  static const Color successBright = Color(0xFF4ADE80); // green-400
  static const Color successSurface = Color(0xFFDCFCE7); // green-100
  static const Color successSurfaceLight = Color(0xFFF0FDF4); // green-50
  static const Color successSurfaceAlt = Color(0xFFECFDF5); // green-50 alt

  // Error extended
  static const Color errorRed = Color(0xFFDC2626); // red-600
  static const Color errorRedAlt = Color(0xFFD92D20); // red-600 alt
  static const Color errorSurface = Color(0xFFFEF2F2); // red-50
  static const Color errorBorder = Color(0xFFFECACA); // red-200
  static const Color errorRose = Color(0xFFFFE4E6); // rose-100

  // Warning extended
  static const Color warningSurface = Color(0xFFFFFBEB); // amber-50
  static const Color warningBorder = Color(0xFFFDE68A); // amber-200

  // Primary extended
  static const Color primarySurface = Color(0xFFEFF6FF); // blue-50
  static const Color primaryLightBlue = Color(0xFF93C5FD); // blue-300
  static const Color primaryDeep = Color(0xFF142B5B); // dark blue
  static const Color primaryCyan = Color(0xFF0053C1); // brand cyan-blue

  // Purple extended
  static const Color purpleDark = Color(0xFF7C3AED); // violet-600
  static const Color purpleSurface = Color(0xFFF5F3FF); // violet-50
  static const Color purpleDeep = Color(0xFF9333EA); // purple-600

  // Feature Colors
  static const Color evPurple = Color(0xFF8B5CF6);
  static const Color evPurpleLight = Color(0xFFEDE9FE);
  static const Color whatsappGreen = Color(0xFF25D366);

  /// Get theme-aware colors for the current brightness.
  ///
  /// Usage:
  /// ```dart
  /// final colors = AppColors.of(context);
  /// Container(color: colors.surface)
  /// ```
  static ThemeColors of(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    return brightness == Brightness.dark ? ThemeColors.dark : ThemeColors.light;
  }

  AppColors._();
}

class AppGradients {
  /// Primary brand gradient: #0053C1 → #2F6DDE (135deg)
  static const LinearGradient primary = LinearGradient(
    colors: [Color(0xFF2563EB), Color(0xFF3B82F6)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient success = LinearGradient(
    colors: [Color(0xFF059669), Color(0xFF10B981)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient purple = LinearGradient(
    colors: [Color(0xFF7C3AED), Color(0xFF8B5CF6)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient loadingBar = LinearGradient(
    colors: [Color(0xFF0053C1), Color(0xFF2F6DDE)],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  AppGradients._();
}

class AppShadows {
  /// Card shadow: shadow-[0px_24px_48px_rgba(15,23,42,0.04)]
  static const List<BoxShadow> card = [
    BoxShadow(
      color: Color(0x140F172A), // 8% opacity
      blurRadius: 12,
      offset: Offset(0, 4),
    ),
  ];

  /// Glass shadow: shadow-[0px_2px_8px_rgba(15,23,42,0.04)]
  static const List<BoxShadow> glass = [
    BoxShadow(
      color: Color(0x0A0F172A),
      blurRadius: 8,
      offset: Offset(0, 2),
    ),
  ];

  /// Primary button shadow: shadow-[0px_8px_24px_rgba(0,83,193,0.25)]
  static const List<BoxShadow> primaryButton = [
    BoxShadow(
      color: Color(0x400053C1),
      blurRadius: 24,
      offset: Offset(0, 8),
    ),
  ];

  /// Logo container shadow: shadow-[0px_24px_48px_rgba(15,23,42,0.08)]
  static const List<BoxShadow> logoContainer = [
    BoxShadow(
      color: Color(0x140F172A),
      blurRadius: 48,
      offset: Offset(0, 24),
    ),
  ];

  /// Checkbox accepted shadow: 0px 2px 8px rgba(0,83,193,0.25)
  static const List<BoxShadow> checkboxAccepted = [
    BoxShadow(
      color: Color(0x400053C1),
      blurRadius: 8,
      offset: Offset(0, 2),
    ),
  ];

  AppShadows._();
}

class Spacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
  static const double xxl = 48;

  static const EdgeInsets paddingXs = EdgeInsets.all(xs);
  static const EdgeInsets paddingSm = EdgeInsets.all(sm);
  static const EdgeInsets paddingMd = EdgeInsets.all(md);
  static const EdgeInsets paddingLg = EdgeInsets.all(lg);
  static const EdgeInsets paddingXl = EdgeInsets.all(xl);

  static const EdgeInsets horizontalSm = EdgeInsets.symmetric(horizontal: sm);
  static const EdgeInsets horizontalMd = EdgeInsets.symmetric(horizontal: md);
  static const EdgeInsets horizontalLg = EdgeInsets.symmetric(horizontal: lg);

  static const EdgeInsets verticalSm = EdgeInsets.symmetric(vertical: sm);
  static const EdgeInsets verticalMd = EdgeInsets.symmetric(vertical: md);
  static const EdgeInsets verticalLg = EdgeInsets.symmetric(vertical: lg);

  Spacing._();
}

class AppRadius {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 24;
  static const double xl = 24;
  static const double xxl = 28;
  static const double full = 9999;

  static const BorderRadius radiusXs = BorderRadius.all(Radius.circular(xs));
  static const BorderRadius radiusSm = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius radiusMd = BorderRadius.all(Radius.circular(md));
  static const BorderRadius radiusLg = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius radiusXl = BorderRadius.all(Radius.circular(xl));
  static const BorderRadius radiusXxl = BorderRadius.all(Radius.circular(xxl));
  static const BorderRadius radiusFull =
      BorderRadius.all(Radius.circular(full));

  static BorderRadius borderRadius(double radius) =>
      BorderRadius.circular(radius);

  AppRadius._();
}

class AppDurations {
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 300);
  static const Duration slow = Duration(milliseconds: 500);
  static const Duration xslow = Duration(milliseconds: 800);

  static const Curve defaultCurve = Curves.easeInOut;
  static const Curve bounceCurve = Curves.elasticOut;
  static const Curve sharpCurve = Curves.easeOutCubic;
  static const Curve premiumCurve =
      Curves.easeOutCubic; // ≈ web [0.22,1,0.36,1]

  AppDurations._();
}

class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      textTheme: GoogleFonts.plusJakartaSansTextTheme(),
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        primary: AppColors.primary,
        onPrimary: Colors.white,
        secondary: AppColors.success,
        surface: AppColors.surfaceContainer,
        onSurface: AppColors.onSurface,
        error: AppColors.error,
      ),
      scaffoldBackgroundColor: AppColors.surface,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        iconTheme: const IconThemeData(color: AppColors.primary),
        titleTextStyle: GoogleFonts.plusJakartaSans(
          color: AppColors.onSurface,
          fontSize: 18,
          fontWeight: FontWeight.w800,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          elevation: 2,
          shadowColor: AppColors.primary.withValues(alpha: 0.4),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.full),
          ),
          minimumSize: const Size(double.infinity, 56),
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 60),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.full),
          ),
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFFF1F5F9), // slate-100
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.error, width: 2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.error, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: Spacing.lg,
          vertical: Spacing.md,
        ),
        labelStyle: GoogleFonts.plusJakartaSans(),
        hintStyle:
            GoogleFonts.plusJakartaSans(color: AppColors.onSurfaceDisabled),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
        ),
        margin: const EdgeInsets.symmetric(vertical: Spacing.sm),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.divider,
        thickness: 1,
      ),
    );
  }

  static ThemeData get darkTheme {
    const darkColors = ThemeColors.dark;
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      textTheme:
          GoogleFonts.plusJakartaSansTextTheme(ThemeData.dark().textTheme),
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        brightness: Brightness.dark,
        primary: AppColors.primary,
        onPrimary: Colors.white,
        secondary: AppColors.success,
        surface: darkColors.surface,
        onSurface: darkColors.onSurface,
        error: AppColors.error,
      ),
      scaffoldBackgroundColor: darkColors.surface,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        iconTheme: const IconThemeData(color: AppColors.primary),
        titleTextStyle: GoogleFonts.plusJakartaSans(
          color: darkColors.onSurface,
          fontSize: 18,
          fontWeight: FontWeight.w800,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.full),
          ),
          minimumSize: const Size(double.infinity, 60),
          textStyle: GoogleFonts.plusJakartaSans(
              fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 60),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.full),
          ),
          textStyle: GoogleFonts.plusJakartaSans(
              fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: darkColors.inputFill,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide:
              BorderSide(color: darkColors.outline.withValues(alpha: 0.3)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide:
              BorderSide(color: darkColors.outline.withValues(alpha: 0.3)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.error, width: 2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.error, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: Spacing.lg,
          vertical: Spacing.md,
        ),
        labelStyle: GoogleFonts.plusJakartaSans(),
        hintStyle:
            GoogleFonts.plusJakartaSans(color: darkColors.onSurfaceMuted),
      ),
      cardTheme: CardThemeData(
        color: darkColors.card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
        ),
        margin: const EdgeInsets.symmetric(vertical: Spacing.sm),
      ),
      dividerTheme: DividerThemeData(
        color: darkColors.divider,
        thickness: 1,
      ),
    );
  }

  AppTheme._();
}

/// Theme-aware color tokens.
///
/// Access via `AppColors.of(context)` to get the correct color for the
/// current brightness (light/dark). This replaces manual
/// `Theme.of(context).brightness == Brightness.dark` checks.
///
/// Usage:
/// ```dart
/// final colors = AppColors.of(context);
/// Container(color: colors.surface, child: Text('Hello', style: TextStyle(color: colors.onSurface)))
/// ```
class ThemeColors {
  static const ThemeColors light = ThemeColors._(
    surface: Color(0xFFF7F9FB),
    surfaceAlt: Color(0xFFF5F7FA),
    surfaceBright: Color(0xFFF8FAFC),
    surfaceSubtle: Color(0xFFF3F4F6),
    card: Color(0xFFFFFFFF),
    onSurface: Color(0xFF101828),
    onSurfaceVariant: Color(0xFF475467),
    onSurfaceMuted: Color(0xFF667085),
    divider: Color(0xFFE0E3E5),
    outline: Color(0xFFD0D5DD),
    outlineVariant: Color(0xFFE2E8F0),
    inputFill: Color(0xFFF1F5F9),
    iconBackground: Color(0xFFF1F5F9),
    success: Color(0xFF16A34A),
    successSurface: Color(0xFFDCFCE7),
    error: Color(0xFFEF4444),
    errorRed: Color(0xFFDC2626),
    errorSurface: Color(0xFFFEF2F2),
    warning: Color(0xFFF59E0B),
    warningSurface: Color(0xFFFFFBEB),
    primarySurface: Color(0xFFEFF6FF),
    successGreen: Color(0xFF16A34A),
  );

  static const ThemeColors dark = ThemeColors._(
    surface: Color(0xFF0F172A),
    surfaceAlt: Color(0xFF1E293B),
    surfaceBright: Color(0xFF1E293B),
    surfaceSubtle: Color(0xFF1E293B),
    card: Color(0xFF1E293B),
    onSurface: Color(0xFFF1F5F9),
    onSurfaceVariant: Color(0xFF94A3B8),
    onSurfaceMuted: Color(0xFF64748B),
    divider: Color(0xFF334155),
    outline: Color(0xFF475569),
    outlineVariant: Color(0xFF334155),
    inputFill: Color(0xFF1E293B),
    iconBackground: Color(0xFF1E293B),
    success: Color(0xFF34D399),
    successSurface: Color(0xFF064E3B),
    error: Color(0xFFFCA5A5),
    errorRed: Color(0xFFFCA5A5),
    errorSurface: Color(0xFF7F1D1D),
    warning: Color(0xFFFBBF24),
    warningSurface: Color(0xFF78350F),
    primarySurface: Color(0xFF1E293B),
    successGreen: Color(0xFF34D399),
  );

  final Color surface;
  final Color surfaceAlt;
  final Color surfaceBright;
  final Color surfaceSubtle;
  final Color card;
  final Color onSurface;
  final Color onSurfaceVariant;
  final Color onSurfaceMuted;
  final Color divider;
  final Color outline;
  final Color outlineVariant;
  final Color inputFill;
  final Color iconBackground;
  final Color success;
  final Color successSurface;
  final Color error;
  final Color errorRed;
  final Color errorSurface;
  final Color warning;
  final Color warningSurface;
  final Color primarySurface;
  final Color successGreen;

  const ThemeColors._({
    required this.surface,
    required this.surfaceAlt,
    required this.surfaceBright,
    required this.surfaceSubtle,
    required this.card,
    required this.onSurface,
    required this.onSurfaceVariant,
    required this.onSurfaceMuted,
    required this.divider,
    required this.outline,
    required this.outlineVariant,
    required this.inputFill,
    required this.iconBackground,
    required this.success,
    required this.successSurface,
    required this.error,
    required this.errorRed,
    required this.errorSurface,
    required this.warning,
    required this.warningSurface,
    required this.primarySurface,
    required this.successGreen,
  });
}
