import 'package:flutter/material.dart';

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
