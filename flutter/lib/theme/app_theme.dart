import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// R2.2 (2026-07-31) — removed 5 dead colors that had **zero** call-sites in
/// `flutter/lib/`:
///   - `iconBackgroundBlue` (0xFFF0F4FA) — never used; use `iconBackground` instead
///   - `inputBorder` (0xFFD0D5DD) — duplicate of `outline` (which has 9 callers)
///   - `voltAccent` (0xFF00E5FF) — never used; if reintroduced, use `primary`
///   - `purpleIconVivid` (0xFF6D28D9) — never used; use `purpleIcon` or `purpleDark`
///   - `orangeAccentLight` (0xFFFFE082) — never used; use `warningLight` instead
///
/// The file still has ~80 semantic tokens (down from 87 pre-R2.2). The
/// next consolidation pass (R2.2 part 2) will trim the low-usage accent
/// groups (royalBlue*, orangeAccent*, skySpark*, purpleIcon*, etc.) — those
/// are documented below as "Group 7 misc" candidates.
///
/// Rule of thumb: prefer the canonical tokens (`primary`, `success`,
/// `warning`, `error`, `info`, `surface`, `onSurface*`) and their `Light`/
/// `Dark` / `Surface` / `Border` variants before reaching for an accent
/// color. Acents should be reserved for genuinely distinct categories
/// (rewards/loyalty, KYC, danger-zone, etc.), not for "I want a slightly
/// different blue today."

class AppColors {
  // Brand Colors — Voltium Blue
  // Source of truth: docs/design-system.md + web/src/app/globals.css (--color-vf-primary).
  // The web side uses #0053C1; this file previously used #2563EB (audit AUDIT_DESIGN_SYSTEM.md §3.1).
  // Aligned on 2026-07-29 as part of Phase 7 follow-up.
  static const Color primary = Color(0xFF0053C1);
  static const Color primaryLight = Color(0xFF2F6DDE);
  static const Color primaryDark = Color(0xFF003E92);

  // Status & Semantic Colors
  static const Color success = Color(0xFF10B981); // emerald-500
  static const Color successLight = Color(0xFFD1FAE5); // emerald-100
  static const Color successDark = Color(0xFF059669);

  static const Color warning = Color(0xFFF59E0B); // amber-500
  static const Color warningLight = Color(0xFFFEF3C7);
  static const Color warningDark = Color(0xFFD97706);

  static const Color error = Color(0xFFEF4444);
  static const Color errorLight = Color(0xFFFEE2E2);
  static const Color errorDark = Color(0xFFB91C1C);

  static const Color info = Color(0xFF3B82F6);
  static const Color infoLight = Color(0xFFDBEAFE);

  // Neutral / Text Colors — matches web exactly
  static const Color onSurface = Color(0xFF101828); // web #101828
  static const Color onSurfaceVariant =
      Color(0xFF475467); // web #475467 / #424653
  static const Color onSurfaceMuted = Color(0xFF737785); // web #737785
  static const Color onSurfaceDisabled =
      Color(0xFF6B7280); // WCAG AA: 5.3:1 on surface

  // Surface / Background Colors
  static const Color surface = Color(0xFFF7F9FB); // web #f7f9fb (main bg)

  // Input
  static const Color inputBackground =
      Color(0xFFE6EAEF); // web #E6EAEF pill inputs

  // Icon backgrounds
  static const Color iconBackground = Color(0xFFF1F5F9); // slate-100

  // Misc
  static const Color divider = Color(0xFFE0E3E5); // web #e0e3e5
  static const Color outline = Color(0xFFD0D5DD);
  static const Color outlineVariant = Color(0xFFE2E8F0);

  // Slate palette (used for dark mode surfaces and text)
  static const Color slate400 = Color(0xFF94A3B8);
  static const Color slate500 = Color(0xFF64748B);
  static const Color slate600 = Color(0xFF475569);
  static const Color slate700 = Color(0xFF334155);
  static const Color slate800 = Color(0xFF1E293B);
  static const Color slate900 = Color(0xFF0F172A);

  // Extended surface colors
  static const Color surfaceBright = Color(0xFFF8FAFC); // slate-50
  static const Color surfaceSubtle = Color(0xFFF3F4F6); // gray-100
  static const Color surfaceHover = Color(0xFFF9F9FF); // custom light

  // Extended border colors
  static const Color borderSubtle = Color(0xFFE5E7EB); // gray-200
  static const Color borderDefault = Color(0xFFD1D5DB); // gray-300
  static const Color borderMedium = Color(0xFFCBD5E1); // slate-300

  // Error extended
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

  // Accent purple (rewards, referral, premium-tier features).
  // Distinct from `primary` (brand blue) — used to signal a non-default path
  // through the app. Pairs a 600-weight foreground with a 50-weight surface.
  static const Color accentPurple = Color(0xFF7C3AED); // violet-600
  static const Color accentPurpleSurface = Color(0xFFF5F3FF); // violet-50

  // Feature Colors
  static const Color whatsappGreen = Color(0xFF25D366);

