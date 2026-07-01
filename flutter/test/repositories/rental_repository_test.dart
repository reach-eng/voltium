import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/rentals/data/repository_impl.dart';

class MockVoltiumApiClient extends Mock implements VoltiumApiClient {}

void main() {
  late MockVoltiumApiClient mockApiClient;
  late RentalRepositoryImpl repository;

  setUp(() {
    mockApiClient = MockVoltiumApiClient();
    repository = RentalRepositoryImpl(mockApiClient);
  });

  group('RentalRepositoryImpl', () {
    test('fetchHubs calls getAdminHubs', () async {
      when(() => mockApiClient.getAdminHubs())
          .thenAnswer((_) async => ListHubsResponse(hubs: []));

      final result = await repository.fetchHubs();
      expect(result['hubs'], isEmpty);
      verify(() => mockApiClient.getAdminHubs()).called(1);
    });

    test('fetchVehicles calls getVehicles', () async {
      when(() => mockApiClient.getVehicles(any()))
          .thenAnswer((_) async => ListVehiclesResponse(vehicles: []));

      final result = await repository.fetchVehicles('hub123');
      expect(result['vehicles'], isEmpty);
      verify(() => mockApiClient.getVehicles('hub123')).called(1);
    });

    test('subscribePlan calls postRiderPlans', () async {
      when(() => mockApiClient.postRiderPlans(any()))
          .thenAnswer((_) async => {'success': true});

      final result = await repository.subscribePlan(
        hubId: 'hub123',
        planId: 'plan123',
        securityDeposit: 2500,
      );

      expect(result['success'], true);
      final captured = verify(() => mockApiClient.postRiderPlans(captureAny())).captured;
      final request = captured.first as Map<String, dynamic>;
      expect(request['hubId'], 'hub123');
      expect(request['planId'], 'plan123');
      expect(request['securityDeposit'], 2500.0);
    });

    test('syncPickup calls postRiderSyncPickup', () async {
      when(() => mockApiClient.postRiderSyncPickup(any()))
          .thenAnswer((_) async => {'success': true});

      final result = await repository.syncPickup(
        vehicleId: 'v123',
        hubId: 'h123',
        bookingId: 'b123',
      );

      expect(result['success'], true);
      final captured = verify(() => mockApiClient.postRiderSyncPickup(captureAny())).captured;
      final request = captured.first as Map<String, dynamic>;
      expect(request['vehicleId'], 'v123');
      expect(request['hubId'], 'h123');
      expect(request['bookingId'], 'b123');
    });

    // submitVehicleReturn depends on VoltiumApiService singleton. 
    // We can skip testing it here or test it via integration.
  });
}
