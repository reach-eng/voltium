import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../helpers/test_helpers.dart';

class WalletPageObject {
  final WidgetTester tester;

  WalletPageObject(this.tester);

  // Locators
  Finder get topUpButton => find.byKey(const Key('topUpButton'));
  Finder get historySection => find.text('Recent Transactions');
  Finder get balanceCounter => find.byType(AnimatedAlign); // Or specific type

  Finder filterChip(String filterName) =>
      find.byKey(Key('filter${filterName}Chip'));

  Finder get walletTopUpPurposeCard =>
      find.byKey(const Key('walletTopUpPurposeCard'));

  Finder get securityDepositPurposeCard =>
      find.byKey(const Key('securityDepositPurposeCard'));

  Finder get topUpAmountField => find.byKey(const Key('topUpAmountField'));

  Finder get submitTopUpButton => find.byKey(const Key('submitTopUpButton'));

  Finder get walletTab => find.byKey(const Key('walletTab'));

  Finder get amount500 => find.byKey(const Key('amount500'));

  Finder get amount1000 => find.byKey(const Key('amount1000'));

  Finder get amount2000 => find.byKey(const Key('amount2000'));

  Finder get amount5000 => find.byKey(const Key('amount5000'));

  Finder get customAmountField => find.byKey(const Key('customAmountField'));

  Finder get proceedToUpiButton => find.byKey(const Key('proceedToUpiButton'));

  // Actions
  Future<void> tapTopUp() async {
    await scrollAndTap(tester, topUpButton);
  }

  Future<void> tapFilter(String filterName) async {
    final chip = filterChip(filterName);
    if (chip.evaluate().isNotEmpty) {
      await scrollAndTap(tester, chip);
    }
  }

  Future<void> scrollToHistory() async {
    await tester.drag(find.byType(ListView).last, const Offset(0, -300));
    await tester.pumpAndSettle();
  }

  // Assertions
  void expectLoaded() {
    expect(topUpButton, findsOneWidget);
  }
}
