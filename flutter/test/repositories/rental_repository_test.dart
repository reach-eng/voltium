import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/rentals/data/repository_impl.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockVoltiumApiClient extends Mock implements VoltiumApiClient {}

void main() {
  late MockApiClient mockApiClient;
  late MockVoltiumApiClient mockVoltiumApiClient;
  late RentalRepositoryImpl repository;

  setUp(() {
    mockApiClient = MockApiClient();
    mockVoltiumApiClient = MockVoltiumApiClient();
    // PR-4 (F-011): the impl now takes both `ApiClient` (for the
    // Idempotency-Key-aware `_client.post` path) and the generated
    // `VoltiumApiClient` (kept for backwards-compat / future use).
    repository = RentalRepositoryImpl(mockApiClient, mockVoltiumApiClient);
  });

  group('RentalRepositoryImpl', () {
    test('fetchHubs calls getRiderHubs', () async {
      // The impl delegates to the rider-facing getRiderHubs (raw Map), not
      // the admin-typed getAdminHubs.
      when(() => mockVoltiumApiClient.getRiderHubs())
          .thenAnswer((_) async => {'hubs': <dynamic>[]});

      final result = await repository.fetchHubs();
      expect(result['hubs'], isEmpty);
      verify(() => mockVoltiumApiClient.getRiderHubs()).called(1);
    });

    test('fetchVehicles calls getVehicles', () async {
      when(() => mockVoltiumApiClient.getVehicles(any()))
          .thenAnswer((_) async => ListVehiclesResponse(vehicles: []));

      final result = await repository.fetchVehicles('hub123');
      expect(result['vehicles'], isEmpty);
      verify(() => mockVoltiumApiClient.getVehicles('hub123')).called(1);
    });

    test('subscribePlan calls postRiderPlans', () async {
      when(() => mockVoltiumApiClient.postRiderPlans(any()))
          .thenAnswer((_) async => {'success': true});

      final result = await repository.subscribePlan(
        hubId: 'hub123',
        planId: 'plan123',
        securityDeposit: 2500,
      );

      expect(result['success'], true);
      final captured =
          verify(() => mockVoltiumApiClient.postRiderPlans(captureAny()))
              .captured;
      final request = captured.first as Map<String, dynamic>;
      expect(request['hubId'], 'hub123');
      expect(request['planId'], 'plan123');
      expect(request['securityDeposit'], 2500.0);
    });

    test('syncPickup calls postRiderSyncPickup', () async {
      when(() => mockVoltiumApiClient.postRiderSyncPickup(any()))
          .thenAnswer((_) async => {'success': true});

      final result = await repository.syncPickup(
        vehicleId: 'v123',
        hubId: 'h123',
        bookingId: 'b123',
      );

      expect(result['success'], true);
      final captured =
          verify(() => mockVoltiumApiClient.postRiderSyncPickup(captureAny()))
              .captured;
      final request = captured.first as Map<String, dynamic>;
      expect(request['vehicleId'], 'v123');
      expect(request['hubId'], 'h123');
      expect(request['bookingId'], 'b123');
    });

    // submitVehicleReturn depends on VoltiumApiService singleton.
    // We can skip testing it here or test it via integration.
  });
}
