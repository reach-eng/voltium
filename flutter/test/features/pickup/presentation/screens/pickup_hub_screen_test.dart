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
  }) {
    return ProviderScope(
      overrides: [
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
        'transitions to error state with retry button on network failure',
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
  });
}
