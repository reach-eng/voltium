// integration_test/e2e_individual/00_diagnostic_test.dart
//
// Diagnostic test to verify app launches and preamble completes.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/00_diagnostic_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../pages/app_robots.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Diagnostic – app launches and preamble completes',
      (tester) async {
    final app = AppRobots(tester);
    await setupReturningUser();
    await safeAppMain();
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 3));
    await settle(tester);

    // Handle preamble screens (permissions, legal, etc.)
    await handlePreamble(tester);
    await settle(tester);

    // Check for known screens
    final hasPhone = app.login.phoneField.evaluate().isNotEmpty;
    final hasDashboard = app.dashboard.dashboardTab.evaluate().isNotEmpty;
    final hasAuthChoice =
        app.onboarding.loginWithPhoneButton.evaluate().isNotEmpty;

    print(
      'DIAG: phone=$hasPhone dashboard=$hasDashboard authChoice=$hasAuthChoice',
    );

    // Should be on some valid screen
    expect(
      hasPhone || hasDashboard || hasAuthChoice,
      isTrue,
      reason: 'App should reach a valid screen after launch',
    );
  });
}
