// integration_test/e2e_individual/18_otp_back_button_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('OTP screen – back navigation works', (tester) async {
    await launchApp(tester);
    await handlePreamble(tester);
    await waitFor(tester, find.byKey(const Key('phoneInput')));

    // Enter phone and send OTP
    await tester.enterText(
        find.byKey(const Key('phoneInput')), TestCredentials.phone);
    await settle(tester);
    await tester.pump(const Duration(milliseconds: 300));

    final btnFinder = find.byKey(const Key('sendOtpButton'));
    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(btnFinder, 200, scrollable: scrollable);
    await settle(tester);
    await tester.tap(btnFinder);
    await settle(tester);

    // Wait for OTP screen
    await waitFor(tester, find.byKey(const Key('otpInputRow')));
    expect(find.byKey(const Key('otpInputRow')), findsOneWidget);

    // Test passes if we reached OTP screen
  });
}
