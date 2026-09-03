import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/guarantor/data/skip_deposit_config.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/choose_plan_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/cache_service.dart';

class _FakeVoltiumApiClient extends Fake implements VoltiumApiClient {
  Map<String, dynamic>? lastPostRiderPlansRequest;

  @override
  Future<Map<String, dynamic>> getRiderPlans() async {
    return {
      'success': true,
      'data': [
        {
          'id': 'plan_daily',
          'name': 'Daily Standard',
          'description': 'Daily flexible plan',
          'price': 150.0,
          'securityDeposit': 1000.0,
          'durationDays': 1,
          'category': 'daily',
          'features': ['Helmet included'],
          'isBestValue': false,
        },
      ],
    };
  }

  @override
  Future<Map<String, dynamic>> postRiderPlans(
      Map<String, dynamic> request) async {
    lastPostRiderPlansRequest = request;
    return {'success': true, 'data': {}};
  }
}

class _SeededRiderNotifier extends RiderNotifier {
  _SeededRiderNotifier(this._seed);
  final RiderModel _seed;

  @override
  RiderState build() => RiderState(
        rider: _seed,
        riderId: _seed.riderId.isNotEmpty ? _seed.riderId : _seed.id,
        phone: _seed.phone,
        dataState: DataState.fresh,
        hasFetchedOnce: true,
      );

  @override
  Future<void> refreshFromApi() async {
    // No-op in tests
  }
}

void main() {
  group('ChoosePlanScreen Higher Deposit Tests', () {
    late _FakeVoltiumApiClient fakeApiClient;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
      fakeApiClient = _FakeVoltiumApiClient();
    });

    Widget buildScreen({required RiderModel rider}) {
      return ProviderScope(
        overrides: [
          voltiumApiClientProvider.overrideWithValue(fakeApiClient),
          riderProvider.overrideWith(() => _SeededRiderNotifier(rider)),
          skipDepositConfigProvider.overrideWith((ref) async {
            return const SkipDepositConfig(
              extraDepositRupees: 1000,
              source: SkipDepositSource.admin,
            );
          }),
        ],
        child: MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en'), Locale('hi')],
          home: Scaffold(
            body: ChoosePlanScreen(
              onNext: () {},
              onBack: () {},
            ),
          ),
        ),
      );
    }

    testWidgets(
        'Rider with requiresHigherDeposit: true sees warning banner and pays higher deposit',
        (tester) async {
      const rider = RiderModel(
        id: 'rider_higher_dep',
        riderId: 'rider_higher_dep',
        name: 'Higher Dep Rider',
        phone: '9999999999',
        lifecycleStatus: 'NEW',
        pickupHub: 'hub_test_1',
        requiresHigherDeposit: true,
      );

      await tester.pumpWidget(buildScreen(rider: rider));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Banner should be visible
      expect(
          find.byKey(const Key('skipGuarantorDepositBanner')), findsOneWidget);
      expect(
        find.textContaining(
            'Higher security deposit (+₹1000) applied because guarantor onboarding was skipped.'),
        findsOneWidget,
      );

      // Verify plan card deposit text indicates skip guarantor addition
      expect(
        find.textContaining('skip-guarantor deposit'),
        findsOneWidget,
      );

      // Confirm plan
      final confirmBtn = find.byKey(const Key('confirmPlanButton'));
      expect(confirmBtn, findsOneWidget);
      await tester.tap(confirmBtn);
      await tester.pumpAndSettle();

      // Verify postRiderPlans payload has securityDeposit: 2000.0 (1000 base + 1000 extra)
      expect(fakeApiClient.lastPostRiderPlansRequest, isNotNull);
      expect(
        fakeApiClient.lastPostRiderPlansRequest!['securityDeposit'],
        equals(2000.0),
      );
    });

    testWidgets(
        'Rider with requiresHigherDeposit: false does not see banner and pays base deposit',
        (tester) async {
      const rider = RiderModel(
        id: 'rider_normal_dep',
        riderId: 'rider_normal_dep',
        name: 'Normal Dep Rider',
        phone: '9999999999',
        lifecycleStatus: 'NEW',
        pickupHub: 'hub_test_1',
        requiresHigherDeposit: false,
      );

      await tester.pumpWidget(buildScreen(rider: rider));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Banner should NOT be visible
      expect(find.byKey(const Key('skipGuarantorDepositBanner')), findsNothing);

      // Plan card should not have skip guarantor label
      expect(
        find.textContaining('skip guarantor'),
        findsNothing,
      );

      // Confirm plan
      final confirmBtn = find.byKey(const Key('confirmPlanButton'));
      expect(confirmBtn, findsOneWidget);
      await tester.tap(confirmBtn);
      await tester.pumpAndSettle();

      // Verify postRiderPlans payload has securityDeposit: 1000.0 (base only)
      expect(fakeApiClient.lastPostRiderPlansRequest, isNotNull);
      expect(
        fakeApiClient.lastPostRiderPlansRequest!['securityDeposit'],
        equals(1000.0),
      );
    });
  });
}
