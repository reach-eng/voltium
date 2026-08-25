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

    // AUDIT FIX (P0 data-population): getRiderProfile now uses raw
    // ApiClient.get instead of the generated model. Mock it for all tests.
    when(() => mockApiClient.get('/api/rider/profile')).thenAnswer(
      (_) async => {
        'success': true,
        'data': {
          'riderId': '123',
          'fullName': 'John Doe',
        },
      },
    );
  });

  group('RiderRepositoryImpl', () {
    // getRiderProfile
    test('getRiderProfile returns full server JSON including rental fields',
        () async {
      // Override with a richer payload that includes fields the generated
      // model would have dropped.
      when(() => mockApiClient.get('/api/rider/profile')).thenAnswer(
        (_) async => {
          'success': true,
          'data': {
            'riderId': '123',
            'fullName': 'John Doe',
            'currentPlan': 'WEEKLY_MAX',
            'teamLeader': 'Rajesh',
            'assignedVehicle': 'VF-001',
            'walletBalance': 500.0,
            'paymentStreak': 3,
          },
        },
      );

      final result = await repository.getRiderProfile();

      expect(result.containsKey('data'), true);
      expect(result.containsKey('rider'), true);
      expect(result['data']['riderId'], '123');
      expect(result['data']['fullName'], 'John Doe');
      // Rental fields survive the round-trip (the old generated model
      // dropped them).
      expect(result['data']['currentPlan'], 'WEEKLY_MAX');
      expect(result['data']['teamLeader'], 'Rajesh');
      expect(result['data']['assignedVehicle'], 'VF-001');
    });

    test('getRiderProfile throws when api client throws', () async {
      when(() => mockApiClient.get('/api/rider/profile'))
          .thenThrow(Exception('API error'));

      expect(() => repository.getRiderProfile(), throwsException);
    });

    test('getRiderProfile handles empty data', () async {
      when(() => mockApiClient.get('/api/rider/profile')).thenAnswer(
        (_) async => {'success': true, 'data': {}},
      );

      final result = await repository.getRiderProfile();

      expect(result['data'], isA<Map>());
    });

    // updateRiderProfile
    test('updateRiderProfile calls putRiderProfile with mapped fields',
        () async {
      when(() => mockVoltiumApiClient.putRiderProfile(any()))
          .thenAnswer((_) async => <String, dynamic>{});

      final updateData = {
        'fullName': 'Jane Doe',
        'email': 'jane@example.com',
        'fatherName': 'John Sr',
        'motherName': 'Mary',
        'currentAddress': '123 Main St',
        'emergencyContact': '9876543210',
        'dob': '2000-01-01',
        'intent': 'work',
        'aadhaarFront': 'url1',
        'aadhaarBack': 'url2',
        'panCard': 'url3',
      };

      await repository.updateRiderProfile(updateData);

      final captured =
          verify(() => mockVoltiumApiClient.putRiderProfile(captureAny()))
              .captured;
      final request = captured.first as UpdateProfileRequest;
      expect(request.fullName, 'Jane Doe');
      expect(request.email, 'jane@example.com');
      expect(request.aadhaarFront, 'url1');
    });

    test('updateRiderProfile calls putRiderProfile with partial fields',
        () async {
      when(() => mockVoltiumApiClient.putRiderProfile(any()))
          .thenAnswer((_) async => <String, dynamic>{});

      final updateData = {
        'fullName': 'Jane Doe',
      };

      await repository.updateRiderProfile(updateData);

      final captured =
          verify(() => mockVoltiumApiClient.putRiderProfile(captureAny()))
              .captured;
      final request = captured.first as UpdateProfileRequest;
      expect(request.fullName, 'Jane Doe');
      expect(request.email, null);
    });

    test('updateRiderProfile throws when api throws', () async {
      when(() => mockVoltiumApiClient.putRiderProfile(any()))
          .thenThrow(Exception('Update error'));

      expect(() => repository.updateRiderProfile({}), throwsException);
    });

    // registerFCMToken
    test('registerFCMToken sends token correctly', () async {
      when(() => mockVoltiumApiClient.postRidersRegisterToken(any()))
          .thenAnswer((_) async => <String, dynamic>{});

      await repository.registerFCMToken('mock-fcm-token');

      final captured = verify(
              () => mockVoltiumApiClient.postRidersRegisterToken(captureAny()))
          .captured;
      final payload = captured.first as Map<String, dynamic>;
      expect(payload['fcmToken'], 'mock-fcm-token');
    });

    test('registerFCMToken throws when api throws', () async {
      when(() => mockVoltiumApiClient.postRidersRegisterToken(any()))
          .thenThrow(Exception('Token error'));

      expect(() => repository.registerFCMToken('token'), throwsException);
    });

    // syncDeviceData
    test('syncDeviceData sends data properly', () async {
      when(() => mockVoltiumApiClient.postRiderSyncDeviceData(any()))
          .thenAnswer((_) async => <String, dynamic>{});

      final data = {'battery': 90, 'os': 'Android'};
      await repository.syncDeviceData(data);

      final captured = verify(
              () => mockVoltiumApiClient.postRiderSyncDeviceData(captureAny()))
          .captured;
      final payload = captured.first as Map<String, dynamic>;
      expect(payload['battery'], 90);
    });

    test('syncDeviceData throws when api throws', () async {
      when(() => mockVoltiumApiClient.postRiderSyncDeviceData(any()))
          .thenThrow(Exception('Sync error'));

      expect(() => repository.syncDeviceData({}), throwsException);
    });

    // getEarnings
    test('getEarnings fetches and returns data', () async {
      final mockData = {'today': 100, 'week': 500};
      when(() => mockVoltiumApiClient.getRiderEarnings())
          .thenAnswer((_) async => mockData);

      final result = await repository.getEarnings();
      expect(result, mockData);
    });

    test('getEarnings throws on error', () async {
      when(() => mockVoltiumApiClient.getRiderEarnings())
          .thenThrow(Exception('Earnings error'));

      expect(() => repository.getEarnings(), throwsException);
    });

    // getSettings
    test('getSettings fetches and returns data', () async {
      final mockSettings = {'notificationsEnabled': true};
      when(() => mockVoltiumApiClient.getRiderSettings())
          .thenAnswer((_) async => mockSettings);

      final result = await repository.getSettings();
      expect(result, mockSettings);
    });

    test('getSettings throws on error', () async {
      when(() => mockVoltiumApiClient.getRiderSettings())
          .thenThrow(Exception('Settings error'));

      expect(() => repository.getSettings(), throwsException);
    });

    // getDeviceDetails
    test('getDeviceDetails uses basic ApiClient', () async {
      final mockDevice = {'model': 'Pixel'};
      when(() => mockApiClient.get('/api/rider/device'))
          .thenAnswer((_) async => mockDevice);

      final result = await repository.getDeviceDetails();
      expect(result, mockDevice);
    });
  });
}
