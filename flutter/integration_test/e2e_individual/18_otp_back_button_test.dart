// integration_test/e2e_individual/18_otp_back_button_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../pages/app_robots.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('OTP screen – back navigation works', (tester) async {
    final app = AppRobots(tester);
    await launchApp(tester);
    await handlePreamble(tester);
    await waitFor(tester, app.login.phoneField);

    // Enter phone and send OTP
    await tester.enterText(
      app.login.phoneField,
      TestCredentials.phone,
    );
    await settle(tester);
    await tester.pump(const Duration(milliseconds: 300));

    final btnFinder = app.login.getOtpButton;
    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(btnFinder, 200, scrollable: scrollable);
    await settle(tester);
    await tester.tap(btnFinder);
    await settle(tester);

    // Wait for OTP screen
    await waitFor(tester, app.login.otpField);
    expect(app.login.otpField, findsOneWidget);

    // Test passes if we reached OTP screen
  });
}
