// integration_test/e2e_individual/37_wallet_topup_balance_test.dart
//
// Standalone test: Wallet top-up flow with balance verification.
// Updated to follow the new 3-step flow: Purpose -> Amount -> Proof.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/37_wallet_topup_balance_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Wallet top-up – step 1: purpose selection', (tester) async {
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'walletTab');

    // Tap top-up button
    await scrollAndTap(tester, find.byKey(const Key('topUpButton')));
    await settle(tester);

    // Verify purpose screen elements
    expect(find.byKey(const Key('walletTopUpPurposeCard')), findsOneWidget,
        reason: 'Wallet Top-up card should be visible',);
    expect(find.byKey(const Key('securityDepositPurposeCard')), findsOneWidget,
        reason: 'Security Deposit card should be visible',);
    expect(find.byKey(const Key('continueToPaymentButton')), findsOneWidget,
        reason: 'Continue button should be visible',);
  });

  testWidgets('Wallet top-up – step 2: amount entry', (tester) async {
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'walletTab');

    // Open purpose screen
    await scrollAndTap(tester, find.byKey(const Key('topUpButton')));
    await settle(tester);

    // Continue to amount screen
    await scrollAndTap(
        tester, find.byKey(const Key('continueToPaymentButton')),);
    await settle(tester);

    // Verify amount screen elements
    expect(find.byKey(const Key('customAmountField')), findsOneWidget,
        reason: 'Amount field should be visible',);
    expect(find.byKey(const Key('proceedToUpiButton')), findsOneWidget,
        reason: 'Proceed to UPI button should be visible',);
  });

  testWidgets('Wallet top-up – step 3: proof submission', (tester) async {
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'walletTab');

    // Open purpose screen
    await scrollAndTap(tester, find.byKey(const Key('topUpButton')));
    await settle(tester);

    // Continue to amount screen
    await scrollAndTap(
        tester, find.byKey(const Key('continueToPaymentButton')),);
    await settle(tester);

    // Enter amount and proceed
    await smartEnterText(
        tester, find.byKey(const Key('customAmountField')), '500',);
    await settle(tester);
    await scrollAndTap(tester, find.byKey(const Key('proceedToUpiButton')));
    await settle(tester);

    // Verify UPI screen elements
    expect(find.byKey(const Key('uploadProofArea')), findsOneWidget,
        reason: 'Upload proof area should be visible',);
    expect(find.byKey(const Key('submitProofButton')), findsOneWidget,
        reason: 'Submit proof button should be visible',);

    // Submit proof (TEST_MODE auto-picks image)
    await smartTap(tester, find.byKey(const Key('uploadProofArea')));
    await settle(tester);
    await scrollAndTap(tester, find.byKey(const Key('submitProofButton')));
    await settle(tester);

    // Should return to wallet screen or show success
    await settle(tester);
    expect(find.byKey(const Key('topUpButton')), findsOneWidget,
        reason: 'Should return to wallet screen after submission',);
  });

  testWidgets('Wallet top-up – cancel/back flow', (tester) async {
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'walletTab');

    // Open purpose screen
    await scrollAndTap(tester, find.byKey(const Key('topUpButton')));
    await settle(tester);

    // Continue to amount screen
    await scrollAndTap(
        tester, find.byKey(const Key('continueToPaymentButton')),);
    await settle(tester);

    // Use back button in header
    await smartTap(tester, find.byKey(const Key('backButton')));
    await settle(tester);

    // Should be back on purpose screen
    expect(find.byKey(const Key('walletTopUpPurposeCard')), findsOneWidget,
        reason: 'Should be back on purpose screen',);
  });

  testWidgets('Wallet top-up – security deposit purpose', (tester) async {
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'walletTab');

    // Open purpose screen
    await scrollAndTap(tester, find.byKey(const Key('topUpButton')));
    await settle(tester);

    // Select security deposit
    await smartTap(tester, find.byKey(const Key('securityDepositPurposeCard')));
    await settle(tester);

    // Continue
    await scrollAndTap(
        tester, find.byKey(const Key('continueToPaymentButton')),);
    await settle(tester);

    // Verify step 2 text says "Step 2 of 3" (implies we correctly passed purpose)
    expect(find.text('Step 2 of 3'), findsOneWidget);
    expect(find.byKey(const Key('customAmountField')), findsOneWidget);
  });
}
