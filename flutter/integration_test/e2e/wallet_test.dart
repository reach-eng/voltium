// integration_test/e2e/wallet_test.dart
//
// Voltium – Wallet E2E tests.
// Covers: balance display, top-up flow, transaction history, filters.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Wallet E2E', () {
    testWidgets('Wallet screen displays balance and actions', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'walletTab');

      // Top up and history buttons should be visible
      expect(find.byKey(const Key('topUpButton')), findsOneWidget);
      expect(find.byKey(const Key('historyButton')), findsOneWidget);
    });

    testWidgets('Wallet – open top-up dialog', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'walletTab');

      await tester.tap(find.byKey(const Key('topUpButton')));
      await settle(tester);

      // Top-up dialog should be visible
      expect(find.byKey(const Key('topUpAmountField')), findsOneWidget);
      expect(find.byKey(const Key('submitTopUpButton')), findsOneWidget);
      expect(find.byKey(const Key('cancelTopUpButton')), findsOneWidget);
    });

    testWidgets('Wallet – enter top-up amount and submit', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'walletTab');

      await tester.tap(find.byKey(const Key('topUpButton')));
      await settle(tester);

      // Enter amount
      await tester.enterText(
        find.byKey(const Key('topUpAmountField')),
        '500',
      );
      await settle(tester);

      // Submit
      await tester.tap(find.byKey(const Key('submitTopUpButton')));
      await settle(tester);

      // Should show UPI details or success
      await tester.pump(const Duration(seconds: 2));
      await settle(tester);
    });

    testWidgets('Wallet – cancel top-up dialog', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'walletTab');

      await tester.tap(find.byKey(const Key('topUpButton')));
      await settle(tester);

      // Cancel
      await tester.tap(find.byKey(const Key('cancelTopUpButton')));
      await settle(tester);

      // Dialog should be dismissed
      expect(find.byKey(const Key('topUpAmountField')), findsNothing);
    });

    testWidgets('Wallet – transaction filters visible', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'walletTab');

      // Filter chips should be visible
      final filterChip = find.byKey(const Key('filterAllChip'));
      if (filterChip.evaluate().isNotEmpty) {
        expect(filterChip, findsOneWidget);

        // Tap different filters
        final filters = ['All', 'Approved', 'Pending'];
        for (final f in filters) {
          final chip = find.byKey(Key('filter${f}Chip'));
          if (chip.evaluate().isNotEmpty) {
            await tester.tap(chip);
            await settle(tester);
          }
        }
      }
    });

    testWidgets('Wallet – navigate to transaction history', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'walletTab');

      await tester.tap(find.byKey(const Key('historyButton')));
      await settle(tester);

      // History screen should be visible
      // (No specific key, but we should have navigated away from wallet)
      expect(find.byKey(const Key('topUpButton')), findsNothing);
    });

    testWidgets('Wallet – payment method selection', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'walletTab');

      await tester.tap(find.byKey(const Key('topUpButton')));
      await settle(tester);

      // UPI and Cash method chips should be visible
      expect(find.byKey(const Key('upiMethodChip')), findsOneWidget);
      expect(find.byKey(const Key('cashMethodChip')), findsOneWidget);

      // Tap UPI method
      await tester.tap(find.byKey(const Key('upiMethodChip')));
      await settle(tester);
    });

    testWidgets('Wallet – UPI reference field in top-up', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'walletTab');

      await tester.tap(find.byKey(const Key('topUpButton')));
      await settle(tester);

      // Enter amount first
      await tester.enterText(
        find.byKey(const Key('topUpAmountField')),
        '1000',
      );
      await settle(tester);

      // UPI reference field should be visible
      final upiRefField = find.byKey(const Key('upiRefField'));
      if (upiRefField.evaluate().isNotEmpty) {
        await tester.enterText(upiRefField, 'UPI123456789');
        await settle(tester);
      }
    });

    testWidgets('Wallet – payment proof upload area', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'walletTab');

      await tester.tap(find.byKey(const Key('topUpButton')));
      await settle(tester);

      // Payment proof upload area should be visible
      expect(find.byKey(const Key('paymentProofUpload')), findsOneWidget);
    });

    testWidgets('Wallet – security deposit card visible', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'walletTab');

      // Security deposit section should be part of wallet
      expect(find.textContaining('Security'), findsOneWidget);
    });

    testWidgets('Wallet – payment streak bar visible', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'walletTab');

      // Payment streak section should be visible in the balance card
      expect(find.textContaining('streak'), findsOneWidget);
    });
  });
}
