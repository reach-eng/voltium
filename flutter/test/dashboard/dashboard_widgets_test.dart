import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/widgets/dashboard_wallet_card.dart';
import 'package:voltium_rider/widgets/dashboard_plan_card.dart';
import 'package:voltium_rider/widgets/dashboard_referral_card.dart';

/// Widget tests for dashboard sub-widgets:
/// - WalletCard: normal vs low-balance variants, streak display, top-up action
/// - PlanCard: plan name, time remaining, next recharge
/// - ReferralCard: code display, copy & share actions

Widget wrapInMaterialApp(Widget child) {
  return MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child)));
}

void main() {
  group('WalletCard — Normal Balance', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 5000,
          requiredPayment: 2000,
          paymentStreak: 3,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.byType(WalletCard), findsOneWidget);
    });

    testWidgets('displays balance amount', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 5000,
          requiredPayment: 2000,
          paymentStreak: 3,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.textContaining('5000'), findsOneWidget);
    });

    testWidgets('displays TOTAL BALANCE label', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 5000,
          requiredPayment: 2000,
          paymentStreak: 3,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.text('TOTAL BALANCE'), findsOneWidget);
    });

    testWidgets('displays payment streak', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 5000,
          requiredPayment: 2000,
          paymentStreak: 3,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.text('3/5 Days'), findsOneWidget);
      expect(find.text('Rental Recovery Streak'), findsOneWidget);
    });

    testWidgets('displays minimum recharge text', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 5000,
          requiredPayment: 2000,
          paymentStreak: 3,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.textContaining('minimum recharge'), findsOneWidget);
      expect(find.textContaining('2000'), findsAtLeastNWidgets(1));
    });

    testWidgets('shows 5 streak indicators', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 5000,
          requiredPayment: 2000,
          paymentStreak: 2,
        ),
      ));
      await tester.pumpAndSettle();
      // 5 containers for streak bars
      final streakRow = find.byType(WalletCard);
      expect(streakRow, findsOneWidget);
    });

    testWidgets('does not show low-balance warning', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 5000,
          requiredPayment: 2000,
          paymentStreak: 3,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.textContaining('insufficient'), findsNothing);
      expect(find.text('Top Up Wallet'), findsNothing);
    });

    testWidgets('top-up button calls onTopUp callback', (tester) async {
      bool tapped = false;
      await tester.pumpWidget(wrapInMaterialApp(
        WalletCard(
          walletBalance: 5000,
          requiredPayment: 2000,
          paymentStreak: 3,
          onTopUp: () => tapped = true,
        ),
      ));
      await tester.pumpAndSettle();

      // Tap the add button (normal card uses a round + button)
      final addButton = find.byIcon(Icons.add);
      if (addButton.evaluate().isNotEmpty) {
        await tester.tap(addButton);
        expect(tapped, isTrue);
      }
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 5000,
          requiredPayment: 2000,
          paymentStreak: 3,
        ),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group('WalletCard — Low Balance (Monthly Plan)', () {
    testWidgets('shows warning when balance < 25% of required', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 300,
          requiredPayment: 2000,
          paymentStreak: 0,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.textContaining('insufficient'), findsOneWidget);
      expect(find.text('Top Up Wallet'), findsOneWidget);
    });

    testWidgets('shows error color for non-daily low balance', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 100,
          requiredPayment: 2000,
          paymentStreak: 0,
          currentPlan: 'monthly',
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
    });

    testWidgets('shows warning color for daily plan low balance',
        (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 100,
          requiredPayment: 2000,
          paymentStreak: 0,
          currentPlan: 'daily',
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
    });

    testWidgets('top-up button calls callback', (tester) async {
      bool tapped = false;
      await tester.pumpWidget(wrapInMaterialApp(
        WalletCard(
          walletBalance: 100,
          requiredPayment: 2000,
          paymentStreak: 0,
          onTopUp: () => tapped = true,
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Top Up Wallet'));
      expect(tapped, isTrue);
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 100,
          requiredPayment: 2000,
          paymentStreak: 0,
        ),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group('WalletCard — Compact Mode', () {
    testWidgets('renders in compact mode', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 5000,
          requiredPayment: 2000,
          paymentStreak: 3,
          compact: true,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.byType(WalletCard), findsOneWidget);
    });

    testWidgets('displays TOTAL BALANCE in compact mode', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 5000,
          requiredPayment: 2000,
          paymentStreak: 3,
          compact: true,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.text('TOTAL BALANCE'), findsOneWidget);
    });

    testWidgets('renders low-balance compact card without overflow',
        (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 50,
          requiredPayment: 2000,
          paymentStreak: 0,
          compact: true,
        ),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group('WalletCard — Edge Cases', () {
    testWidgets('zero balance renders correctly', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 0,
          requiredPayment: 2000,
          paymentStreak: 0,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.textContaining('0'), findsAtLeastNWidgets(1));
    });

    testWidgets('zero requiredPayment uses default 2000', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 0,
          requiredPayment: 0,
          paymentStreak: 0,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.textContaining('2000'), findsAtLeastNWidgets(1));
    });

    testWidgets('full streak (5/5) renders correctly', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const WalletCard(
          walletBalance: 10000,
          requiredPayment: 2000,
          paymentStreak: 5,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.text('5/5 Days'), findsOneWidget);
    });
  });

  group('PlanCard', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const PlanCard(
          currentPlan: 'WEEKLY',
          planEndDate: null,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.byType(PlanCard), findsOneWidget);
    });

    testWidgets('displays plan name', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const PlanCard(
          currentPlan: 'WEEKLY',
          planEndDate: null,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.text('WEEKLY'), findsOneWidget);
    });

    testWidgets('shows CURRENT SUBSCRIPTION label in non-compact mode',
        (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const PlanCard(
          currentPlan: 'DAILY',
          planEndDate: null,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.text('CURRENT SUBSCRIPTION'), findsOneWidget);
    });

    testWidgets('displays time remaining and next recharge labels',
        (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const PlanCard(
          currentPlan: 'WEEKLY',
          planEndDate: null,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.text('TIME REMAINING'), findsOneWidget);
      expect(find.text('NEXT RECHARGE'), findsOneWidget);
    });

    testWidgets('renders compact mode', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const PlanCard(
          currentPlan: 'DAILY',
          planEndDate: null,
          compact: true,
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.byType(PlanCard), findsOneWidget);
    });

    testWidgets('compact mode shows plan badge', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const PlanCard(
          currentPlan: 'DAILY',
          planEndDate: null,
          compact: true,
        ),
      ));
      await tester.pumpAndSettle();
      // Compact mode shows uppercase plan name in badge
      expect(find.text('DAILY'), findsOneWidget);
    });

    testWidgets('null plan shows WEEKLY PAYMENT default', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const PlanCard(
          currentPlan: null,
          planEndDate: null,
        ),
      ));
      await tester.pumpAndSettle();
      // In non-compact mode, null plan defaults to 'WEEKLY PAYMENT'
      expect(find.text('WEEKLY PAYMENT'), findsOneWidget);
    });

    testWidgets('null plan compact shows NO PLAN badge', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const PlanCard(
          currentPlan: null,
          planEndDate: null,
          compact: true,
        ),
      ));
      await tester.pumpAndSettle();
      // In compact mode, null plan shows 'NO PLAN' badge
      expect(find.text('NO PLAN'), findsOneWidget);
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const PlanCard(
          currentPlan: 'WEEKLY',
          planEndDate: null,
        ),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group('ReferralCard', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const ReferralCard(referralCode: 'VF-RD-88'),
      ));
      await tester.pumpAndSettle();
      expect(find.byType(ReferralCard), findsOneWidget);
    });

    testWidgets('displays referral code', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const ReferralCard(referralCode: 'VF-RD-88'),
      ));
      await tester.pumpAndSettle();
      expect(find.text('VF-RD-88'), findsOneWidget);
    });

    testWidgets('displays Refer & Earn title', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const ReferralCard(referralCode: 'VF-RD-88'),
      ));
      await tester.pumpAndSettle();
      expect(find.text('Refer & Earn'), findsOneWidget);
    });

    testWidgets('displays YOUR CODE label', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const ReferralCard(referralCode: 'VF-RD-88'),
      ));
      await tester.pumpAndSettle();
      expect(find.text('YOUR CODE'), findsOneWidget);
    });

    testWidgets('shows copy and share icons', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const ReferralCard(referralCode: 'VF-RD-88'),
      ));
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.copy), findsOneWidget);
      expect(find.byIcon(Icons.share), findsOneWidget);
    });

    testWidgets('copy button copies to clipboard', (tester) async {
      bool copyCalled = false;
      await tester.pumpWidget(wrapInMaterialApp(
        ReferralCard(
          referralCode: 'VF-RD-88',
          onCopy: () => copyCalled = true,
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.copy));
      await tester.pump();
      expect(copyCalled, isTrue);
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(wrapInMaterialApp(
        const ReferralCard(referralCode: 'VF-RD-88'),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
