import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/auth/data/repository_impl.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockVoltiumApiClient extends Mock implements VoltiumApiClient {}

// SecureStorageService is a concrete class — mock it via mocktail's Mock
class MockSecureStorageService extends Mock implements SecureStorageService {}

class FakeSendOtpRequest extends Fake implements SendOtpRequest {}

class FakeVerifyOtpRequest extends Fake implements VerifyOtpRequest {}

void main() {
  late MockApiClient mockApiClient;
  late MockVoltiumApiClient mockVoltiumApiClient;
  late MockSecureStorageService mockStorage;
  late AuthRepositoryImpl repository;

  setUpAll(() {
    registerFallbackValue(FakeSendOtpRequest());
    registerFallbackValue(FakeVerifyOtpRequest());
  });

  setUp(() {
    mockApiClient = MockApiClient();
    mockVoltiumApiClient = MockVoltiumApiClient();
    mockStorage = MockSecureStorageService();

    when(() => mockApiClient.storage).thenReturn(mockStorage);

    repository = AuthRepositoryImpl(mockApiClient, mockVoltiumApiClient);
  });

  group('AuthRepository', () {
    test('sendOtp delegates to postAuthSendOtp and returns exists flag',
        () async {
      when(() => mockVoltiumApiClient.postAuthSendOtp(any()))
          .thenAnswer((_) async => SendOtpResponse(exists: true));

      final result = await repository.sendOtp('9876543210');

      expect(result.exists, isTrue);
      verify(() => mockVoltiumApiClient.postAuthSendOtp(any())).called(1);
    });

    test('sendOtp maps exists=false correctly', () async {
      when(() => mockVoltiumApiClient.postAuthSendOtp(any()))
          .thenAnswer((_) async => SendOtpResponse(exists: false));

      final result = await repository.sendOtp('9876543210');

      expect(result.exists, isFalse);
    });

    test('verifyOtp returns result with token and riderId', () async {
      when(() => mockVoltiumApiClient.postAuthVerifyOtp(any()))
          .thenAnswer((_) async => VerifyOtpResponse(
                token: 'mock-token',
                riderId: 'mock-rider-id',
                isNewRider: false,
                fcmCommandSecret:
                    null, // null → skips SecureStorageService write
              ));

      final result = await repository.verifyOtp('9876543210', '123456');

      expect(result.token, 'mock-token');
      expect(result.riderId, 'mock-rider-id');
      expect(result.isNewRider, isFalse);
      verify(() => mockVoltiumApiClient.postAuthVerifyOtp(any())).called(1);
    });

    test('verifyOtp maps isNewRider=true correctly', () async {
      when(() => mockVoltiumApiClient.postAuthVerifyOtp(any()))
          .thenAnswer((_) async => VerifyOtpResponse(
                token: 'tok',
                riderId: 'rid',
                isNewRider: true,
                fcmCommandSecret: null,
              ));

      final result = await repository.verifyOtp('9876543210', '000000');

      expect(result.isNewRider, isTrue);
    });

    test('logout calls clearSession on client storage', () async {
      when(() => mockStorage.clearSession()).thenAnswer((_) async {});

      await repository.logout();

      verify(() => mockStorage.clearSession()).called(1);
    });
  });
}
