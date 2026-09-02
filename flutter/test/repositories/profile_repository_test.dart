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
    test('getRiderProfile wraps response in data and rider', () async {
      when(() => mockVoltiumApiClient.getRiderProfile())
          .thenAnswer((_) async => RiderProfileResponse(
                riderId: '123',
                fullName: 'John',
              ));

      final result = await repository.getRiderProfile();

      expect(result['data'], isA<Map<String, dynamic>>());
      expect(result['data']['riderId'], '123');
      expect(result['rider'], isA<Map<String, dynamic>>());
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
  });
}
