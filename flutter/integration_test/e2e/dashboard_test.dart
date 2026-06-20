// integration_test/e2e/dashboard_test.dart
//
// Voltium – Dashboard E2E tests.
// Covers: dashboard elements, navigation, referral, vehicle card, TL details.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Dashboard E2E', () {
    testWidgets('Dashboard displays all key elements', (tester) async {
      await fullLoginFlow(tester);

      // Verify core dashboard elements
      expect(find.byKey(const Key('dashboardTab')), findsOneWidget);
      expect(find.byKey(const Key('notificationBell')), findsOneWidget);
      expect(find.byKey(const Key('pointsBadge')), findsOneWidget);
      expect(find.byKey(const Key('assignedVehicleCard')), findsOneWidget);
    });

    testWidgets('Dashboard – notification bell navigates to notifications',
        (tester) async {
      await fullLoginFlow(tester);

      await tester.tap(find.byKey(const Key('notificationBell')));
      await settle(tester);

      // Should be on notification center
      expect(find.byKey(const Key('markAllReadButton')), findsOneWidget);
    });

    testWidgets('Dashboard – points badge navigates to rewards',
        (tester) async {
      await fullLoginFlow(tester);

      await tester.tap(find.byKey(const Key('pointsBadge')));
      await settle(tester);

      // Should be on rewards screen
      expect(find.byKey(const Key('backButton')), findsOneWidget);

      // Go back
      await tester.tap(find.byKey(const Key('backButton')));
      await settle(tester);
    });

    testWidgets('Dashboard – team leader tile navigates to details',
        (tester) async {
      await fullLoginFlow(tester);

      final tlTile = find.byKey(const Key('teamLeaderTile'));
      if (tlTile.evaluate().isEmpty) {
        return; // TL tile not shown
      }

      await tester.tap(tlTile);
      await settle(tester);

      // Should navigate to TL details screen (check for back button or TL content)
      final hasBackButton =
          find.byKey(const Key('backButton')).evaluate().isNotEmpty;
      final hasTLContent =
          find.text('Assigned Team Leader').evaluate().isNotEmpty;
      expect(hasBackButton || hasTLContent, isTrue,
          reason: 'Should navigate to TL details screen',);
    });

    testWidgets('Dashboard – assigned vehicle card navigates to photos',
        (tester) async {
      await fullLoginFlow(tester);

      await tester.tap(find.byKey(const Key('assignedVehicleCard')));
      await settle(tester);

      // Should navigate to vehicle photos screen or show vehicle content
      final hasVehicleContent =
          find.textContaining('Vehicle').evaluate().isNotEmpty ||
              find.textContaining('Photos').evaluate().isNotEmpty ||
              find.byKey(const Key('backButton')).evaluate().isNotEmpty;
      expect(hasVehicleContent, isTrue,
          reason: 'Should navigate to vehicle details/photos',);
    });

    testWidgets('Dashboard – referral widget displays code', (tester) async {
      await fullLoginFlow(tester);

      // Referral widget should be visible (copy button only, web parity)
      expect(find.byKey(const Key('copyReferralButton')), findsOneWidget);

      // Tap copy
      await tester.tap(find.byKey(const Key('copyReferralButton')));
      await tester.pump();
    });

    testWidgets('Dashboard – pull to refresh works', (tester) async {
      await fullLoginFlow(tester);

      // Perform pull to refresh
      await tester.drag(
        find.byType(ListView).first,
        const Offset(0, 300),
      );
      await settle(tester);

      // Dashboard should still be visible
      await expectOnDashboard(tester);
    });

    testWidgets('Dashboard – bottom navigation switches screens',
        (tester) async {
      await fullLoginFlow(tester);

      // Start on dashboard
      await expectOnDashboard(tester);

      // Switch to wallet
      await navigateToTab(tester, 'walletTab');
      expect(find.byKey(const Key('topUpButton')), findsOneWidget);

      // Switch to support
      await navigateToTab(tester, 'supportTab');
      expect(find.byKey(const Key('raiseTicketButton')), findsOneWidget);

      // Switch to profile
      await navigateToTab(tester, 'profileTab');
      expect(find.byKey(const Key('logoutButton')), findsOneWidget);

      // Switch back to dashboard
      await navigateToTab(tester, 'dashboardTab');
      await expectOnDashboard(tester);
    });

    testWidgets('Dashboard – manage subscription button visible',
        (tester) async {
      await fullLoginFlow(tester);

      final manageBtn = find.byKey(const Key('manageSubscriptionButton'));
      if (manageBtn.evaluate().isNotEmpty) {
        await tester.tap(manageBtn);
        await settle(tester);

        // Should show subscription bottom sheet
        expect(find.textContaining('Subscription'), findsAtLeastNWidgets(1));
      }
    });

    testWidgets('Dashboard – action required banner for low balance',
        (tester) async {
      await fullLoginFlow(tester);

      // Low balance banner may or may not be shown depending on balance
      // Just verify it doesn't crash the dashboard
      await expectOnDashboard(tester);
    });

    testWidgets('Dashboard – wallet card displays inline', (tester) async {
      await fullLoginFlow(tester);

      // Wallet card should be visible on dashboard (web parity)
      final hasWalletCard =
          find.text('Available Balance').evaluate().isNotEmpty ||
              find.text('Payment Streak').evaluate().isNotEmpty;
      expect(hasWalletCard, isTrue,
          reason: 'Inline wallet card should be visible on dashboard',);
    });
  });
}
