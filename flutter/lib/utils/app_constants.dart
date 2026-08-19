import 'package:flutter/foundation.dart';

class AppConstants {
  static const double lowBalanceThresholdRatio = 0.3;

  static const double depositRefundThreshold = 2000.0;
  static const double defaultRentalPrice = 2000.0;

  static const int defaultPaginationLimit = 20;

  static const int maxUploadFileSizeMb = 10;

  static const Duration sessionTimeout = Duration(minutes: 30);

  static const Duration otpResendCooldown = Duration(seconds: 30);

  /// PR-PICKUP-OTP: how long a successfully verified emergency-contact OTP
  /// stays trusted after a pickup-draft resume. The server's OTP is
  /// single-use with a 5-minute expiry and `verify-phone` issues no token,
  /// so the client persists a short-lived receipt (verifiedPhone +
  /// verifiedAt) and honors it only inside this window — a resumed rider
  /// skips re-verification within the pickup session, but the proof can
  /// never be reused indefinitely (post-window it re-verifies, exactly as
  /// a fresh session would).
  static const Duration emergencyContactVerificationWindow =
      Duration(minutes: 15);

  /// Pure freshness check for a phone-OTP receipt (single source of truth —
  /// the pickup emergency-contact flow and the guarantor onboarding flow
  /// both call this so the window logic cannot drift). A receipt counts as
  /// fresh only when it was issued for the exact same phone (digits-
  /// stripped) AND is inside the window; future timestamps (clock skew /
  /// tampering) are rejected.
  static bool isEmergencyContactVerificationFresh({
    required String? verifiedPhone,
    required String? contact,
    required int? verifiedAt,
    DateTime? now,
  }) {
    if (verifiedPhone == null || verifiedAt == null || contact == null) {
      return false;
    }
    final contactDigits = contact.replaceAll(RegExp(r'\D'), '');
    if (contactDigits.isEmpty) return false;
    if (verifiedPhone.replaceAll(RegExp(r'\D'), '') != contactDigits) {
      return false;
    }
    final current = now ?? DateTime.now();
    final delta = current.millisecondsSinceEpoch - verifiedAt;
    return delta >= 0 &&
        delta <= emergencyContactVerificationWindow.inMilliseconds;
  }

  static bool isTestModeOverride = false;

  static bool get isTestMode =>
      !kReleaseMode &&
      (isTestModeOverride ||
          (!kReleaseMode &&
              const String.fromEnvironment('TEST_MODE') == 'true'));

  // Plan durations — kept here because they're a static app config
  // (not user-modifiable). The plan name → days mapping mirrors the
  // `getDurationForPlanType` helper in `web/src/server/modules/plans/plan.use-cases.ts`
  // so the client can render "7 days" copy without a network round-trip.
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

  // PR-47 (WALLET P1-1): the hardcoded `planPriceRupees` /
  // `planSecurityDepositRupees` / `defaultPlanPrice` /
  // `defaultSecurityDeposit` / `getPlanPrice` / `getPlanSecurityDeposit`
  // fallback block has been removed. Plan prices and security deposits
  // now flow from the backend (`plan.use-cases.ts:56-57, 73-74` and the
  // new `currentPlanRef.securityDepositInPaise` join on the rider
  // dashboard). The old fallbacks drifted from server truth and were
  // the root cause of the audit's hardcoded-price finding.
}
