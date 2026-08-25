import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/profile/data/repository_impl.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockVoltiumApiClient extends Mock implements VoltiumApiClient {}

class FakeUpdateProfileRequest extends Fake implements UpdateProfileRequest {}

void main() {
  late MockApiClient mockApiClient;
  late MockVoltiumApiClient mockVoltiumApiClient;
  late RiderRepositoryImpl repository;

  setUpAll(() {
    registerFallbackValue(FakeUpdateProfileRequest());
  });

  setUp(() {
    mockApiClient = MockApiClient();
    mockVoltiumApiClient = MockVoltiumApiClient();
    repository = RiderRepositoryImpl(mockApiClient, mockVoltiumApiClient);
  });

  group('RiderRepositoryImpl', () {
    test('getRiderProfile wraps response in data and rider', () async {
      // AUDIT FIX (P0 data-population): getRiderProfile now bypasses the
      // generated model and uses raw ApiClient to preserve ALL fields.
      when(() => mockApiClient.get('/api/rider/profile')).thenAnswer(
        (_) async => {
          'success': true,
          'data': {
            'riderId': '123',
            'fullName': 'John',
            'currentPlan': 'WEEKLY_MAX',
            'teamLeader': 'Rajesh',
            'assignedVehicle': 'VF-001',
            'walletBalance': 500.0,
          },
        },
      );

      final result = await repository.getRiderProfile();

      expect(result['data'], isA<Map<String, dynamic>>());
      expect(result['data']['riderId'], '123');
      expect(result['rider'], isA<Map<String, dynamic>>());
      // Verify rental fields survive the round-trip (the old generated
      // model dropped them).
      expect(result['data']['currentPlan'], 'WEEKLY_MAX');
      expect(result['data']['teamLeader'], 'Rajesh');
    });

    test('updateRiderProfile calls putRiderProfile with UpdateProfileRequest',
        () async {
      when(() => mockVoltiumApiClient.putRiderProfile(any()))
          .thenAnswer((_) async => <String, dynamic>{});

      final data = {
        'fullName': 'John Doe',
        'email': 'test@example.com',
      };

      await repository.updateRiderProfile(data);

      final captured =
          verify(() => mockVoltiumApiClient.putRiderProfile(captureAny()))
              .captured;
      final request = captured.first as UpdateProfileRequest;
      expect(request.fullName, 'John Doe');
      expect(request.email, 'test@example.com');
    });

    test('registerFCMToken calls postRidersRegisterToken', () async {
      when(() => mockVoltiumApiClient.postRidersRegisterToken(any()))
          .thenAnswer((_) async => <String, dynamic>{});

      await repository.registerFCMToken('token123');

      final captured = verify(
              () => mockVoltiumApiClient.postRidersRegisterToken(captureAny()))
          .captured;
      final request = captured.first as Map<String, dynamic>;
      expect(request['fcmToken'], 'token123');
    });

    test('syncDeviceData calls postRiderSyncDeviceData', () async {
      when(() => mockVoltiumApiClient.postRiderSyncDeviceData(any()))
          .thenAnswer((_) async => <String, dynamic>{});

      final data = {'battery': 50};
      await repository.syncDeviceData(data);

      verify(() => mockVoltiumApiClient.postRiderSyncDeviceData(data))
          .called(1);
    });

    test('getEarnings calls getRiderEarnings', () async {
      when(() => mockVoltiumApiClient.getRiderEarnings())
          .thenAnswer((_) async => {'amount': 500});

      final result = await repository.getEarnings();
      expect(result['amount'], 500);
    });

    test('getSettings calls getRiderSettings', () async {
      when(() => mockVoltiumApiClient.getRiderSettings())
          .thenAnswer((_) async => {'theme': 'dark'});

      final result = await repository.getSettings();
      expect(result['theme'], 'dark');
    });

    test('getDeviceDetails calls api client directly', () async {
      when(() => mockApiClient.get(any()))
          .thenAnswer((_) async => {'deviceId': 'abc'});

      final result = await repository.getDeviceDetails();
      expect(result['deviceId'], 'abc');
      verify(() => mockApiClient.get('/api/rider/device')).called(1);
    });
  });
}
