/// Centralized haptic feedback for the Voltium Rider app.
///
/// Pre-PR-6: haptic calls existed in 5 places (OTP digit, referral copy,
/// top-up amount input, top-up proof) but were scattered raw
/// `HapticFeedback.lightImpact()` calls. There was no medium-impact
/// for high-stakes money / auth actions, no success pattern, and no
/// error pattern. This service centralizes the API, adds the missing
/// levels, and is test-mode-safe so widget tests don't block waiting
/// for haptic responses.
///
/// 3 levels of feedback that match the action's stakes:
///
///   - [HapticService.selection]   — light tick for low-stakes choices
///                                   (toggling a tab, picking a digit,
///                                    checking a box, opening a sheet)
///   - [HapticService.light]       — soft tap for medium-stakes actions
///                                   (resending an OTP, marking a
///                                    notification as read)
///   - [HapticService.medium]      — firm tap for high-stakes money /
///                                   auth actions (Send OTP, Verify,
///                                    Pay, Submit KYC, Top Up)
///   - [HapticService.success]     — double-pulse "yay" pattern for
///                                   successful completions (top-up
///                                   confirmed, rental ended, KYC
///                                   approved)
///   - [HapticService.error]       — triple-pulse "uh oh" for failures
///                                   (wrong OTP, failed top-up, KYC
///                                   rejected)
///
/// Usage:
/// ```dart
/// onPressed: () {
///   HapticService.medium();
///   _handleVerify();
/// }
/// ```
///
/// The service is a no-op on platforms that don't support haptics
/// (e.g. desktop test runs) and on test mode (so automated tests don't
/// block waiting for haptic responses).
library;

import 'package:flutter/services.dart';
import 'package:voltium_rider/utils/app_constants.dart';

class HapticService {
  HapticService._();

  /// Light tick — used for low-stakes selections.
  /// Examples: OTP digit entry, tab switch, toggle.
  static Future<void> selection() => _guard(() {
        return HapticFeedback.selectionClick();
      });

  /// Soft tap — used for medium-stakes actions.
  /// Examples: Resend OTP, refresh list, mark notification read.
  static Future<void> light() => _guard(() {
        return HapticFeedback.lightImpact();
      });

  /// Firm tap — used for high-stakes money / auth actions.
  /// Examples: Send OTP, Verify, Pay, Submit KYC, Top Up.
  static Future<void> medium() => _guard(() {
        return HapticFeedback.mediumImpact();
      });

  /// Double-pulse success pattern. Use sparingly so it stays special.
  /// Examples: top-up confirmed, rental ended, KYC approved.
  static Future<void> success() => _guard(() async {
        await HapticFeedback.lightImpact();
        await Future<void>.delayed(const Duration(milliseconds: 80));
        await HapticFeedback.mediumImpact();
      });

  /// Triple-pulse error pattern.
  /// Examples: wrong OTP, failed top-up, KYC rejected.
  static Future<void> error() => _guard(() async {
        await HapticFeedback.heavyImpact();
        await Future<void>.delayed(const Duration(milliseconds: 60));
        await HapticFeedback.mediumImpact();
        await Future<void>.delayed(const Duration(milliseconds: 60));
        await HapticFeedback.heavyImpact();
      });

  /// No-op in test mode (so widget tests don't wait for haptic
  /// responses), and best-effort on real devices. Failures are swallowed
  /// so a missing haptic module on a stripped-down OEM build never
  /// crashes the app.
  static Future<void> _guard(Future<void> Function() fn) async {
    if (AppConstants.isTestMode) return;
    try {
      await fn();
    } catch (_) {
      // Best effort — haptics are a nice-to-have, never a hard requirement.
    }
  }
}
