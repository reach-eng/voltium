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
    // PR-4 (F-011): the submitVehicleReturn path now goes through
    // `_client.post(...)` with an Idempotency-Key header; the
    // generated `postRiderRentalReturn` is no longer called.
    repository = RentalRepositoryImpl(mockApiClient, mockVoltiumApiClient);
  });

  setUpAll(() {
    // Register a fallback for VehicleReturnRequest so mocktail can
    // capture/call it by value.
    registerFallbackValue(
      VehicleReturnRequest(returnPhotos: const <String>[]),
    );
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
    // PR-4 (F-011 — 2026-08-22 deep audit): the impl now goes through
    // `_client.post('/api/rental/return', ...)` with an Idempotency-Key
    // header, NOT the generated `postRiderRentalReturn`. The
    // generated method had no idempotency parameter and the
    // end-of-rental path triggers the security-deposit refund
    // branch — a double-submit on a 504 retry would double-bill
    // the rider for damages.
    test('submitVehicleReturn posts with Idempotency-Key header (F-011)',
        () async {
      when(() => mockApiClient.post(
            any(),
            body: any(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).thenAnswer((_) async => {'returnStatus': 'success'});

      final result = await repository.submitVehicleReturn(
        photos: ['photo1.jpg', 'photo2.jpg'],
      );

      expect(result['returnStatus'], 'success');
      final captured = verify(() => mockApiClient.post(
            '/api/rental/return',
            body: captureAny(named: 'body'),
            idempotencyKey: captureAny(named: 'idempotencyKey'),
          )).captured;
      final body = captured.first as Map<String, dynamic>;
      expect(body['returnPhotos'], ['photo1.jpg', 'photo2.jpg']);
    });

    test('submitVehicleReturn passes a fresh UUID v4 idempotency key',
        () async {
      when(() => mockApiClient.post(
            any(),
            body: any(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).thenAnswer((_) async => {'returnStatus': 'success'});

      await repository.submitVehicleReturn(photos: ['p1']);
      await repository.submitVehicleReturn(photos: ['p2']);
      final captured = verify(() => mockApiClient.post(
            '/api/rental/return',
            body: any(named: 'body'),
            idempotencyKey: captureAny(named: 'idempotencyKey'),
          )).captured;
      final keys = captured.cast<String?>();
      expect(keys[0], isNotNull);
      expect(keys[0]!.length, 36);
      expect(keys[0], isNot(equals(keys[1])),
          reason: 'F-011: every submit MUST get a fresh key');
    });

    test('submitVehicleReturn throws when post throws', () async {
      when(() => mockApiClient.post(
            any(),
            body: any(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).thenThrow(Exception('Return error'));

      expect(
        () => repository.submitVehicleReturn(photos: []),
        throwsException,
      );
    });

    test('submitVehicleReturn passes empty photos array correctly', () async {
      when(() => mockApiClient.post(
            any(),
            body: any(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).thenAnswer((_) async => {});

      await repository.submitVehicleReturn(photos: []);
      final captured = verify(() => mockApiClient.post(
            '/api/rental/return',
            body: captureAny(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).captured;
      final body = captured.first as Map<String, dynamic>;
      expect(body['returnPhotos'], isEmpty);
    });

    test('submitVehicleReturn returns full response payload', () async {
      when(() => mockApiClient.post(
            any(),
            body: any(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).thenAnswer((_) async => {'key1': 'val1', 'key2': 2});

      final result = await repository.submitVehicleReturn(photos: ['p1']);
      expect(result['key1'], 'val1');
      expect(result['key2'], 2);
    });

    // PR-4 (F-013 — 2026-08-22 deep audit): the odometer is now a
    // typed top-level `int` field, NOT a substring stuffed into
    // the `reason` prose. The server is expected to recompute
    // `{ odometerEnd - odometerStart } × rate/km` for excess-
    // mileage billing; the previous free-text field let a rider
    // type `0` and walk away owing nothing for 1,800 km.
    test('submitVehicleReturn posts odometer as a typed int (F-013)', () async {
      when(() => mockApiClient.post(
            any(),
            body: any(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).thenAnswer((_) async => {'returnStatus': 'success'});

      await repository.submitVehicleReturn(
        photos: ['p1'],
        odometer: 12345,
      );
      final captured = verify(() => mockApiClient.post(
            '/api/rental/return',
            body: captureAny(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).captured;
      final body = captured.first as Map<String, dynamic>;
      expect(body['odometer'], 12345,
          reason: 'F-013: odometer must be a typed int, not a string in '
              'reason');
      expect(body['returnPhotos'], ['p1']);
    });

    test('submitVehicleReturn omits odometer when null (back-compat)',
        () async {
      when(() => mockApiClient.post(
            any(),
            body: any(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).thenAnswer((_) async => {'returnStatus': 'success'});

      await repository.submitVehicleReturn(photos: ['p1']);
      final captured = verify(() => mockApiClient.post(
            '/api/rental/return',
            body: captureAny(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).captured;
      final body = captured.first as Map<String, dynamic>;
      expect(body.containsKey('odometer'), isFalse,
          reason: 'F-013: the odometer key is omitted when null so the '
              'pre-F-013 server (which has no odometer column) keeps '
              'accepting the request');
    });
  });
}
