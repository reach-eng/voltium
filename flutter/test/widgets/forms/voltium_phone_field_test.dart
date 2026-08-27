import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/widgets/forms/forms.dart';

void main() {
  Widget buildTestable(Widget child) {
    return MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: AppTheme.lightTheme,
      home: Scaffold(
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: child,
        ),
      ),
    );
  }

  group('VoltiumPhoneField Widget Tests', () {
    testWidgets('1. Read-only mode displays formatted phone and phone icon',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(
          const VoltiumPhoneField(
            label: 'Phone Number',
            isReadOnly: true,
            readOnlyDisplay: '+91 98765 43210',
          ),
        ),
      );

      expect(find.text('PHONE NUMBER'), findsOneWidget);
      expect(find.text('+91 98765 43210'), findsOneWidget);
      expect(find.byIcon(Icons.phone), findsOneWidget);
      expect(find.byKey(const Key('sendOtpButton')), findsNothing);
    });

    testWidgets(
        '2. Editable mode shows Send OTP button when unverified and OTP not sent',
        (tester) async {
      final controller = TextEditingController(text: '9876543210');
      var sendOtpCalled = false;

      await tester.pumpWidget(
        buildTestable(
          VoltiumPhoneField(
            fieldKey: const Key('guarantorPhoneField'),
            label: 'Guarantor Phone Number',
            controller: controller,
            isPhoneVerified: false,
            isOtpSent: false,
            onSendOtp: () => sendOtpCalled = true,
          ),
        ),
      );

      expect(find.text('GUARANTOR PHONE NUMBER'), findsOneWidget);
      final sendBtn = find.byKey(const Key('sendOtpButton'));
      expect(sendBtn, findsOneWidget);

      await tester.tap(sendBtn);
      expect(sendOtpCalled, isTrue);
    });

    testWidgets('3. Send OTP button is disabled when phone has < 10 digits',
        (tester) async {
      final controller = TextEditingController(text: '98765');

      await tester.pumpWidget(
        buildTestable(
          VoltiumPhoneField(
            fieldKey: const Key('guarantorPhoneField'),
            label: 'Guarantor Phone Number',
            controller: controller,
            isPhoneVerified: false,
            isOtpSent: false,
            onSendOtp: () {},
          ),
        ),
      );

      final button =
          tester.widget<ElevatedButton>(find.byKey(const Key('sendOtpButton')));
      expect(button.onPressed, isNull);
    });

    testWidgets(
        '4. Send OTP button shows loading spinner when isSendingOtp is true',
        (tester) async {
      final controller = TextEditingController(text: '9876543210');

      await tester.pumpWidget(
        buildTestable(
          VoltiumPhoneField(
            fieldKey: const Key('guarantorPhoneField'),
            label: 'Guarantor Phone Number',
            controller: controller,
            isPhoneVerified: false,
            isSendingOtp: true,
            isOtpSent: false,
          ),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('5. Shows cooldown seconds when resendCooldown > 0',
        (tester) async {
      final controller = TextEditingController(text: '9876543210');

      await tester.pumpWidget(
        buildTestable(
          VoltiumPhoneField(
            fieldKey: const Key('guarantorPhoneField'),
            label: 'Guarantor Phone Number',
            controller: controller,
            isPhoneVerified: false,
            isOtpSent: true,
            resendCooldown: 25,
          ),
        ),
      );

      expect(find.text('25s'), findsOneWidget);
      final button =
          tester.widget<ElevatedButton>(find.byKey(const Key('sendOtpButton')));
      expect(button.onPressed, isNull);
    });

    testWidgets(
        '6. Shows OTP boxes and Verify button when isOtpSent is true and unverified',
        (tester) async {
      final controller = TextEditingController(text: '9876543210');
      var verifyOtpCalled = false;

      await tester.pumpWidget(
        buildTestable(
          VoltiumPhoneField(
            fieldKey: const Key('guarantorPhoneField'),
            label: 'Guarantor Phone Number',
            controller: controller,
            isPhoneVerified: false,
            isOtpSent: true,
            otpBoxes: const Text('CustomOtpBoxesWidget'),
            onVerifyOtp: () => verifyOtpCalled = true,
          ),
        ),
      );

      expect(find.text('CustomOtpBoxesWidget'), findsOneWidget);
      final verifyBtn = find.byKey(const Key('verifyOtpButton'));
      expect(verifyBtn, findsOneWidget);

      await tester.tap(verifyBtn);
      expect(verifyOtpCalled, isTrue);
    });

    testWidgets(
        '7. Verify button shows loading spinner when isVerifyingOtp is true',
        (tester) async {
      final controller = TextEditingController(text: '9876543210');

      await tester.pumpWidget(
        buildTestable(
          VoltiumPhoneField(
            fieldKey: const Key('guarantorPhoneField'),
            label: 'Guarantor Phone Number',
            controller: controller,
            isPhoneVerified: false,
            isOtpSent: true,
            isVerifyingOtp: true,
          ),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets(
        '8. Shows green check and Phone Number Verified when isPhoneVerified is true',
        (tester) async {
      final controller = TextEditingController(text: '9876543210');

      await tester.pumpWidget(
        buildTestable(
          VoltiumPhoneField(
            fieldKey: const Key('guarantorPhoneField'),
            label: 'Guarantor Phone Number',
            controller: controller,
            isPhoneVerified: true,
          ),
        ),
      );

      expect(find.text('Phone Number Verified'), findsOneWidget);
      expect(find.byIcon(Icons.check_circle), findsOneWidget);
      expect(find.byKey(const Key('sendOtpButton')), findsNothing);
      expect(find.byKey(const Key('verifyOtpButton')), findsNothing);
    });
  });
}
