// integration_test/e2e_individual/04_debug_login_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../pages/app_robots.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Debug login auto-submit step by step', (tester) async {
    final app = AppRobots(tester);
    await resetAppState();
    await safeAppMain();
    await settle(tester);
    await tester.pump(const Duration(seconds: 3));
    await settle(tester);

    await waitFor(tester, app.login.phoneField);
    print('DEBUG: on login screen');

    await tester.enterText(
      app.login.phoneField,
      TestCredentials.phone,
    );
    print('DEBUG: entered phone');

    // Step 1: 500ms pump
    await tester.pump(const Duration(milliseconds: 500));
    final hasOtp1 = app.login.otpField.evaluate().isNotEmpty;
    print('DEBUG: after 500ms otp=$hasOtp1');

    // Step 2: pumpAndSettle
    await settle(tester);
    final hasOtp2 = app.login.otpField.evaluate().isNotEmpty;
    print('DEBUG: after pumpAndSettle otp=$hasOtp2');

    // Step 3: 2s pump
    await tester.pump(const Duration(seconds: 2));
    final hasOtp3 = app.login.otpField.evaluate().isNotEmpty;
    print('DEBUG: after 2s otp=$hasOtp3');

    // Step 4: final pumpAndSettle
    await settle(tester);
    final hasOtp4 = app.login.otpField.evaluate().isNotEmpty;
    final hasPhone = app.login.phoneField.evaluate().isNotEmpty;
    print('DEBUG: final otp=$hasOtp4 phone=$hasPhone');
  });
}
