import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/rentals/data/repository_impl.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';

class MockVoltiumApiClient extends Mock implements VoltiumApiClient {}

class MockVoltiumApiService extends Mock implements VoltiumApiService {}

void main() {
  late MockVoltiumApiClient mockVoltiumApiClient;
  late MockVoltiumApiService mockApiService;
  late RentalRepositoryImpl repository;

  setUp(() {
    mockVoltiumApiClient = MockVoltiumApiClient();
    mockApiService = MockVoltiumApiService();

    // Inject mock into singleton
    VoltiumApiService.instance = mockApiService;

    repository = RentalRepositoryImpl(mockVoltiumApiClient);
  });

  tearDown(() {
    VoltiumApiService.instance = null;
  });

  group('RentalRepositoryImpl', () {
    // fetchHubs — the impl calls the rider-facing getRiderHubs (returns a raw
    // Map), not the admin-typed getAdminHubs.
    test('fetchHubs calls getRiderHubs and returns json map', () async {
      when(() => mockVoltiumApiClient.getRiderHubs())
          .thenAnswer((_) async => {'hubs': <dynamic>[]});

      final result = await repository.fetchHubs();
      expect(result.containsKey('hubs'), true);
      verify(() => mockVoltiumApiClient.getRiderHubs()).called(1);
    });

    test('fetchHubs propagates api exceptions', () async {
      when(() => mockVoltiumApiClient.getRiderHubs())
          .thenThrow(Exception('API error'));

      expect(() => repository.fetchHubs(), throwsException);
    });

    test('fetchHubs returns properly formatted data with hubs', () async {
      when(() => mockVoltiumApiClient.getRiderHubs()).thenAnswer((_) async => {
            'hubs': [
              {'id': 'hub1', 'name': 'Main Hub'},
            ],
          });

      final result = await repository.fetchHubs();
      expect((result['hubs'] as List).length, 1);
      expect((result['hubs'][0] as Map)['id'], 'hub1');
    });

    test('fetchHubs throws StateError when empty response (if applicable)',
        () async {
      when(() => mockVoltiumApiClient.getRiderHubs())
          .thenThrow(StateError('Empty response'));
      expect(() => repository.fetchHubs(), throwsStateError);
    });

    // fetchVehicles
    test('fetchVehicles calls getVehicles with hubId', () async {
      final mockVehicles = ListVehiclesResponse(vehicles: []);
      when(() => mockVoltiumApiClient.getVehicles(any()))
          .thenAnswer((_) async => mockVehicles);

      final result = await repository.fetchVehicles('hub1');
      expect(result.containsKey('vehicles'), true);
      verify(() => mockVoltiumApiClient.getVehicles('hub1')).called(1);
    });

    test('fetchVehicles propagates exceptions', () async {
      when(() => mockVoltiumApiClient.getVehicles(any()))
          .thenThrow(Exception('API Error'));

      expect(() => repository.fetchVehicles('hub1'), throwsException);
    });

    test('fetchVehicles validates returned payload', () async {
      final mockVehicles = ListVehiclesResponse(
          vehicles: [VehicleResponse(id: 'v1', status: 'AVAILABLE')]);
      when(() => mockVoltiumApiClient.getVehicles(any()))
          .thenAnswer((_) async => mockVehicles);

      final result = await repository.fetchVehicles('hub1');
      expect((result['vehicles'] as List).length, 1);
    });

    test('fetchVehicles handles null response correctly', () async {
      final mockVehicles = ListVehiclesResponse();
      when(() => mockVoltiumApiClient.getVehicles(any()))
          .thenAnswer((_) async => mockVehicles);

      final result = await repository.fetchVehicles('hub1');
      expect(result['vehicles'], null);
    });

    test('fetchVehicles sends correct hub id', () async {
      when(() => mockVoltiumApiClient.getVehicles('my-hub-id'))
          .thenAnswer((_) async => ListVehiclesResponse());
      await repository.fetchVehicles('my-hub-id');
      verify(() => mockVoltiumApiClient.getVehicles('my-hub-id')).called(1);
    });

    // subscribePlan
    test('subscribePlan calls postRiderPlans with correct payload', () async {
      when(() => mockVoltiumApiClient.postRiderPlans(any()))
          .thenAnswer((_) async => {'success': true});

      final result = await repository.subscribePlan(
        hubId: 'hub1',
        planId: 'plan1',
        securityDeposit: 500.0,
      );

      expect(result['success'], true);
      final captured =
          verify(() => mockVoltiumApiClient.postRiderPlans(captureAny()))
              .captured;
      final payload = captured.first as Map<String, dynamic>;
      expect(payload['hubId'], 'hub1');
      expect(payload['planId'], 'plan1');
      expect(payload['securityDeposit'], 500.0);
    });

    test('subscribePlan propagates exceptions', () async {
      when(() => mockVoltiumApiClient.postRiderPlans(any()))
          .thenThrow(Exception('Plan error'));

      expect(
        () => repository.subscribePlan(
            hubId: 'h', planId: 'p', securityDeposit: 0),
        throwsException,
      );
    });

    test('subscribePlan checks zero security deposit', () async {
      when(() => mockVoltiumApiClient.postRiderPlans(any()))
          .thenAnswer((_) async => {'id': '1'});
      await repository.subscribePlan(
          hubId: 'h', planId: 'p', securityDeposit: 0.0);
      final captured =
          verify(() => mockVoltiumApiClient.postRiderPlans(captureAny()))
              .captured;
      expect((captured.first as Map)['securityDeposit'], 0.0);
    });

    test('subscribePlan checks large security deposit', () async {
      when(() => mockVoltiumApiClient.postRiderPlans(any()))
          .thenAnswer((_) async => {'id': '1'});
      await repository.subscribePlan(
          hubId: 'h', planId: 'p', securityDeposit: 99999.0);
      final captured =
          verify(() => mockVoltiumApiClient.postRiderPlans(captureAny()))
              .captured;
      expect((captured.first as Map)['securityDeposit'], 99999.0);
    });

    // syncPickup
    test('syncPickup calls postRiderSyncPickup correctly', () async {
      when(() => mockVoltiumApiClient.postRiderSyncPickup(any()))
          .thenAnswer((_) async => {'status': 'ok'});

      final result = await repository.syncPickup(
        vehicleId: 'v1',
        hubId: 'h1',
        bookingId: 'b1',
      );

      expect(result['status'], 'ok');
      final captured =
          verify(() => mockVoltiumApiClient.postRiderSyncPickup(captureAny()))
              .captured;
      final payload = captured.first as Map<String, dynamic>;
      expect(payload['vehicleId'], 'v1');
      expect(payload['hubId'], 'h1');
      expect(payload['bookingId'], 'b1');
    });

    test('syncPickup throws exception on failure', () async {
      when(() => mockVoltiumApiClient.postRiderSyncPickup(any()))
          .thenThrow(Exception('Sync error'));

      expect(
        () => repository.syncPickup(
            vehicleId: 'v1', hubId: 'h1', bookingId: 'b1'),
        throwsException,
      );
    });

    test('syncPickup forwards map responses', () async {
      final fakeResponse = {'fake': 'response', 'time': 123};
      when(() => mockVoltiumApiClient.postRiderSyncPickup(any()))
          .thenAnswer((_) async => fakeResponse);
      final result = await repository.syncPickup(
          vehicleId: 'v', hubId: 'h', bookingId: 'b');
      expect(result, fakeResponse);
    });

    // submitVehicleReturn
    // PR-VER-2026-08-06 (RENTAL P0-1 + P0-3): the canonical body is now
    // `{ returnPhotos, reason }` — vehicleId/hubId/riderId were dropped;
    // the server resolves rider + vehicle from the session.
    test('submitVehicleReturn delegates to VoltiumApiService', () async {
      when(() => mockApiService.submitVehicleReturn(
            returnPhotos: any(named: 'returnPhotos'),
            reason: any(named: 'reason'),
          )).thenAnswer((_) async => {'returnStatus': 'success'});

      final result = await repository.submitVehicleReturn(
        photos: ['photo1.jpg', 'photo2.jpg'],
      );

      expect(result['returnStatus'], 'success');
      verify(() => mockApiService.submitVehicleReturn(
            returnPhotos: ['photo1.jpg', 'photo2.jpg'],
            reason: null,
          )).called(1);
    });

    test('submitVehicleReturn throws when service throws', () async {
      when(() => mockApiService.submitVehicleReturn(
            returnPhotos: any(named: 'returnPhotos'),
            reason: any(named: 'reason'),
          )).thenThrow(Exception('Return error'));

      expect(
        () => repository.submitVehicleReturn(photos: []),
        throwsException,
      );
    });

    test('submitVehicleReturn passes empty photos array correctly', () async {
      when(() => mockApiService.submitVehicleReturn(
            returnPhotos: any(named: 'returnPhotos'),
            reason: any(named: 'reason'),
          )).thenAnswer((_) async => {});

      await repository.submitVehicleReturn(photos: []);
      verify(() => mockApiService
          .submitVehicleReturn(returnPhotos: [], reason: null)).called(1);
    });

    test('submitVehicleReturn returns full response payload', () async {
      when(() => mockApiService.submitVehicleReturn(
            returnPhotos: any(named: 'returnPhotos'),
            reason: any(named: 'reason'),
          )).thenAnswer((_) async => {'key1': 'val1', 'key2': 2});

      final result = await repository.submitVehicleReturn(photos: ['p1']);
      expect(result['key1'], 'val1');
      expect(result['key2'], 2);
    });
  });
}
