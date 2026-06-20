// integration_test/e2e_individual/40_exhaustive_ui_traversal_test.dart
//
// Standalone test: Exhaustively traverse UI elements (tabs, filters, forms) to ensure no unhandled exceptions.
// Updated to match the new 3-step Top-up flow.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/40_exhaustive_ui_traversal_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Exhaustive UI traversal and data entry simulation',
      (tester) async {
    // 1. Enter the app using the returning user cache to bypass auth for speed
    await setupReturningUser();
    await safeAppMain();
    await settle(tester);
    await tester.pump(const Duration(seconds: 4));
    await settle(tester);

    // Should be on dashboard
    await expectOnDashboard(tester);

    // 2. Traversal: Dashboard interactions
    final vehicleCard = find.byKey(const Key('assignedVehicleCard'));
    if (vehicleCard.evaluate().isNotEmpty) {
      await scrollAndTap(tester, vehicleCard);
      await settle(tester);
      await goBack(tester);
    }

    // 3. Traversal: Wallet Tab
    await navigateToTab(tester, 'walletTab');

    // Tap all filter chips
    final filterTypes = ['All', 'Added', 'Deducted'];
    for (final filter in filterTypes) {
      final chip =
          find.descendant(of: find.byType(Wrap), matching: find.text(filter));
      if (chip.evaluate().isNotEmpty) {
        await smartTap(tester, chip);
        await settle(tester);
      }
    }

    // Tap Top Up and enter data
    final topUpBtn = find.byKey(const Key('topUpButton'));
    if (topUpBtn.evaluate().isNotEmpty) {
      await smartTap(tester, topUpBtn);
      await settle(tester);

      // Step 1: Purpose
      final continueBtn = find.byKey(const Key('continueToPaymentButton'));
      if (continueBtn.evaluate().isNotEmpty) {
        await smartTap(tester, continueBtn);
        await settle(tester);
      }

      // Step 2: Amount
      final amountField = find.byKey(const Key('customAmountField'));
      if (amountField.evaluate().isNotEmpty) {
        await smartEnterText(tester, amountField, '100');
        await settle(tester);
      }

      final proceedBtn = find.byKey(const Key('proceedToUpiButton'));
      if (proceedBtn.evaluate().isNotEmpty) {
        await smartTap(tester, proceedBtn);
        await settle(tester);
      }

      // Step 3: Proof
      final uploadArea = find.byKey(const Key('uploadProofArea'));
      if (uploadArea.evaluate().isNotEmpty) {
        // Go back multiple times to return to wallet
        await goBack(tester); // To Amount
        await settle(tester);
        await goBack(tester); // To Purpose
        await settle(tester);
        await goBack(tester); // To Wallet
        await settle(tester);
      }
    }

    // 4. Traversal: Support Tab
    await navigateToTab(tester, 'supportTab');

    // Expand FAQ
    final faqTile = find.byKey(const Key('faqTile'));
    if (faqTile.evaluate().isNotEmpty) {
      await tester.tap(faqTile);
      await settle(tester);
      final firstFaq = find.byType(ExpansionTile).first;
      if (firstFaq.evaluate().isNotEmpty) {
        await tester.tap(firstFaq);
        await settle(tester);
      }
      await goBack(tester);
    }

    // Open Ticket and enter data
    final ticketTile = find.byKey(const Key('raiseTicketTile'));
    if (ticketTile.evaluate().isNotEmpty) {
      await tester.tap(ticketTile);
      await settle(tester);

      final descField = find.byKey(const Key('ticketDescriptionField'));
      if (descField.evaluate().isNotEmpty) {
        await smartEnterText(
            tester, descField, 'Test description for exhaustive traversal',);
        await settle(tester);
      }

      final submitBtn = find.byKey(const Key('submitTicketButton'));
      if (submitBtn.evaluate().isNotEmpty) {
        await tester.tap(submitBtn);
        await settle(tester);
      }
      await goBack(tester); // Go back if submit keeps us on the screen
    }

    // 5. Traversal: Profile & Settings Tab
    await navigateToTab(tester, 'profileTab');

    // Open App Settings
    final settingsLink = find.byKey(const Key('appSettingsLink'));
    if (settingsLink.evaluate().isNotEmpty) {
      await tester.tap(settingsLink);
      await settle(tester);

      // Toggle Theme
      final themeToggle = find.byKey(const Key('darkModeSwitch'));
      if (themeToggle.evaluate().isNotEmpty) {
        await tester.tap(themeToggle);
        await settle(tester);
        await tester.tap(themeToggle); // toggle back
        await settle(tester);
      }
      await goBack(tester);
      await settle(tester);
    }

    // Ensure we can return to Dashboard without error
    await navigateToTab(tester, 'dashboardTab');
    await expectOnDashboard(tester);
  });
}
