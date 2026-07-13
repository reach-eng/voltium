// integration_test/e2e_individual/11_wallet_balance_test.dart
import 'package:flutter/material.dart';
//
// Standalone test: Wallet screen displays balance and action buttons.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/11_wallet_balance_test.dart -d emulator-5554

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';
import '../pages/wallet_page.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Wallet – balance display and action buttons', (tester) async {
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'walletTab');

    final walletPage = WalletPageObject(tester);
    walletPage.expectLoaded();

    await walletPage.scrollToHistory();
    expect(walletPage.historySection, findsOneWidget);
  });
}
