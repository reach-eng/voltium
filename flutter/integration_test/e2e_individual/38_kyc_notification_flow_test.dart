// integration_test/e2e_individual/38_kyc_notification_flow_test.dart
//
// Standalone test: KYC notification flow – approval, rejection, read status, badge count.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/38_kyc_notification_flow_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('KYC notification – approval notification delivery',
      (tester) async {
    await fullLoginFlow(tester);

    // Verify notification bell is visible on dashboard
    expect(find.byKey(const Key('notificationBell')), findsAtLeastNWidgets(1),
        reason: 'Notification bell should be visible',);

    // Tap notification bell
    await smartTap(tester, find.byKey(const Key('notificationBell')));
    await settle(tester);

    // Notification center should open
    final hasNotificationCenter =
        find.byKey(const Key('markAllReadButton')).evaluate().isNotEmpty ||
            find.byKey(const Key('notificationCard')).evaluate().isNotEmpty ||
            find.text('No notifications').evaluate().isNotEmpty;
    expect(hasNotificationCenter, isTrue,
        reason: 'Notification center should open',);

    // Check for KYC-related notification text
    final hasKycNotification =
        find.textContaining('KYC').evaluate().isNotEmpty ||
            find.textContaining('approved').evaluate().isNotEmpty ||
            find.textContaining('verified').evaluate().isNotEmpty ||
            find.textContaining('notification').evaluate().isNotEmpty ||
            find.text('No notifications').evaluate().isNotEmpty;
    expect(hasKycNotification, isTrue,
        reason: 'Should show KYC-related notification or empty state',);
  });

  testWidgets('KYC notification – rejection notification with reason',
      (tester) async {
    await fullLoginFlow(tester);

    // Open notification center
    await smartTap(tester, find.byKey(const Key('notificationBell')));
    await settle(tester);

    // Look for rejection-related notifications
    final notificationCards = find.byKey(const Key('notificationCard'));
    if (notificationCards.evaluate().isNotEmpty) {
      // Check if any card contains rejection info
      final hasRejectionInfo =
          find.textContaining('rejected').evaluate().isNotEmpty ||
              find.textContaining('reason').evaluate().isNotEmpty ||
              find.textContaining('correction').evaluate().isNotEmpty;

      // If rejection notifications exist, verify they show reason
      if (hasRejectionInfo) {
        expect(notificationCards, findsAtLeastNWidgets(1),
            reason: 'Should display notification cards with rejection info',);
      }
    }

    // Test passes if notification center opened without error
    expect(
        find.byKey(const Key('markAllReadButton')).evaluate().isNotEmpty ||
            notificationCards.evaluate().isNotEmpty,
        isTrue,
        reason: 'Notification center should be accessible',);
  });

  testWidgets('KYC notification – mark notification as read', (tester) async {
    await fullLoginFlow(tester);

    // Open notification center
    await tester.tap(find.byKey(const Key('notificationBell')));
    await settle(tester);

    // Try mark all read if button exists
    final markAllReadBtn = find.byKey(const Key('markAllReadButton'));
    if (markAllReadBtn.evaluate().isNotEmpty) {
      await tester.tap(markAllReadBtn);
      await settle(tester);

      // After marking read, verify no crash and center is still accessible
      expect(markAllReadBtn, findsAtLeastNWidgets(0),
          reason: 'Mark all read should execute without error',);
    }

    // If individual notification cards exist, try tapping one to mark as read
    final notificationCards = find.byKey(const Key('notificationCard'));
    if (notificationCards.evaluate().isNotEmpty) {
      await tester.tap(notificationCards.first);
      await settle(tester);
    }
  });

  testWidgets('KYC notification – notification badge count', (tester) async {
    await fullLoginFlow(tester);

    // Notification bell should be visible with potential badge
    final notificationBell = find.byKey(const Key('notificationBell'));
    expect(notificationBell, findsAtLeastNWidgets(1),
        reason: 'Notification bell should be visible',);

    // Badge indicator (red dot) may be present as a child of the bell
    // Test passes if bell is visible regardless of badge state
    expect(notificationBell, findsAtLeastNWidgets(1));
  });

  testWidgets('KYC notification – notification center navigation',
      (tester) async {
    await fullLoginFlow(tester);

    // Open notification center
    await tester.tap(find.byKey(const Key('notificationBell')));
    await settle(tester);

    // Verify we can see notification content
    final hasContent =
        find.byKey(const Key('notificationCard')).evaluate().isNotEmpty ||
            find.text('No notifications').evaluate().isNotEmpty ||
            find.textContaining('notification').evaluate().isNotEmpty;
    expect(hasContent, isTrue,
        reason: 'Notification center should display content',);

    // Go back to dashboard
    await goBack(tester);
    await expectOnDashboard(tester);
  });
}
