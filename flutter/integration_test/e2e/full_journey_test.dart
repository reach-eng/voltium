// integration_test/e2e/full_journey_test.dart
//
// Voltium – Complete end-to-end journey test.
// This test runs the entire user flow from splash to logout in a single test.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Full Journey E2E', () {
    testWidgets('Complete user journey – splash to logout', (tester) async {
      // ── Phase 1: Authentication ──────────────────────────────────────────
      print('🚀 Phase 1: Authentication');
      await launchApp(tester);
      await completeLegalScreen(tester);
      await completePermissionsScreen(tester);
      await completeAuthFlow(tester);
      await completeOnboardingFlow(tester);

      // Verify we reached dashboard
      await expectOnDashboard(tester);
      print('✅ Auth phase complete');

      // ── Phase 2: Dashboard verification ──────────────────────────────────
      print('📊 Phase 2: Dashboard');
      expect(find.byKey(const Key('notificationBell')), findsOneWidget);
      expect(find.byKey(const Key('pointsBadge')), findsOneWidget);
      expect(find.byKey(const Key('assignedVehicleCard')), findsOneWidget);
      expect(find.byKey(const Key('copyReferralButton')), findsOneWidget);
      print('✅ Dashboard phase complete');

      // ── Phase 3: Wallet operations ───────────────────────────────────────
      print('💰 Phase 3: Wallet');
      await navigateToTab(tester, 'walletTab');
      expect(find.byKey(const Key('topUpButton')), findsOneWidget);
      expect(find.byKey(const Key('historyButton')), findsOneWidget);

      // Test top-up flow (current multi-step flow)
      await tester.tap(find.byKey(const Key('topUpButton')));
      await settle(tester);

      // Select purpose: "Wallet Top-up"
      await tester.tap(find.text('Wallet Top-up'));
      await settle(tester);

      // Continue to amount screen
      await tester.tap(find.text('Continue to Payment'));
      await settle(tester);

      // Enter custom amount
      await tester.enterText(find.byKey(const Key('customAmountField')), '500');
      await settle(tester);

      // Proceed to UPI / receipt
      await tester.tap(find.byKey(const Key('proceedToUpiButton')));
      await settle(tester);
      await tester.pump(const Duration(seconds: 2));
      await settle(tester);

      // On receipt screen, return to dashboard
      await tester.tap(find.text('Back to Dashboard'));
      await settle(tester);
      await tester.pump(const Duration(seconds: 2));
      await settle(tester);
      print('✅ Wallet phase complete');

      // ── Phase 4: Support operations ──────────────────────────────────────
      print('🎫 Phase 4: Support');
      await navigateToTab(tester, 'supportTab');
      expect(find.byKey(const Key('raiseTicketButton')), findsOneWidget);

      // Raise a ticket
      await tester.tap(find.byKey(const Key('issueTypeDropdown')));
      await settle(tester);
      final dropdownItems = find.byType(PopupMenuItem<String>);
      if (dropdownItems.evaluate().isNotEmpty) {
        await tester.tap(dropdownItems.first);
        await settle(tester);
      }

      await tester.enterText(
        find.byKey(const Key('ticketDescriptionField')),
        'Full journey test ticket',
      );
      await settle(tester);
      await tester.tap(find.byKey(const Key('raiseTicketButton')));
      await settle(tester);
      await tester.pump(const Duration(seconds: 2));
      await settle(tester);
      print('✅ Support phase complete');

      // ── Phase 5: Profile operations ──────────────────────────────────────
      print('👤 Phase 5: Profile');
      await navigateToTab(tester, 'profileTab');
      expect(find.byKey(const Key('editProfileLink')), findsOneWidget);
      expect(find.byKey(const Key('logoutButton')), findsOneWidget);

      // Edit profile
      await tester.tap(find.byKey(const Key('editProfileLink')));
      await settle(tester);
      await tester.enterText(
        find.byKey(const Key('editFullNameField')),
        'Journey Test Rider',
      );
      await settle(tester);
      await tester.tap(find.byKey(const Key('submitProfileButton')));
      await settle(tester);
      await tester.pump(const Duration(seconds: 2));
      await settle(tester);

      // Navigate to rewards
      await tester.tap(find.byKey(const Key('rewardsLink')));
      await settle(tester);
      expect(find.byKey(const Key('backButton')), findsOneWidget);
      await tester.tap(find.byKey(const Key('backButton')));
      await settle(tester);

      // Navigate to SOS
      await tester.tap(find.byKey(const Key('emergencySosLink')));
      await settle(tester);
      expect(find.byKey(const Key('sosTriggerButton')), findsOneWidget);
      await tester.tap(find.byKey(const Key('cancelSosButton')));
      await settle(tester);
      print('✅ Profile phase complete');

      // ── Phase 6: Notifications ───────────────────────────────────────────
      print('🔔 Phase 6: Notifications');
      await navigateToTab(tester, 'dashboardTab');
      await tester.tap(find.byKey(const Key('notificationBell')));
      await settle(tester);

      final markAllBtn = find.byKey(const Key('markAllReadButton'));
      if (markAllBtn.evaluate().isNotEmpty) {
        await tester.tap(markAllBtn);
        await settle(tester);
      }
      await goBack(tester);
      print('✅ Notifications phase complete');

      // ── Phase 7: Settings ────────────────────────────────────────────────
      print('⚙️ Phase 7: Settings');
      await navigateToTab(tester, 'profileTab');
      await tester.tap(find.byKey(const Key('appSettingsLink')));
      await settle(tester);

      // Toggle dark mode
      final darkModeSwitch = find.byKey(const Key('darkModeSwitch'));
      if (darkModeSwitch.evaluate().isNotEmpty) {
        await tester.tap(darkModeSwitch);
        await settle(tester);
        await tester.tap(darkModeSwitch);
        await settle(tester);
      }
      await goBack(tester);
      print('✅ Settings phase complete');

      // ── Phase 8: Logout ──────────────────────────────────────────────────
      print('🚪 Phase 8: Logout');
      await navigateToTab(tester, 'profileTab');
      await tester.tap(find.byKey(const Key('logoutButton')));
      await settle(tester);
      await tester.pump(const Duration(seconds: 2));
      await settle(tester);

      // Verify back at login
      expectOnLogin(tester);
      print('✅ Logout phase complete');

      print('🎉 Full journey completed successfully!');
    });

    testWidgets('Returning user flow – cached login', (tester) async {
      // First login
      await fullLoginFlow(tester);
      await expectOnDashboard(tester);

      // Logout
      await navigateToTab(tester, 'profileTab');
      await tester.tap(find.byKey(const Key('logoutButton')));
      await settle(tester);
      await tester.pump(const Duration(seconds: 2));
      await settle(tester);
      expectOnLogin(tester);

      // Second login (should be faster due to cached data)
      await completeAuthFlow(tester);
      await tester.pump(const Duration(seconds: 3));
      await settle(tester);

      // Should reach dashboard
      await expectOnDashboard(tester);
    });

    testWidgets('Multi-tab navigation stress test', (tester) async {
      await fullLoginFlow(tester);

      // Navigate through all tabs multiple times
      final tabs = ['dashboardTab', 'walletTab', 'supportTab', 'profileTab'];
      for (int round = 0; round < 3; round++) {
        for (final tab in tabs) {
          await navigateToTab(tester, tab);
          await tester.pump(const Duration(milliseconds: 200));
        }
      }

      // Verify app is still responsive
      await expectOnDashboard(tester);
    });
  });
}
