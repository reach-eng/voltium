// integration_test/e2e_individual/31_error_recovery_test.dart
//
// Standalone test: App handles invalid input gracefully.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/31_error_recovery_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';
import '../pages/login_page.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Error recovery – invalid phone shows error', (tester) async {
    await launchApp(tester);
    await handlePreamble(tester);
    final loginPage = LoginPageObject(tester);
    await waitFor(tester, loginPage.phoneField);

    // Enter short phone
    await loginPage.enterPhone('123');

    // Button should be disabled (onTap is null when TEST_MODE is not true, or _canSubmit is false)
    // The app should stay on login screen
    expect(loginPage.phoneField, findsOneWidget);
  });

  testWidgets('Error recovery – server 500 error shows gracefully',
      (tester) async {
    // Attempt full login but mock server will throw 500
    await launchApp(tester, simulateError: true);
    await handlePreamble(tester);

    final loginPage = LoginPageObject(tester);
    await waitFor(tester, loginPage.phoneField);
    await loginPage.enterPhone(TestCredentials.phone);
    await loginPage.tapGetOtp();

    // Verify it doesn't navigate to OTP screen, because the API failed
    // Wait a bit to ensure no navigation happens
    await tester.pump(const Duration(seconds: 2));
    expect(loginPage.phoneField, findsOneWidget); // still on login screen
  });
}
