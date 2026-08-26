// Voltium — OtpVerificationScreen widget split smoke tests
//
// Covers the four widgets extracted in PR-P2.3:
//   - OtpAppBar        (back btn + "VOLTIUM" wordmark)
//   - OtpResendWidget  (timer + "Resend Code" / "Resend in Ns")
//   - OtpVerifyButton  ("Verify & Proceed" pill button)
//
// Like the LoginScreen widget tests, these deliberately avoid
// OtpVerificationScreen itself because it transitively imports the
// currently-missing `app_provider.dart` (a pre-existing repo issue).
// The widgets are pure UI and don't need Riverpod.

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/otp_app_bar.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/otp_resend_widget.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/otp_verify_button.dart';

void main() {
  group('OtpAppBar', () {
    testWidgets('renders back button and Voltium wordmark', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: OtpAppBar()),
        ),
      );
      await tester.pump();

      expect(find.text('Voltium'), findsOneWidget);
      expect(find.byIcon(Icons.arrow_back), findsOneWidget);
    });

    testWidgets('invokes onBack when back button is tapped', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OtpAppBar(onBack: () => taps++),
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pump();
      expect(taps, 1);
    });
  });

  group('OtpResendWidget', () {
    testWidgets('shows "Resend in Ns" while countdown > 0', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OtpResendWidget(
              remainingSeconds: 25,
              onResend: () {},
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text("DIDN'T RECEIVE THE CODE?"), findsOneWidget);
      expect(find.text('Resend in 25s'), findsOneWidget);
      expect(find.byKey(const Key('resendCodeButton')), findsOneWidget);
    });

    testWidgets('shows "Resend Code" once countdown reaches 0', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OtpResendWidget(
              remainingSeconds: 0,
              onResend: () {},
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('Resend Code'), findsOneWidget);
    });

    testWidgets('does not invoke onResend while countdown > 0', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OtpResendWidget(
              remainingSeconds: 25,
              onResend: () => taps++,
            ),
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.byKey(const Key('resendCodeButton')));
      await tester.pump();
      expect(taps, 0);
    });

    testWidgets('invokes onResend when countdown is 0', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OtpResendWidget(
              remainingSeconds: 0,
              onResend: () => taps++,
            ),
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.byKey(const Key('resendCodeButton')));
      await tester.pump();
      expect(taps, 1);
    });
  });

  group('OtpVerifyButton', () {
    testWidgets('renders with key and label', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OtpVerifyButton(
              canVerify: true,
              isLoading: false,
              onPressed: () {},
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.byKey(const Key('verifyOtpButton')), findsOneWidget);
      expect(find.text('Verify & Proceed'), findsOneWidget);
      expect(find.byIcon(Icons.arrow_forward), findsOneWidget);
    });

    testWidgets('shows spinner when isLoading=true', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OtpVerifyButton(
              canVerify: true,
              isLoading: true,
              onPressed: () {},
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Verify & Proceed'), findsNothing);
    });

    testWidgets('invokes onPressed when canVerify=true and not loading',
        (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OtpVerifyButton(
              canVerify: true,
              isLoading: false,
              onPressed: () => taps++,
            ),
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.byKey(const Key('verifyOtpButton')));
      await tester.pump();
      expect(taps, 1);
    });

    testWidgets(
        'button is not interactive when canVerify=false and not test mode',
        (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OtpVerifyButton(
              canVerify: false,
              isLoading: false,
              onPressed: () => taps++,
            ),
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.byKey(const Key('verifyOtpButton')));
      await tester.pump();
      expect(taps, 0);
    });
  });
}

/// Test-only TickerProvider stand-in (kept here for symmetry with
/// the LoginScreen widget tests).
class _TestVSync implements TickerProvider {
  const _TestVSync();
  @override
  Ticker createTicker(TickerCallback onTick) => Ticker(onTick);
}
