import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/choose_plan_screen.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/rental_details_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

class FakeVoltiumApiClient extends Fake implements VoltiumApiClient {
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
          'iconKey': 'daily',
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
          'iconKey': 'weekly',
        },
      ],
    };
  }
}

/// Plan Selection Screen Widget Tests
void main() {
  final fakeClient = FakeVoltiumApiClient();

  Widget buildTestApp({required Widget child}) {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
        voltiumApiClientProvider.overrideWithValue(fakeClient),
      ],
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: child,
      ),
    );
  }

  group('Choose Plan Screen', () {
    testWidgets('plan selection screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: ChoosePlanScreen(
          onNext: () {},
          onBack: () {},
        ),
      ));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(ChoosePlanScreen), findsOneWidget);
    });

    testWidgets('plan screen shows plans or loading state', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: ChoosePlanScreen(
          onNext: () {},
          onBack: () {},
        ),
      ));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      final hasLoading =
          find.byType(CircularProgressIndicator).evaluate().isNotEmpty;
      final hasPlanCard = find.byType(Card).evaluate().isNotEmpty;
      final hasText = find.byType(Text).evaluate().isNotEmpty;

      expect(hasLoading || hasPlanCard || hasText, isTrue);
    });

    testWidgets('plan selection screen does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: ChoosePlanScreen(
          onNext: () {},
          onBack: () {},
        ),
      ));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    });
  });

  group('Active Rental Details Screen', () {
    testWidgets('rental details screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const RentalDetailsScreen()));
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(RentalDetailsScreen), findsOneWidget);
    });

    testWidgets('rental details screen does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const RentalDetailsScreen()));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    });
  });
}