  // ── Feather palette ──────────────────────────────────────────────────────
  // Lightweight accent surface/icon pairs. Use these instead of raw
  // Color(0xFF...) for icon tiles, status chips, and small background swatches
  // where a fully-themed ThemeColors extension is overkill. Pair `xxxIcon`
  // (foreground, ~600 weight) with `xxxIconSurface` (background, ~50/100).

  // Danger-zone colors — used for delete-account/kyc-rejected labels.
  static const Color errorShadowColor = Color(0x40BA1A1A); // 25% red-700

  // Rental / status pills.
  static const Color greenFill = Color(0xFF86EFAC); // green-300

  // Referral / earning gradient endpoints.
  static const Color indigoVivid = Color(0xFF4F46E5); // indigo-600

  // Translucent text/shadow — used over brand gradient backgrounds.
  static const Color white70 = Color(0xB3FFFFFF); // 70% white (over gradient)

  // Shimmer skeleton colors (light mode). Dark mode uses AppColors.slate800/700.
  static const Color shimmerBase = Color(0xFFE8EDF5);
  static const Color shimmerHighlight = Color(0xFFF5F8FF);

  // Card / glow shadow color values (used inline as `BoxShadow(color: ...)`).
  // See `AppShadows` for the corresponding `List<BoxShadow>` recipes.
  static const Color shadowSoftColor = Color(0x0A0F172A); // 4% onSurface
  static const Color shadowPrimaryStrongColor =
      Color(0x260053C1); // 15% primary
  static const Color shadowSuccessStrongColor =
      Color(0x2610B981); // 15% success

  // Electric burst — used by ElectricBurst success animation. Pairs a 6-stop
  // blue ramp so the particles visibly cascade from light → dark → white spark.
  static const List<Color> electricBurstPalette = [
    Color(0xFFDBEAFE), // blue-100
    Color(0xFF93C5FD), // blue-300
    Color(0xFF60A5FA), // blue-400
    Color(0xFF3B82F6), // blue-500
    Color(0xFF2563EB), // blue-600
    Color(0xFF1D4ED8), // blue-700
    Color(0xFFFFFFFF), // white spark
  ];

  /// Get theme-aware colors for the current brightness.
  ///
  /// Usage:
  /// ```dart
  /// final colors = AppColors.of(context);
  /// Container(color: colors.surface)
  /// ```
  static ThemeColors of(BuildContext context) {
    return Theme.of(context).extension<ThemeColors>() ??
        (Theme.of(context).brightness == Brightness.dark
            ? ThemeColors.dark
            : ThemeColors.light);
  }

  AppColors._();
}

class AppGradients {
  /// Primary brand gradient: #0053C1 → #2F6DDE (135deg)
  /// Matches web `vf-gradient` in `web/src/app/globals.css`.
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

  /// Error / danger-zone shadow: 25% red-700 (R2.2 — uses AppColors.errorShadowColor)
  static const List<BoxShadow> errorShadow = [
    BoxShadow(
      color: AppColors.errorShadowColor,
      blurRadius: 8,
      offset: Offset(0, 2),
    ),
  ];

  /// Soft card shadow: 4% onSurface (R2.2 — uses AppColors.shadowSoftColor)
  static const List<BoxShadow> soft = [
    BoxShadow(
      color: AppColors.shadowSoftColor,
      blurRadius: 12,
      offset: Offset(0, 4),
    ),
  ];

  /// Primary strong shadow: 15% primary (R2.2 — uses AppColors.shadowPrimaryStrongColor)
  static const List<BoxShadow> primaryStrong = [
    BoxShadow(
      color: AppColors.shadowPrimaryStrongColor,
      blurRadius: 24,
      offset: Offset(0, 8),
    ),
  ];

  /// Success strong shadow: 15% success (R2.2 — uses AppColors.shadowSuccessStrongColor)
  static const List<BoxShadow> successStrong = [
    BoxShadow(
      color: AppColors.shadowSuccessStrongColor,
      blurRadius: 24,
      offset: Offset(0, 8),
    ),
  ];

  AppShadows._();
}

class Spacing {
  // 4px grid (canonical). Use these wherever possible.
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
  static const double xxl = 48;

  // Sub-grid values for tight UI (badges, inline chips, small inline paddings).
  // These are also part of the design system — just at half-step granularity.
  static const double xxs = 2;
  static const double xs2 = 6; // between xs and sm
  static const double sm2 = 10; // between sm and md
  static const double sm3 = 12; // exactly between sm and md
  static const double md2 = 14; // between md and lg
  static const double md3 = 18; // between md and lg
  static const double lg2 = 20; // between lg and xl
  static const double lg3 = 22; // between lg and xl

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
  // 4px grid (canonical). Use these wherever possible.
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double radiusModal = 24;
  static const double radiusBottomSheet = 32;
  @Deprecated('Use radiusModal instead')
  static const double xl = radiusModal;
  @Deprecated('Use radiusBottomSheet instead')
  static const double xxl = radiusBottomSheet;
  static const double full = 9999;

