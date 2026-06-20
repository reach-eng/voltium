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
      !kReleaseMode && (isTestModeOverride || const String.fromEnvironment('TEST_MODE') == 'true');
}
