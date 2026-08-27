import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/pickup_verification_screen.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';

import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

class _MockVoltiumApiClient extends VoltiumApiClient {
  _MockVoltiumApiClient() : super(ApiClient());
  int postPickupCallCount = 0;

  @override
  Future<Map<String, dynamic>> postRiderSyncPickup(
      Map<String, dynamic> body) async {
    postPickupCallCount++;
    return {'success': true, 'data': {}};
  }
}

class _SeededRiderNotifier extends RiderNotifier {
  _SeededRiderNotifier(this._seed);
  final RiderModel _seed;
  int refreshCallCount = 0;

  @override
  RiderState build() => RiderState(
        rider: _seed,
        riderId: _seed.riderId.isNotEmpty ? _seed.riderId : _seed.id,
        phone: _seed.phone,
        dataState: DataState.fresh,
        hasFetchedOnce: true,
      );

  @override
  Future<void> refreshFromApi({bool silent = false}) async {
    refreshCallCount++;
  }
}

void main() {
  Widget buildTestHost({
    required VoidCallback onNext,
    VoidCallback? onBack,
    String hubId = 'hub_01',
    String vehicleId = 'VH-101',
    String emergencyContact = '9876543210',
    String? pickupPhotoFront,
    RiderModel? rider,
    _MockVoltiumApiClient? mockApi,
    _SeededRiderNotifier? riderNotifier,
  }) {
    return ProviderScope(
      overrides: [
        if (mockApi != null)
          voltiumApiClientProvider.overrideWithValue(mockApi),
        riderProvider.overrideWith(() =>
            riderNotifier ??
            _SeededRiderNotifier(
              rider ??
                  const RiderModel(
                    id: 'rider_123',
                    riderId: 'rider_123',
                    name: 'Test Rider',
                    phone: '9999999999',
                    lifecycleStatus: 'NEW',
                  ),
            )),
      ],
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en'), Locale('hi')],
        theme: AppTheme.lightTheme,
        home: PickupVerificationScreen(
          onNext: onNext,
          onBack: onBack,
          hubId: hubId,
          vehicleId: vehicleId,
          emergencyContact: emergencyContact,
          pickupPhotoFront: pickupPhotoFront,
        ),
      ),
    );
  }

  group('PickupVerificationScreen Tests', () {
    testWidgets(
        'renders heading, agreement text, and photos status when present',
        (tester) async {
      await tester.pumpWidget(buildTestHost(
        onNext: () {},
        pickupPhotoFront: 'https://example.com/photo.jpg',
      ));
      await tester.pumpAndSettle();

      expect(find.text('Final Verification'), findsOneWidget);
      expect(find.text('Ready to Roll?'), findsOneWidget);
      expect(find.text('Vehicle photos captured'), findsOneWidget);
      expect(find.byKey(const Key('rentalAgreementCheckbox')), findsOneWidget);
      expect(find.byKey(const Key('completePickupButton')), findsOneWidget);
    });

    testWidgets('invokes onBack when back arrow is pressed', (tester) async {
      bool backCalled = false;
      await tester.pumpWidget(buildTestHost(
        onNext: () {},
        onBack: () => backCalled = true,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();

      expect(backCalled, isTrue);
    });

    testWidgets(
        'toggling terms checkbox enables agreement state and complete pickup button',
        (tester) async {
      await tester.pumpWidget(buildTestHost(onNext: () {}));
      await tester.pumpAndSettle();

      final checkbox = find.byKey(const Key('rentalAgreementCheckbox'));
      expect(tester.widget<Checkbox>(checkbox).value, isFalse);

      final buttonBefore = tester.widget<ElevatedButton>(
          find.byKey(const Key('completePickupButton')));
      expect(buttonBefore.onPressed, isNull);

      await tester.tap(checkbox);
      await tester.pumpAndSettle();

      expect(tester.widget<Checkbox>(checkbox).value, isTrue);
      final buttonAfter = tester.widget<ElevatedButton>(
          find.byKey(const Key('completePickupButton')));
      expect(buttonAfter.onPressed, isNotNull);
    });

    testWidgets(
        'advances immediately without duplicate POST if pickup is already done (N-17)',
        (tester) async {
      bool nextCalled = false;
      final mockApi = _MockVoltiumApiClient();
      final notifier = _SeededRiderNotifier(
        const RiderModel(
          id: 'rider_123',
          riderId: 'rider_123',
          name: 'Test Rider',
          phone: '9999999999',
          lifecycleStatus: 'ACTIVE',
          pickupDone: true,
        ),
      );

      await tester.pumpWidget(buildTestHost(
        onNext: () => nextCalled = true,
        mockApi: mockApi,
        riderNotifier: notifier,
      ));
      await tester.pumpAndSettle();

      // Check the agreement box
      await tester.tap(find.byKey(const Key('rentalAgreementCheckbox')));
      await tester.pumpAndSettle();

      // Tap complete pickup
      await tester.tap(find.byKey(const Key('completePickupButton')));
      await tester.pumpAndSettle();

      // Verified: API POST was skipped because isPickupDone is true
      expect(mockApi.postPickupCallCount, equals(0));
      expect(nextCalled, isTrue);
      expect(notifier.refreshCallCount, greaterThanOrEqualTo(1));
    });

    testWidgets('performs POST and advances when pickup is pending (N-17)',
        (tester) async {
      bool nextCalled = false;
      final mockApi = _MockVoltiumApiClient();
      final notifier = _SeededRiderNotifier(
        const RiderModel(
          id: 'rider_123',
          riderId: 'rider_123',
          name: 'Test Rider',
          phone: '9999999999',
          lifecycleStatus: 'NEW',
          pickupDone: false,
        ),
      );

      await tester.pumpWidget(buildTestHost(
        onNext: () => nextCalled = true,
        mockApi: mockApi,
        riderNotifier: notifier,
      ));
      await tester.pumpAndSettle();

      // Check the agreement box
      await tester.tap(find.byKey(const Key('rentalAgreementCheckbox')));
      await tester.pumpAndSettle();

      // Tap complete pickup
      await tester.tap(find.byKey(const Key('completePickupButton')));
      await tester.pumpAndSettle();

      // Verified: API POST was called and state was refreshed
      expect(mockApi.postPickupCallCount, equals(1));
      expect(nextCalled, isTrue);
      expect(notifier.refreshCallCount, equals(2));
    });
  });
}