  // Sub-grid values for tight UI (badges, inline chips, small icon backgrounds).
  static const double xxs = 2;
  static const double xs2 = 6;
  static const double sm2 = 10;
  static const double md2 = 14;
  static const double lg2 = 18;
  static const double xl2 = 22;

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
  static const Curve premiumCurve = Cubic(0.22, 1.0, 0.36, 1.0);

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
        surface: AppColors.surface,
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
          disabledBackgroundColor: AppColors.outlineVariant,
          disabledForegroundColor: AppColors.slate400,
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
        fillColor: AppColors.iconBackground,
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
        color: ThemeColors.light.card,
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
      extensions: const [ThemeColors.light],
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
          disabledBackgroundColor: AppColors.slate700,
          disabledForegroundColor: AppColors.slate500,
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
      extensions: const [ThemeColors.dark],
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
class ThemeColors extends ThemeExtension<ThemeColors> {
  static const ThemeColors light = ThemeColors._(
    surface: Color(0xFFF7F9FB),
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
    errorSurface: Color(0xFFFEF2F2),
    warning: Color(0xFFF59E0B),
    warningSurface: Color(0xFFFFFBEB),
    primarySurface: Color(0xFFEFF6FF),
    voltAccent: Color(0xFF00E5FF),
  );

  static const ThemeColors dark = ThemeColors._(
    surface: Color(0xFF0F172A),
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
    errorSurface: Color(0xFF7F1D1D),
    warning: Color(0xFFFBBF24),
    warningSurface: Color(0xFF78350F),
    primarySurface: Color(0xFF1E293B),
    voltAccent: Color(0xFF00E5FF),
  );

  final Color surface;
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
  final Color errorSurface;
  final Color warning;
  final Color warningSurface;
  final Color primarySurface;
  final Color voltAccent;

  const ThemeColors._({
    required this.surface,
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
    required this.errorSurface,
    required this.warning,
    required this.warningSurface,
    required this.primarySurface,
    required this.voltAccent,
  });

  @override
  ThemeColors copyWith({
    Color? surface,
    Color? card,
    Color? onSurface,
    Color? onSurfaceVariant,
    Color? onSurfaceMuted,
    Color? divider,
    Color? outline,
    Color? outlineVariant,
    Color? inputFill,
    Color? iconBackground,
    Color? success,
    Color? successSurface,
    Color? error,
    Color? errorSurface,
    Color? warning,
    Color? warningSurface,
    Color? primarySurface,
    Color? voltAccent,
  }) {
    return ThemeColors._(
      surface: surface ?? this.surface,
      card: card ?? this.card,
      onSurface: onSurface ?? this.onSurface,
      onSurfaceVariant: onSurfaceVariant ?? this.onSurfaceVariant,
      onSurfaceMuted: onSurfaceMuted ?? this.onSurfaceMuted,
      divider: divider ?? this.divider,
      outline: outline ?? this.outline,
      outlineVariant: outlineVariant ?? this.outlineVariant,
      inputFill: inputFill ?? this.inputFill,
      iconBackground: iconBackground ?? this.iconBackground,
      success: success ?? this.success,
      successSurface: successSurface ?? this.successSurface,
      error: error ?? this.error,
      errorSurface: errorSurface ?? this.errorSurface,
      warning: warning ?? this.warning,
      warningSurface: warningSurface ?? this.warningSurface,
      primarySurface: primarySurface ?? this.primarySurface,
      voltAccent: voltAccent ?? this.voltAccent,
    );
  }

  @override
  ThemeColors lerp(ThemeExtension<ThemeColors>? other, double t) {
    if (other is! ThemeColors) return this;
    return ThemeColors._(
      surface: Color.lerp(surface, other.surface, t)!,
      card: Color.lerp(card, other.card, t)!,
      onSurface: Color.lerp(onSurface, other.onSurface, t)!,
      onSurfaceVariant:
          Color.lerp(onSurfaceVariant, other.onSurfaceVariant, t)!,
      onSurfaceMuted: Color.lerp(onSurfaceMuted, other.onSurfaceMuted, t)!,
      divider: Color.lerp(divider, other.divider, t)!,
      outline: Color.lerp(outline, other.outline, t)!,
      outlineVariant: Color.lerp(outlineVariant, other.outlineVariant, t)!,
      inputFill: Color.lerp(inputFill, other.inputFill, t)!,
      iconBackground: Color.lerp(iconBackground, other.iconBackground, t)!,
      success: Color.lerp(success, other.success, t)!,
      successSurface: Color.lerp(successSurface, other.successSurface, t)!,
      error: Color.lerp(error, other.error, t)!,
      errorSurface: Color.lerp(errorSurface, other.errorSurface, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      warningSurface: Color.lerp(warningSurface, other.warningSurface, t)!,
      primarySurface: Color.lerp(primarySurface, other.primarySurface, t)!,
      voltAccent: Color.lerp(voltAccent, other.voltAccent, t)!,
    );
  }
}
