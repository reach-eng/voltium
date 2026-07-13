// integration_test/e2e_individual/02_legal_screen_test.dart
//
// Standalone test: Legal/terms acceptance flow.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/02_legal_screen_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../pages/app_robots.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Legal screen – accept terms and continue', (tester) async {
    final app = AppRobots(tester);
    await launchApp(tester);

    // Handle preamble screens (auth choice, legal, permissions)
    await handlePreamble(tester);

    // Should reach login or dashboard
    final hasLogin = app.login.phoneField.evaluate().isNotEmpty;
    final hasDashboard = app.dashboard.dashboardTab.evaluate().isNotEmpty;

    expect(
      hasLogin || hasDashboard,
      isTrue,
      reason: 'Should reach login or dashboard after preamble',
    );
  });
}
