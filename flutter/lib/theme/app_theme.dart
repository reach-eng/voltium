import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  // Brand Colors
  static const Color primary = Color(0xFF0053C1);
  static const Color primaryLight = Color(0xFFB1CFF5);
  static const Color primaryLighter = Color(0xFFE3EDFA);
  static const Color primaryDark = Color(0xFF003899);
  static const Color primaryGradientEnd = Color(0xFF2F6DDE);

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

  // Feature Colors
  static const Color evPurple = Color(0xFF8B5CF6);
  static const Color evPurpleLight = Color(0xFFEDE9FE);

  AppColors._();
}

class AppGradients {
  /// Primary brand gradient: #0053C1 → #2F6DDE (135deg)
  static const LinearGradient primary = LinearGradient(
    colors: [Color(0xFF0053C1), Color(0xFF2F6DDE)],
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
      color: Color(0x0A0F172A),
      blurRadius: 48,
      offset: Offset(0, 24),
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
      textTheme: GoogleFonts.interTextTheme(),
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
        titleTextStyle: GoogleFonts.inter(
          color: AppColors.onSurface,
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
          minimumSize: const Size(double.infinity, 56),
          textStyle: GoogleFonts.inter(
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.full),
          ),
          textStyle: GoogleFonts.inter(
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: GoogleFonts.inter(fontWeight: FontWeight.bold),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        fillColor: Colors.transparent,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: Spacing.lg,
          vertical: Spacing.md,
        ),
        labelStyle: GoogleFonts.inter(),
        hintStyle: GoogleFonts.inter(color: AppColors.onSurfaceDisabled),
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
    const darkColors = _DarkColors();
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
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
        titleTextStyle: GoogleFonts.inter(
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
          minimumSize: const Size(double.infinity, 56),
          textStyle:
              GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.full),
          ),
          textStyle:
              GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: GoogleFonts.inter(fontWeight: FontWeight.bold),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        fillColor: Colors.transparent,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: Spacing.lg,
          vertical: Spacing.md,
        ),
        labelStyle: GoogleFonts.inter(),
        hintStyle: GoogleFonts.inter(color: AppColors.onSurfaceMuted),
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

class _DarkColors {
  const _DarkColors();

  final Color surface = const Color(0xFF0F172A);
  final Color onSurface = const Color(0xFFF1F5F9);
  final Color card = const Color(0xFF1E293B);
  final Color inputFill = const Color(0xFF1E293B);
  final Color divider = const Color(0xFF334155);
}
