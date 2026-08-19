import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_low_balance_card.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_normal_wallet_card.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_wallet_card.dart';

void main() {
  group('WalletCard Split Component Tests', () {
    testWidgets('renders DashboardNormalWalletCard when balance is sufficient',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WalletCard(
              walletBalance: 2500,
              requiredPayment: 1000,
              paymentStreak: 4,
              planEndDate: DateTime.now().add(const Duration(days: 10)),
            ),
          ),
        ),
      );

      expect(find.byType(DashboardNormalWalletCard), findsOneWidget);
      expect(find.byType(DashboardLowBalanceCard), findsNothing);
      expect(find.text('TOTAL BALANCE'), findsOneWidget);
      expect(find.text('4/5 Days'), findsOneWidget);
    });

    testWidgets(
        'renders DashboardLowBalanceCard when balance is insufficient & due soon',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WalletCard(
              walletBalance: 300,
              requiredPayment: 1000,
              paymentStreak: 2,
              planEndDate: DateTime.now().add(const Duration(days: 2)),
            ),
          ),
        ),
      );

      expect(find.byType(DashboardLowBalanceCard), findsOneWidget);
      expect(find.byType(DashboardNormalWalletCard), findsNothing);
      expect(find.textContaining('Top Up Now to Ride'), findsOneWidget);
    });
  });
}
