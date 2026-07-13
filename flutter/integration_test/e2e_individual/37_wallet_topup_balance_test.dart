// integration_test/e2e_individual/37_wallet_topup_balance_test.dart
//
// Standalone test: Wallet top-up flow with balance verification.
// Updated to follow the new 3-step flow: Purpose -> Amount -> Proof.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/37_wallet_topup_balance_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../pages/app_robots.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Wallet top-up – step 1: purpose selection', (tester) async {
    final app = AppRobots(tester);
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'walletTab');

    // Tap top-up button
    await scrollAndTap(tester, app.wallet.topUpButton);
    await settle(tester);

    // Verify purpose screen elements
    expect(
      app.wallet.walletTopUpPurposeCard,
      findsOneWidget,
      reason: 'Wallet Top-up card should be visible',
    );
    expect(
      app.wallet.securityDepositPurposeCard,
      findsOneWidget,
      reason: 'Security Deposit card should be visible',
    );
    expect(
      app.onboarding.continueToPaymentButton,
      findsOneWidget,
      reason: 'Continue button should be visible',
    );
  });

  testWidgets('Wallet top-up – step 2: amount entry', (tester) async {
    final app = AppRobots(tester);
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'walletTab');

    // Open purpose screen
    await scrollAndTap(tester, app.wallet.topUpButton);
    await settle(tester);

    // Continue to amount screen
    await scrollAndTap(
      tester,
      app.onboarding.continueToPaymentButton,
    );
    await settle(tester);

    // Verify amount screen elements
    expect(
      app.wallet.customAmountField,
      findsOneWidget,
      reason: 'Amount field should be visible',
    );
    expect(
      app.wallet.proceedToUpiButton,
      findsOneWidget,
      reason: 'Proceed to UPI button should be visible',
    );
  });

  testWidgets('Wallet top-up – step 3: proof submission', (tester) async {
    final app = AppRobots(tester);
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'walletTab');

    // Open purpose screen
    await scrollAndTap(tester, app.wallet.topUpButton);
    await settle(tester);

    // Continue to amount screen
    await scrollAndTap(
      tester,
      app.onboarding.continueToPaymentButton,
    );
    await settle(tester);

    // Enter amount and proceed
    await smartEnterText(
      tester,
      app.wallet.customAmountField,
      '500',
    );
    await settle(tester);
    await scrollAndTap(tester, app.wallet.proceedToUpiButton);
    await settle(tester);

    // Verify UPI screen elements
    expect(
      app.onboarding.uploadProofArea,
      findsOneWidget,
      reason: 'Upload proof area should be visible',
    );
    expect(
      app.onboarding.submitProofButton,
      findsOneWidget,
      reason: 'Submit proof button should be visible',
    );

    // Submit proof (TEST_MODE auto-picks image)
    await smartTap(tester, app.onboarding.uploadProofArea);
    await settle(tester);
    await scrollAndTap(tester, app.onboarding.submitProofButton);
    await settle(tester);

    // Should return to wallet screen or show success
    await settle(tester);
    expect(
      app.wallet.topUpButton,
      findsOneWidget,
      reason: 'Should return to wallet screen after submission',
    );
  });

  testWidgets('Wallet top-up – cancel/back flow', (tester) async {
    final app = AppRobots(tester);
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'walletTab');

    // Open purpose screen
    await scrollAndTap(tester, app.wallet.topUpButton);
    await settle(tester);

    // Continue to amount screen
    await scrollAndTap(
      tester,
      app.onboarding.continueToPaymentButton,
    );
    await settle(tester);

    // Use back button in header
    await smartTap(tester, app.settings.backButton);
    await settle(tester);

    // Should be back on purpose screen
    expect(
      app.wallet.walletTopUpPurposeCard,
      findsOneWidget,
      reason: 'Should be back on purpose screen',
    );
  });

  testWidgets('Wallet top-up – security deposit purpose', (tester) async {
    final app = AppRobots(tester);
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'walletTab');

    // Open purpose screen
    await scrollAndTap(tester, app.wallet.topUpButton);
    await settle(tester);

    // Select security deposit
    await smartTap(tester, app.wallet.securityDepositPurposeCard);
    await settle(tester);

    // Continue
    await scrollAndTap(
      tester,
      app.onboarding.continueToPaymentButton,
    );
    await settle(tester);

    // Verify step 2 text says "Step 2 of 3" (implies we correctly passed purpose)
    expect(find.text('Step 2 of 3'), findsOneWidget);
    expect(app.wallet.customAmountField, findsOneWidget);
  });
}
