import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/choose_plan_screen.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/rental_details_screen.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/providers/locale_provider.dart';
import 'package:voltium_rider/providers/theme_provider.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';

class FakeVoltiumApiService extends Fake implements VoltiumApiService {
  @override
  Future<Map<String, dynamic>> fetchPlans() async {
    return {
      'success': true,
      'data': [
        {
          'id': 'plan-1',
          'name': 'Daily Plan',
          'price': 100.0,
          'durationDays': 1,
        },
        {
          'id': 'plan-2',
          'name': 'Weekly Plan',
          'price': 600.0,
          'durationDays': 7,
        },
      ]
    };
  }
}

/// Plan Selection Screen Widget Tests
void main() {
  setUpAll(() {
    VoltiumApiService.instance = FakeVoltiumApiService();
  });
  Widget buildTestApp({required Widget child}) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => LocaleProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => AppProvider()),
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

      final hasLoading = find.byType(CircularProgressIndicator).evaluate().isNotEmpty;
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
      await tester.pumpAndSettle();
      expect(find.byType(RentalDetailsScreen), findsOneWidget);
    });

    testWidgets('rental details screen does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const RentalDetailsScreen()));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
