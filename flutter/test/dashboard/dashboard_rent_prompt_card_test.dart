import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/models/upcoming_rent_prompt.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_rent_prompt_card.dart';

void main() {
  group('UpcomingRentPrompt Model', () {
    test('fromJson parses full JSON correctly', () {
      final json = {
        'showPrompt': true,
        'leaseId': 'lease-100',
        'rentAmountInRupees': 500,
        'walletBalanceInRupees': 200,
        'shortfallInRupees': 300,
        'recommendedTopUpRupees': 300,
        'dueDate': '2026-08-05T00:30:00.000Z',
        'dueTimeFormatted': 'Tomorrow at 6:00 AM',
        'requiresTopUp': true,
      };

      final prompt = UpcomingRentPrompt.fromJson(json);

      expect(prompt.showPrompt, isTrue);
      expect(prompt.leaseId, 'lease-100');
      expect(prompt.rentAmountInRupees, 500);
      expect(prompt.walletBalanceInRupees, 200);
      expect(prompt.shortfallInRupees, 300);
      expect(prompt.recommendedTopUpRupees, 300);
      expect(prompt.dueTimeFormatted, 'Tomorrow at 6:00 AM');
      expect(prompt.requiresTopUp, isTrue);
    });

    test('toJson serializes correctly', () {
      final prompt = UpcomingRentPrompt(
        showPrompt: true,
        leaseId: 'lease-200',
        rentAmountInRupees: 400,
        walletBalanceInRupees: 600,
        shortfallInRupees: 0,
        recommendedTopUpRupees: 400,
        dueDate: DateTime.parse('2026-08-05T00:30:00.000Z'),
        dueTimeFormatted: 'Tomorrow at 6:00 AM',
        requiresTopUp: false,
      );

      final json = prompt.toJson();
      expect(json['showPrompt'], isTrue);
      expect(json['rentAmountInRupees'], 400);
      expect(json['requiresTopUp'], isFalse);
    });
  });

  group('DashboardRentPromptCard Widget', () {
    testWidgets('renders prompt card when showPrompt is true', (tester) async {
      final prompt = UpcomingRentPrompt(
        showPrompt: true,
        leaseId: 'lease-123',
        rentAmountInRupees: 500,
        walletBalanceInRupees: 200,
        shortfallInRupees: 300,
        recommendedTopUpRupees: 300,
        dueDate: DateTime.now().add(const Duration(hours: 12)),
        dueTimeFormatted: 'Tomorrow at 6:00 AM',
        requiresTopUp: true,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DashboardRentPromptCard(prompt: prompt),
          ),
        ),
      );

      expect(find.text('UPCOMING RENT DEBIT'), findsOneWidget);
      expect(find.text('Top-up before tomorrow 6 AM'), findsOneWidget);
      expect(find.text('Top up ₹300'), findsOneWidget);
    });

    testWidgets('renders nothing when showPrompt is false', (tester) async {
      final prompt = UpcomingRentPrompt(
        showPrompt: false,
        leaseId: '',
        rentAmountInRupees: 0,
        walletBalanceInRupees: 0,
        shortfallInRupees: 0,
        recommendedTopUpRupees: 0,
        dueDate: DateTime.now(),
        dueTimeFormatted: '',
        requiresTopUp: false,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DashboardRentPromptCard(prompt: prompt),
          ),
        ),
      );

      expect(find.text('UPCOMING RENT DEBIT'), findsNothing);
      expect(find.byType(ElevatedButton), findsNothing);
    });
  });
}
