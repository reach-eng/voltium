import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/models/transaction_model.dart';
import 'package:voltium_rider/features/support/domain/entity.dart';
import 'package:voltium_rider/widgets/shell_banners.dart';
import 'package:voltium_rider/widgets/animated_bottom_nav.dart';
import 'package:voltium_rider/features/support/presentation/screens/ticket_detail_screen.dart';
import 'package:voltium_rider/features/wallet/presentation/widgets/wallet_widgets.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_receipt_screen.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_low_balance_card.dart';

Widget _wrapWithDarkTheme(Widget child) {
  return ProviderScope(
    child: MaterialApp(
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.dark,
      home: Scaffold(
        body: child,
      ),
    ),
  );
}

void main() {
  group('Dark Mode Component Audit Tests', () {
    testWidgets('SyncBanner renders properly in dark mode', (tester) async {
      await tester.pumpWidget(_wrapWithDarkTheme(const SyncBanner()));
      await tester.pumpAndSettle();
      expect(find.byType(SyncBanner), findsOneWidget);
    });

    testWidgets('SuspensionBanner renders without crash in dark mode', (tester) async {
      await tester.pumpWidget(_wrapWithDarkTheme(const SuspensionBanner()));
      await tester.pumpAndSettle();
      expect(find.byType(SuspensionBanner), findsOneWidget);
    });

    testWidgets('AppBottomNav renders properly with dark theme tokens', (tester) async {
      await tester.pumpWidget(
        _wrapWithDarkTheme(
          AppBottomNav(
            currentIndex: 0,
            onTap: (_) {},
            badgeCounts: const {0: 0, 1: 2, 2: 0, 3: 0},
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(AppBottomNav), findsOneWidget);
      expect(find.text('Dashboard'), findsOneWidget);
      expect(find.text('Wallet'), findsOneWidget);
    });

    testWidgets('TicketDetailScreen renders messages in dark mode', (tester) async {
      final ticket = TicketEntity(
        id: '1',
        ticketId: 'TKT-1001',
        subject: 'Battery swap query',
        message: 'Battery swap was delayed by 15 minutes',
        category: 'SUPPORT',
        status: TicketStatus.open,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
        messages: [
          TicketMessageEntity(
            id: 'M-1',
            senderType: 'ADMIN',
            message: 'We are looking into this.',
            createdAt: DateTime.now(),
          ),
          TicketMessageEntity(
            id: 'M-2',
            senderType: 'RIDER',
            message: 'Thank you.',
            createdAt: DateTime.now(),
          ),
        ],
      );

      await tester.pumpWidget(_wrapWithDarkTheme(TicketDetailScreen(ticket: ticket)));
      await tester.pumpAndSettle();
      expect(find.text('TKT-1001'), findsOneWidget);
      expect(find.text('Support Team'), findsOneWidget);
      expect(find.text('You'), findsOneWidget);
      expect(find.text('We are looking into this.'), findsOneWidget);
    });

    testWidgets('TransactionListTile renders credit and debit in dark mode', (tester) async {
      final creditTx = TransactionModel(
        id: 'TX-1',
        riderId: 'R-1',
        amount: 500.0,
        type: TransactionType.credit,
        status: TransactionStatus.approved,
        purpose: 'TOPUP',
        description: 'Wallet Top-Up',
        createdAt: DateTime.now(),
      );

      final debitTx = TransactionModel(
        id: 'TX-2',
        riderId: 'R-1',
        amount: 150.0,
        type: TransactionType.debit,
        status: TransactionStatus.success,
        purpose: 'RENTAL',
        description: 'Daily Rental Fee',
        createdAt: DateTime.now(),
      );

      await tester.pumpWidget(
        _wrapWithDarkTheme(
          SizedBox(
            width: 400,
            height: 600,
            child: ListView(
              children: [
                TransactionListTile(tx: creditTx),
                TransactionListTile(tx: debitTx),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('500'), findsOneWidget);
      expect(find.textContaining('150'), findsOneWidget);
      expect(find.text('Rent'), findsOneWidget);
    });

    testWidgets('MethodChip renders active and inactive states in dark mode', (tester) async {
      await tester.pumpWidget(
        _wrapWithDarkTheme(
          Row(
            children: [
              MethodChip(label: 'UPI', isSelected: true, onTap: () {}),
              MethodChip(label: 'Card', isSelected: false, onTap: () {}),
            ],
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('UPI'), findsOneWidget);
      expect(find.text('Card'), findsOneWidget);
    });

    testWidgets('TopUpReceiptScreen renders in dark mode', (tester) async {
      await tester.pumpWidget(
        _wrapWithDarkTheme(
          const TopUpReceiptScreen(
            amount: 1000,
            purpose: 'WALLET_TOPUP',
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.text('Payment Submitted'), findsOneWidget);
      expect(find.text('Verification in Progress'), findsOneWidget);
      expect(find.text('Back to Dashboard'), findsOneWidget);
    });

    testWidgets('DashboardLowBalanceCard renders with theme tokens in dark mode', (tester) async {
      await tester.pumpWidget(
        _wrapWithDarkTheme(
          Builder(
            builder: (context) {
              final colors = AppColors.of(context);
              return DashboardLowBalanceCard(
                walletBalance: 25.0,
                requiredPayment: 150.0,
                paymentStreak: 3,
                isDailyPlan: true,
                compact: false,
                colors: colors,
                amountTextColor: colors.warning,
                hasPulsatingRedAmountHalo: false,
                onTopUp: () {},
              );
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(DashboardLowBalanceCard), findsOneWidget);
    });
  });
}
