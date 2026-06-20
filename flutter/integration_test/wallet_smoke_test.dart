import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'helpers/test_helpers.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Wallet Smoke Test', () {
    testWidgets('Navigate to Wallet and Check Components', (tester) async {
      await fullLoginFlow(tester);

      // Verification step: Ensure we are on Dashboard
      if (find.byKey(const Key('dashboardTab')).evaluate().isEmpty) {
        print('Dashboard not found! Current state dump:');
        debugDumpApp();
      }
      expect(find.byKey(const Key('dashboardTab')), findsOneWidget);

      await navigateToTab(tester, 'walletTab');
      await settle(tester);

      // Verify Wallet Screen components
      expect(find.text('Wallet'), findsAtLeastNWidgets(1));
      expect(find.byKey(const Key('topUpButton')), findsOneWidget);
      expect(find.byKey(const Key('historyButton')), findsOneWidget);

      // Test Top Up Dialog
      await tester.tap(find.byKey(const Key('topUpButton')));
      await settle(tester);

      expect(find.textContaining('Amount'), findsAtLeastNWidgets(1));
      expect(find.byKey(const Key('topUpAmountField')), findsOneWidget);

      await tester.enterText(find.byKey(const Key('topUpAmountField')), '500');
      await tester.tap(find.text('Cancel'));
      await settle(tester);
    });
  });
}
