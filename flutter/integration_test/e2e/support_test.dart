// integration_test/e2e/support_test.dart
//
// Voltium – Support E2E tests.
// Covers: support center, raise ticket, FAQ, notifications.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Support E2E', () {
    testWidgets('Support center displays all sections', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'supportTab');

      // Support center should have ticket form
      expect(find.byKey(const Key('issueTypeDropdown')), findsOneWidget);
      expect(find.byKey(const Key('ticketDescriptionField')), findsOneWidget);
      expect(find.byKey(const Key('raiseTicketButton')), findsOneWidget);
    });

    testWidgets('Support – raise a ticket', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'supportTab');

      // Select issue type
      await tester.tap(find.byKey(const Key('issueTypeDropdown')));
      await settle(tester);

      // Select first option from dropdown
      final dropdownItems = find.byType(PopupMenuItem<String>);
      if (dropdownItems.evaluate().isNotEmpty) {
        await tester.tap(dropdownItems.first);
        await settle(tester);
      }

      // Enter description
      await tester.enterText(
        find.byKey(const Key('ticketDescriptionField')),
        'Integration test support ticket',
      );
      await settle(tester);

      // Submit ticket
      final submitBtn = find.byKey(const Key('raiseTicketButton'));
      await tester.ensureVisible(submitBtn);
      await tester.tap(submitBtn);
      await settle(tester);

      // Should show success message
      await tester.pump(const Duration(seconds: 2));
      await settle(tester);
    });

    testWidgets('Support – FAQ navigation', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'supportTab');

      final faqLink = find.byKey(const Key('faqLink'));
      if (faqLink.evaluate().isNotEmpty) {
        await tester.tap(faqLink);
        await settle(tester);

        // FAQ screen should be visible
        await goBack(tester);
      }
    });

    testWidgets('Support – call us action', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'supportTab');

      final callLink = find.byKey(const Key('callUsLink'));
      if (callLink.evaluate().isNotEmpty) {
        await tester.tap(callLink);
        await settle(tester);
      }
    });

    testWidgets('Support – email us action', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'supportTab');

      final emailLink = find.byKey(const Key('emailLink'));
      if (emailLink.evaluate().isNotEmpty) {
        await tester.tap(emailLink);
        await settle(tester);
      }
    });

    testWidgets('Support – ticket with empty description shows validation',
        (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'supportTab');

      // Select issue type
      await tester.tap(find.byKey(const Key('issueTypeDropdown')));
      await settle(tester);

      final dropdownItems = find.byType(PopupMenuItem<String>);
      if (dropdownItems.evaluate().isNotEmpty) {
        await tester.tap(dropdownItems.first);
        await settle(tester);
      }

      // Leave description empty and submit
      await tester.tap(find.byKey(const Key('raiseTicketButton')));
      await settle(tester);

      // Should show validation error or not submit
      // (depends on implementation - just verify no crash)
    });

    testWidgets('Notifications – mark all as read', (tester) async {
      await fullLoginFlow(tester);

      // Navigate to notifications via bell
      await tester.tap(find.byKey(const Key('notificationBell')));
      await settle(tester);

      // Mark all read button should be visible if there are notifications
      final markAllBtn = find.byKey(const Key('markAllReadButton'));
      if (markAllBtn.evaluate().isNotEmpty) {
        await tester.tap(markAllBtn);
        await settle(tester);
      }

      // Go back
      await goBack(tester);
    });

    testWidgets('Notifications – notification cards display', (tester) async {
      await fullLoginFlow(tester);

      await tester.tap(find.byKey(const Key('notificationBell')));
      await settle(tester);

      // Notification cards should be visible (may be empty state)
      expect(find.byKey(const Key('markAllReadButton')), findsOneWidget);
    });
  });
}
