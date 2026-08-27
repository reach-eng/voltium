import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/pickup_hub_screen.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';

import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

class _FakeVoltiumApiClient extends VoltiumApiClient {
  _FakeVoltiumApiClient() : super(ApiClient());
  bool failHubs = false;

  @override
  Future<Map<String, dynamic>> getRiderHubs() async {
    if (failHubs) {
      throw ApiException('Server error', 500);
    }
    return {
      'success': true,
      'data': [
        {
          'id': 'hub_1',
          'name': 'Central Hub',
          'address': '123 Main St',
          'latitude': 12.9716,
          'longitude': 77.5946,
          'operatingHours': '8am - 8pm',
          'availableVehicles': 5,
        }
      ]
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
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await CacheService().init();
  });

  Widget buildTestHost({
    required Function(
      String hubId,
      String vehicleId,
      String? teamLeader,
      String emergencyContact,
      String? pickupPhotoFront,
      String? pickupPhotoBack,
      String? pickupPhotoLeft,
      String? pickupPhotoRight,
      String? pickupPhotoWithVehicle, {
      String? emergencyContactReceipt,
    }) onNext,
    VoidCallback? onBack,
    String? initialEmergencyContact,
    _FakeVoltiumApiClient? fakeApi,
  }) {
    return ProviderScope(
      overrides: [
        if (fakeApi != null)
          voltiumApiClientProvider.overrideWithValue(fakeApi),
        riderProvider.overrideWith(() => _SeededRiderNotifier(
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
        home: PickupHubScreen(
          onNext: onNext,
          onBack: onBack,
          initialEmergencyContact: initialEmergencyContact,
        ),
      ),
    );
  }

  group('PickupHubScreen Tests', () {
    testWidgets('displays CircularProgressIndicator on initial load',
        (tester) async {
      await tester.pumpWidget(buildTestHost(
        onNext: (_, __, ___, ____, _____, ______, _______, ________, _________,
            {emergencyContactReceipt}) {},
      ));

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets(
        'transitions to error state with retry button on network failure on first load',
        (tester) async {
      await tester.pumpWidget(buildTestHost(
        onNext: (_, __, ___, ____, _____, ______, _______, ________, _________,
            {emergencyContactReceipt}) {},
      ));

      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.error_outline_rounded), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets(
        'tapping Retry in error state is interactive and handles retry click',
        (tester) async {
      await tester.pumpWidget(buildTestHost(
        onNext: (_, __, ___, ____, _____, ______, _______, ________, _________,
            {emergencyContactReceipt}) {},
      ));

      await tester.pumpAndSettle();

      final retryButton = find.text('Retry');
      expect(retryButton, findsOneWidget);

      await tester.tap(retryButton);
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.error_outline_rounded), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets(
        'shows inline error banner and keeps form intact when refresh fails after hubs loaded (N-18)',
        (tester) async {
      final fakeApi = _FakeVoltiumApiClient();
      await tester.pumpWidget(buildTestHost(
        fakeApi: fakeApi,
        onNext: (_, __, ___, ____, _____, ______, _______, ________, _________,
            {emergencyContactReceipt}) {},
      ));

      await tester.pumpAndSettle();

      // Form is loaded
      expect(find.text('Pickup Verification'), findsOneWidget);
      expect(find.byKey(const Key('pickupHubInlineErrorBanner')), findsNothing);

      // Now simulate refresh error
      fakeApi.failHubs = true;

      // Trigger pull-to-refresh
      await tester.fling(
          find.text('Pickup Verification'), const Offset(0, 300), 1000);
      await tester.pumpAndSettle();

      // Form remains visible (not blown away into full-screen error)
      expect(find.text('Pickup Verification'), findsOneWidget);
      expect(
          find.byKey(const Key('pickupHubInlineErrorBanner')), findsOneWidget);

      // Now simulate network recovery and tap Retry on the inline banner
      fakeApi.failHubs = false;
      final retryBtn = find.byKey(const Key('pickupHubInlineRetryButton'));
      expect(retryBtn, findsOneWidget);
      await tester.tap(retryBtn);
      await tester.pumpAndSettle();

      // Banner is dismissed
      expect(find.byKey(const Key('pickupHubInlineErrorBanner')), findsNothing);
      expect(find.text('Pickup Verification'), findsOneWidget);
    });
  });
}
