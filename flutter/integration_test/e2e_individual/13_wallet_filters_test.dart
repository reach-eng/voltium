// integration_test/e2e_individual/13_wallet_filters_test.dart
import 'package:flutter/material.dart';
//
// Standalone test: Wallet transaction filter chips.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/13_wallet_filters_test.dart -d emulator-5554

import 'package:flutter_test/flutter_test.dart';
import '../pages/app_robots.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Wallet – transaction filter chips are tappable', (tester) async {
    final app = AppRobots(tester);
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'walletTab');

    // Test filter chips
    final filters = ['All', 'Approved', 'Pending'];
    for (final f in filters) {
      final chip = find.text(f);
      if (chip.evaluate().isNotEmpty) {
        await tester.tap(chip.first);
        await settle(tester);
      }
    }

    // Wallet should still be visible
    expect(app.wallet.topUpButton, findsOneWidget);
  });
}
