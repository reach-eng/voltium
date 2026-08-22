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

  // PR-1 (F-001): the test-mode surface has three separate gates:
  //   1. `TEST_MODE=true` build-time dart-define (compile-time, no runtime flip)
  //   2. `KYC_TEST_AUTOFILL=true` build-time dart-define (compile-time,
  //      unblocks the KYC form auto-fill + mock-URL branches so the
  //      integration-test harness can run without a real Aadhaar photo)
  //   3. `isTestModeOverride` runtime static (set by `driver_main.dart` and
  //      by widget tests; debug builds only — see the assert below)
  //
  // The previous `isTestMode` getter conflated (1) and (3) and let (3) leak
  // into release: any future refactor that dropped the outer `!kReleaseMode`
  // gate would silently enable all six test-mode short-circuits (OTP verify,
  // OTP send, KYC submit, permissions continue, KYC auto-fill, driver
  // extension). The 2026-08-22 deep audit (F-001) closed that gap by
  // asserting in release and by replacing the OTP / KYC / permissions
  // bypasses with their real form-completeness checks.
  static bool isTestModeOverride = false;

  static const bool _isTestModeBuildTime =
      bool.fromEnvironment('TEST_MODE', defaultValue: false);

  /// Build-time flag that unblocks the KYC test auto-fill + mock-URL
  /// branches in `user_onboarding_screen.dart`. Off by default; the
  /// integration test harness passes `--dart-define=KYC_TEST_AUTOFILL=true`.
  static const bool kycTestAutofill =
      bool.fromEnvironment('KYC_TEST_AUTOFILL', defaultValue: false);

  /// True only when running in a debug build AND one of the three gates
  /// is set. In release builds, even an explicit `isTestModeOverride = true`
  /// will trip the assert below — that's the F-001 hardening.
  static bool get isTestMode {
    assert(
      !isTestModeOverride || !kReleaseMode,
      'isTestModeOverride must never be true in a release build. '
      'This is the F-001 release-build gate; the previous test-mode flag '
      'leaked into a debug-built sideload and bypassed OTP, KYC, '
      'permissions, and the KYC form-completeness check.',
    );
    return !kReleaseMode && (isTestModeOverride || _isTestModeBuildTime);
  }

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

  // ── AUDIT-FIX CONSTANTS (2026-08-22 screen audit) ──────────────────
  // NOTE: a concurrent session rewrote this file mid-flight and dropped
  // these; they were restored because multiple fixed screens reference
  // them. Keep them when refactoring.

  /// UPI VPA riders pay top-ups to.
  /// TODO(config): serve from settings/config endpoint (remote kill-switch).
  static const String companyUpiVpa = 'payments.voltium@icici';

  /// Default pre-filled top-up amount (rupees).
  static const int walletDefaultTopUpAmount = 1000;

  /// Quick-select chips on the top-up amount screen (rupees).
  static const List<int> walletQuickTopUpAmounts = [500, 1000, 2000, 5000];

  /// Minimum accepted top-up (rupees).
  static const int walletMinTopUpAmount = 100;

  /// Base URL for referral deep links (code is appended verbatim).
  static const String referralDeepLinkBaseUrl = 'https://voltium.app/ref/';

  /// Reward copy shown on the referral hero card.
  static const String referralBonusCopy =
      'you both get 50 bonus points when they take their first ride.';

  /// Play Store listing used by the in-app "Rate us" prompt.
  static const String playStoreListingUrl =
      'https://play.google.com/store/apps/details?id=com.voltiumelectric.voltium';
}
