// integration_test/e2e_individual/09_notifications_test.dart
import 'package:flutter/material.dart';
//
// Standalone test: Notification bell navigation and mark all read.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/09_notifications_test.dart -d emulator-5554

import 'package:flutter_test/flutter_test.dart';
import '../pages/app_robots.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';
import '../pages/dashboard_page.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Notifications – bell navigates to notification center',
      (tester) async {
    final app = AppRobots(tester);
    await fullLoginFlow(tester);

    // Tap notification bell using POM
    final dashboardPage = DashboardPageObject(tester);
    await dashboardPage.tapNotificationBell();

    // Should be on notification center
    expect(app.dashboard.markAllReadButton, findsOneWidget);

    // Mark all as read if there are notifications
    final markAllBtn = app.dashboard.markAllReadButton;
    if (markAllBtn.evaluate().isNotEmpty) {
      await tester.tap(markAllBtn);
      await settle(tester);
    }

    // Go back
    await goBack(tester);

    // Should be back on dashboard
    await expectOnDashboard(tester);
  });
}
