import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/choose_plan_screen.dart';

class _FakeVoltiumApiClient extends Fake implements VoltiumApiClient {
  final Map<String, dynamic>? pricingResponse;
  final bool throwOnPricing;

  _FakeVoltiumApiClient({
    this.pricingResponse,
    this.throwOnPricing = false,
  });

  @override
  Future<Map<String, dynamic>> getRiderPlans() async {
    return {
      'success': true,
      'data': [
        {
          'id': 'plan-1',
          'name': 'Daily Plan',
          'description': 'Ideal for daily riders',
          'price': 100.0,
          'securityDeposit': 500.0,
          'durationDays': 1,
          'features': ['Unlimited Swaps'],
          'category': 'DAILY',
          'bestValue': false,
        },
        {
          'id': 'plan-2',
          'name': 'Weekly Plan',
          'description': 'Ideal for weekly riders',
          'price': 600.0,
          'securityDeposit': 500.0,
          'durationDays': 7,
          'features': ['Unlimited Swaps'],
          'category': 'WEEKLY',
          'bestValue': true,
        },
      ],
    };
  }

  @override
  Future<Map<String, dynamic>> getRiderPricing() async {
    if (throwOnPricing) {
      throw Exception('Pricing 500 error');
    }
    return pricingResponse ?? {
      'success': true,
      'data': {
        'hub': {'id': 'hub-1', 'name': 'Indiranagar Hub'},
        'plans': [
          {'id': 'plan-1', 'available': true},
          {'id': 'plan-2', 'available': false},
        ],
      },
    };
  }
}

void main() {
  Widget createTestWidget(VoltiumApiClient client) {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
        voltiumApiClientProvider.overrideWithValue(client),
      ],
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en')],
        home: Scaffold(
          body: ChoosePlanScreen(
            onNext: () {},
          ),
        ),
      ),
    );
  }

  group('ChoosePlanScreen — Hub-Scoped Pricing & Availability (C-Wire)', () {
    testWidgets('renders availability badges for available and unavailable plans',
        (tester) async {
      final client = _FakeVoltiumApiClient();
      await tester.pumpWidget(createTestWidget(client));
      await tester.pumpAndSettle();

      // Check plan names
      expect(find.text('Daily Plan'), findsWidgets);
      expect(find.text('Weekly Plan'), findsWidgets);

      // Check availability badges
      expect(find.text('Available at Indiranagar Hub'), findsOneWidget);
      expect(find.text('Unavailable at Indiranagar Hub'), findsOneWidget);
    });

    testWidgets('gracefully degrades when getRiderPricing throws an error',
        (tester) async {
      final client = _FakeVoltiumApiClient(throwOnPricing: true);
      await tester.pumpWidget(createTestWidget(client));
      await tester.pumpAndSettle();

      // Plans should still render smoothly without throwing
      expect(find.text('Daily Plan'), findsWidgets);
      expect(find.text('Weekly Plan'), findsWidgets);
    });

    testWidgets('unavailable plan cannot be selected via tap', (tester) async {
      final client = _FakeVoltiumApiClient();
      await tester.pumpWidget(createTestWidget(client));
      await tester.pumpAndSettle();

      // Tap on planCard_1 (Weekly Plan which is unavailable) with warnIfMissed: false
      await tester.tap(find.byKey(const Key('planCard_1')), warnIfMissed: false);
      await tester.pumpAndSettle();

      // planCard_0 (Daily Plan) was pre-selected and should remain selected
      final selectedCard = tester.widget<Semantics>(
        find.descendant(
          of: find.byKey(const Key('planCard_0')),
          matching: find.byType(Semantics),
        ).first,
      );
      expect(selectedCard.properties.selected, isTrue);

      final unavailableCard = tester.widget<Semantics>(
        find.descendant(
          of: find.byKey(const Key('planCard_1')),
          matching: find.byType(Semantics),
        ).first,
      );
      expect(unavailableCard.properties.selected, isFalse);
      expect(unavailableCard.properties.enabled, isFalse);
    });
  });
}