// integration_test/e2e_individual/12_wallet_topup_test.dart
import 'package:flutter/material.dart';
//
// Standalone test: Wallet top-up dialog flow.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/12_wallet_topup_test.dart -d emulator-5554

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:voltium_rider/screens/wallet_screen.dart';
import 'package:voltium_rider/screens/top_up_purpose_screen.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Wallet – open top-up dialog and cancel', (tester) async {
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'walletTab');

    // Open top-up flow
    final topUpBtn = find
        .descendant(
          of: find.byType(WalletScreen),
          matching: find.byKey(const Key('topUpButton')),
        )
        .first;
    await tester.ensureVisible(topUpBtn);
    await tester.tap(topUpBtn);
    await settle(tester);

    // Step 1: Select Purpose
    expect(find.text('Select Purpose'), findsOneWidget);
    await tester.tap(find.text('Continue to Payment'));
    await settle(tester);

    // Step 2: Enter Amount
    expect(find.text('Enter Amount'), findsOneWidget);
    expect(find.byKey(const Key('customAmountField')), findsOneWidget);

    // Back to wallet
    await tester.tap(find.byIcon(Icons.arrow_back));
    await settle(tester);
    await tester.tap(find.byIcon(Icons.arrow_back));
    await settle(tester);

    // Should be back on wallet
    expect(find.text('Wallet'), findsAtLeastNWidgets(1));
  });
}
