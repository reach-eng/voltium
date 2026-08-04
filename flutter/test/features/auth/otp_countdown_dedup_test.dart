/// PR-130 (RA-F-2) — OTP timer dedup test
///
/// The original `OTPTimer` + `AnimatedOTPTimer` widgets in
/// `lib/features/auth/widgets/otp_timer.dart` (both StatefulWidget
/// with their own internal Timer.periodic) were duplicate
/// implementations of the same logic that the parent screen
/// (`otp_verification_screen.dart`) already owned via
/// `_resendCountdown` + `OtpResendWidget`.
///
/// This test asserts:
/// 1. The duplicated widgets are removed
/// 2. `OtpResendWidget` is the canonical answer
/// 3. The parent screen passes `remainingSeconds` to the widget
library;

import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('duplicate OTPTimer widget is removed (PR-130 dedup)', () {
    final oldFile = File('lib/features/auth/widgets/otp_timer.dart');
    expect(
      oldFile.existsSync(),
      isFalse,
      reason: 'otp_timer.dart must be deleted; the OTP countdown is owned by '
          'OtpResendWidget + the parent screen state. See PR-130.',
    );
  });

  test('OtpResendWidget is the canonical answer (defined)', () {
    final widgetFile = File(
      'lib/features/auth/presentation/widgets/otp_resend_widget.dart',
    );
    expect(widgetFile.existsSync(), isTrue);
    final content = widgetFile.readAsStringSync();
    expect(content, contains('class OtpResendWidget'));
    expect(content, contains('remainingSeconds'));
    expect(content, contains('onResend'));
  });

  test('OtpResendWidget is the widget used by otp_verification_screen', () {
    final screenFile = File(
      'lib/features/auth/presentation/screens/otp_verification_screen.dart',
    );
    expect(screenFile.existsSync(), isTrue);
    final content = screenFile.readAsStringSync();
    // The screen imports OtpResendWidget and uses it.
    expect(
      content,
      contains(
          'package:voltium_rider/features/auth/presentation/widgets/otp_resend_widget.dart'),
    );
    expect(content, contains('OtpResendWidget('));
    // And it passes remainingSeconds from its own state.
    expect(content, contains('remainingSeconds:'));
  });

  test('otp_verification_screen still owns the countdown state (single source)',
      () {
    final screenFile = File(
      'lib/features/auth/presentation/screens/otp_verification_screen.dart',
    );
    final content = screenFile.readAsStringSync();
    // The parent screen must own _resendCountdown and the Timer.
    // This is what OtpResendWidget depends on (it is StatelessWidget
    // that just reads remainingSeconds).
    expect(content, contains('_resendCountdown'));
    expect(content, contains('_countdownTimer'));
    // The parent must call _countdownTimer?.cancel() in dispose.
    expect(content, contains('_countdownTimer?.cancel()'));
  });
}
