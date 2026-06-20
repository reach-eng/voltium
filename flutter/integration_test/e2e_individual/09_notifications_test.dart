// integration_test/e2e_individual/09_notifications_test.dart
import 'package:flutter/material.dart';
//
// Standalone test: Notification bell navigation and mark all read.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/09_notifications_test.dart -d emulator-5554

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Notifications – bell navigates to notification center',
      (tester) async {
    await fullLoginFlow(tester);

    // Tap notification bell
    await tester.tap(find.byKey(const Key('notificationBell')));
    await settle(tester);

    // Should be on notification center
    expect(find.byKey(const Key('markAllReadButton')), findsOneWidget);

    // Mark all as read if there are notifications
    final markAllBtn = find.byKey(const Key('markAllReadButton'));
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
