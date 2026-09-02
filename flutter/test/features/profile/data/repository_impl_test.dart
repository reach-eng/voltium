import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/profile/data/repository_impl.dart';

class MockVoltiumApiClient extends Mock implements VoltiumApiClient {}

class FakeUpdateProfileRequest extends Fake implements UpdateProfileRequest {}

void main() {
  late MockVoltiumApiClient mockVoltiumApiClient;
  late RiderRepositoryImpl repository;

  setUpAll(() {
    registerFallbackValue(FakeUpdateProfileRequest());
  });

  setUp(() {
    mockVoltiumApiClient = MockVoltiumApiClient();
    repository = RiderRepositoryImpl(mockVoltiumApiClient);
  });

  group('RiderRepositoryImpl', () {
    // getRiderProfile
    test('getRiderProfile returns properly formatted map', () async {
      when(() => mockVoltiumApiClient.getRiderProfile()).thenAnswer((_) async =>
          RiderProfileResponse(riderId: '123', fullName: 'John Doe'));

      final result = await repository.getRiderProfile();

      expect(result.containsKey('data'), true);
      expect(result.containsKey('rider'), true);
      expect(result['data']['riderId'], '123');
      expect(result['data']['fullName'], 'John Doe');
    });

    test('getRiderProfile throws when api client throws', () async {
      when(() => mockVoltiumApiClient.getRiderProfile())
          .thenThrow(Exception('API error'));

      expect(() => repository.getRiderProfile(), throwsException);
    });

    test('getRiderProfile returns empty json if fields are null', () async {
      when(() => mockVoltiumApiClient.getRiderProfile())
          .thenAnswer((_) async => RiderProfileResponse());

      final result = await repository.getRiderProfile();

      expect(result['data'], isA<Map>());
      expect(result['data']['riderId'], null);
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
  });
}
