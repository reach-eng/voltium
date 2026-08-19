import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_earnings_card.dart';

void main() {
  group('DashboardEarningsCard Widget Tests', () {
    testWidgets('renders earnings amount, title, and streak badge',
        (WidgetTester tester) async {
      bool tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DashboardEarningsCard(
              todayEarnings: 1250,
              weeklyEarnings: const [400, 600, 800, 1000, 1100, 900, 1250],
              streakDays: 5,
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text("TODAY'S EARNINGS"), findsOneWidget);
      expect(find.text('₹1250'), findsOneWidget);
      expect(find.text('5 Day Streak'), findsOneWidget);
      expect(find.text('View earnings breakdown'), findsOneWidget);

      await tester.tap(find.byType(DashboardEarningsCard));
      expect(tapped, isTrue);
    });

    testWidgets('renders gracefully without weekly data or streak',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DashboardEarningsCard(
              todayEarnings: 0,
            ),
          ),
        ),
      );

      expect(find.text("TODAY'S EARNINGS"), findsOneWidget);
      expect(find.text('₹0'), findsOneWidget);
      expect(find.textContaining('Streak'), findsNothing);
    });
  });
}
