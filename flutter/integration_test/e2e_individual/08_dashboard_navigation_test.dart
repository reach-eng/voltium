// integration_test/e2e_individual/08_dashboard_navigation_test.dart
import 'package:flutter/material.dart';
//
// Standalone test: Dashboard navigation via bottom tabs.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/08_dashboard_navigation_test.dart -d emulator-5554

import 'package:flutter_test/flutter_test.dart';
import '../pages/app_robots.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Dashboard – bottom navigation switches all tabs',
      (tester) async {
    final app = AppRobots(tester);
    await fullLoginFlow(tester);

    // Verify starting on dashboard
    await expectOnDashboard(tester);

    // Navigate to wallet
    await navigateToTab(tester, 'walletTab');
    expect(app.wallet.topUpButton, findsOneWidget);

    // Navigate to support
    await navigateToTab(tester, 'supportTab');
    expect(app.support.raiseTicketButton, findsOneWidget);

    // Navigate to profile
    await navigateToTab(tester, 'profileTab');
    expect(app.profile.logoutButton, findsOneWidget);

    // Navigate back to dashboard
    await navigateToTab(tester, 'dashboardTab');
    await expectOnDashboard(tester);
  });
}
