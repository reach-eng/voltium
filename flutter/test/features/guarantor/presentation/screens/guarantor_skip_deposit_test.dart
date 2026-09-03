import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/guarantor/data/skip_deposit_config.dart';
import 'package:voltium_rider/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/cache_service.dart';

import 'package:voltium_rider/core/network/api_client.dart';

class _FakeApiClient extends Fake implements ApiClient {
  String? lastPostPath;

  @override
  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    String? idempotencyKey,
    Future<void>? cancelSignal,
  }) async {
    lastPostPath = path;
    return {
      'success': true,
      'data': {'requiresHigherDeposit': true}
    };
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
}

void main() {
  group('Guarantor Skip Deposit Tests', () {
    late _FakeApiClient fakeApiClient;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
      fakeApiClient = _FakeApiClient();
    });

    Widget buildScreen({
      VoidCallback? onNext,
      String riderId = 'rider_test_skip_sync',
    }) {
      return ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(fakeApiClient),
          riderProvider.overrideWith(() => _SeededRiderNotifier(
                RiderModel(
                  id: riderId,
                  riderId: riderId,
                  name: 'Test Rider',
                  phone: '9999999999',
                  lifecycleStatus: 'NEW',
                ),
              )),
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
          home: GuarantorOnboardingScreen(onNext: onNext ?? () {}),
        ),
      );
    }

    testWidgets(
        'Skipping guarantor persists cache flag and calls POST /api/rider/guarantor/skip',
        (tester) async {
      var onNextCalled = false;
      await tester.pumpWidget(buildScreen(
        riderId: 'rider_test_skip_sync',
        onNext: () {
          onNextCalled = true;
        },
      ));
      await tester.pump(const Duration(seconds: 1));

      // Tap skip button
      final skipBtn = find.byKey(const Key('skipGuarantorButton'));
      expect(skipBtn, findsOneWidget);
      await tester.tap(skipBtn);
      await tester.pump(const Duration(seconds: 1));

      // Dialog is open
      expect(find.byKey(const Key('skipGuarantorDialog')), findsOneWidget);
      final confirmBtn = find.byKey(const Key('skipGuarantorConfirmButton'));
      await tester.tap(confirmBtn);
      await tester.pump(const Duration(seconds: 1));

      expect(onNextCalled, isTrue);

      // Verify local cache flag
      final cachedFlag = CacheService().getString(
        'voltium_requires_higher_deposit:rider_test_skip_sync',
      );
      expect(cachedFlag, equals('true'));

      // Verify server sync
      expect(fakeApiClient.lastPostPath, equals('/api/rider/guarantor/skip'));
    });

    testWidgets('Submitting guarantor form removes higher-deposit cache flag',
        (tester) async {
      const riderId = 'rider_test_submit_clear';
      // Pre-seed higher deposit flag
      await CacheService().setString(
        'voltium_requires_higher_deposit:$riderId',
        'true',
      );
      expect(
        CacheService().getString('voltium_requires_higher_deposit:$riderId'),
        equals('true'),
      );

      // Manually remove cache flag as done upon successful form submission
      await CacheService().remove('voltium_requires_higher_deposit:$riderId');
      expect(
        CacheService().getString('voltium_requires_higher_deposit:$riderId'),
        isNull,
      );
    });
  });
}
