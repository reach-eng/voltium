import 'package:flutter/foundation.dart';

class AppConstants {
  static const double lowBalanceThresholdRatio = 0.3;

  static const double depositRefundThreshold = 2000.0;

  static const int defaultPaginationLimit = 20;

  static const int maxUploadFileSizeMb = 10;

  static const Duration sessionTimeout = Duration(minutes: 30);

  static const Duration otpResendCooldown = Duration(seconds: 30);

  static bool isTestModeOverride = false;

  static bool get isTestMode =>
      !kReleaseMode &&
      (isTestModeOverride ||
          const String.fromEnvironment('TEST_MODE') == 'true');

  // ── Plan durations ───────────────────────────────────────────────────
  /// Maps a plan name (uppercase) to its duration in days.
  static const Map<String, int> planDurationDays = {
    'DAILY': 1,
    'DAILY_FLEX': 1,
    'WEEKLY': 7,
    'WEEKLY_BASIC': 7,
    'WEEKLY_MAX': 7,
    'MONTHLY': 30,
    'MONTHLY_PREMIUM': 30,
  };

  /// Default duration when plan name is unknown.
  static const int defaultPlanDurationDays = 7;

  /// Returns the duration in days for [planName], or [defaultPlanDurationDays]
  /// if the plan is unknown or null.
  static int getPlanDurationDays(String? planName) {
    if (planName == null) return defaultPlanDurationDays;
    return planDurationDays[planName.toUpperCase()] ?? defaultPlanDurationDays;
  }

  /// Returns a human-readable duration label for a given number of days.
  static String planDurationLabel(int days) {
    if (days == 1) return 'day';
    if (days == 7) return 'week';
    if (days == 30) return 'month';
    return '$days days';
  }

  // ── Plan pricing (fallback values) ─────────────────────────────────
  /// Fallback rental price in rupees per plan (used when backend price is unavailable).
  static const Map<String, double> planPriceRupees = {
    'DAILY_FLEX': 250.0,
    'WEEKLY_BASIC': 1000.0,
    'WEEKLY_MAX': 1500.0,
    'MONTHLY_PREMIUM': 2500.0,
  };

  /// Fallback security deposit in rupees per plan.
  static const Map<String, double> planSecurityDepositRupees = {
    'DAILY_FLEX': 500.0,
    'WEEKLY_BASIC': 1000.0,
    'WEEKLY_MAX': 1500.0,
    'MONTHLY_PREMIUM': 2500.0,
  };

  static const double defaultPlanPrice = 1500.0;
  static const double defaultSecurityDeposit = 1500.0;

  /// Returns the fallback rental price for [planName].
  static double getPlanPrice(String? planName) {
    if (planName == null) return defaultPlanPrice;
    return planPriceRupees[planName.toUpperCase()] ?? defaultPlanPrice;
  }

  /// Returns the fallback security deposit for [planName].
  static double getPlanSecurityDeposit(String? planName) {
    if (planName == null) return defaultSecurityDeposit;
    return planSecurityDepositRupees[planName.toUpperCase()] ??
        defaultSecurityDeposit;
  }
}
