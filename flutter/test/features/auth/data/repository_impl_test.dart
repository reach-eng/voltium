import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/auth/data/repository_impl.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockVoltiumApiClient extends Mock implements VoltiumApiClient {}

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
    // sendOtp tests
    test('sendOtp returns exists=true when backend says exists=true', () async {
      when(() => mockVoltiumApiClient.postAuthSendOtp(any()))
          .thenAnswer((_) async => SendOtpResponse(exists: true));
      final result = await repository.sendOtp('9876543210');
      expect(result.exists, true);
    });

    test('sendOtp returns exists=false when backend says exists=false', () async {
      when(() => mockVoltiumApiClient.postAuthSendOtp(any()))
          .thenAnswer((_) async => SendOtpResponse(exists: false));
      final result = await repository.sendOtp('9876543210');
      expect(result.exists, false);
    });

    test('sendOtp defaults to exists=false when backend returns null exists', () async {
      when(() => mockVoltiumApiClient.postAuthSendOtp(any()))
          .thenAnswer((_) async => SendOtpResponse(exists: null));
      final result = await repository.sendOtp('9876543210');
      expect(result.exists, false);
    });

    test('sendOtp handles api exception', () async {
      when(() => mockVoltiumApiClient.postAuthSendOtp(any()))
          .thenThrow(Exception('API error'));
      expect(() => repository.sendOtp('9876543210'), throwsException);
    });

    test('sendOtp verifies correct phone is sent in request', () async {
      when(() => mockVoltiumApiClient.postAuthSendOtp(any()))
          .thenAnswer((_) async => SendOtpResponse(exists: true));
      await repository.sendOtp('9876543210');
      final captured = verify(() => mockVoltiumApiClient.postAuthSendOtp(captureAny())).captured;
      final request = captured.first as SendOtpRequest;
      expect(request.phone, '9876543210');
    });

    // verifyOtp tests
    test('verifyOtp returns full data for new rider', () async {
      when(() => mockVoltiumApiClient.postAuthVerifyOtp(any()))
          .thenAnswer((_) async => VerifyOtpResponse(
                token: 'tok',
                riderId: 'rid',
                isNewRider: true,
                fcmCommandSecret: null,
              ));
      final result = await repository.verifyOtp('9876543210', '123456');
      expect(result.token, 'tok');
      expect(result.riderId, 'rid');
      expect(result.isNewRider, true);
    });

    test('verifyOtp returns full data for existing rider', () async {
      when(() => mockVoltiumApiClient.postAuthVerifyOtp(any()))
          .thenAnswer((_) async => VerifyOtpResponse(
                token: 'tok_exist',
                riderId: 'rid_exist',
                isNewRider: false,
                fcmCommandSecret: null,
              ));
      final result = await repository.verifyOtp('9876543210', '123456');
      expect(result.token, 'tok_exist');
      expect(result.riderId, 'rid_exist');
      expect(result.isNewRider, false);
    });

    test('verifyOtp defaults missing values to empty or false', () async {
      when(() => mockVoltiumApiClient.postAuthVerifyOtp(any()))
          .thenAnswer((_) async => VerifyOtpResponse(
                token: null,
                riderId: null,
                isNewRider: null,
                fcmCommandSecret: null,
              ));
      final result = await repository.verifyOtp('9876543210', '123456');
      expect(result.token, '');
      expect(result.riderId, '');
      expect(result.isNewRider, false);
      expect(result.fcmCommandSecret, '');
    });

    test('verifyOtp does not save fcm secret if it is null', () async {
      when(() => mockVoltiumApiClient.postAuthVerifyOtp(any()))
          .thenAnswer((_) async => VerifyOtpResponse(
                token: 'tok',
                riderId: 'rid',
                fcmCommandSecret: null,
              ));
      await repository.verifyOtp('9876543210', '123456');
      verifyNever(() => mockStorage.writeFcmCommandSecret(any()));
    });

    test('verifyOtp does not save fcm secret if it is empty', () async {
      when(() => mockVoltiumApiClient.postAuthVerifyOtp(any()))
          .thenAnswer((_) async => VerifyOtpResponse(
                token: 'tok',
                riderId: 'rid',
                fcmCommandSecret: '',
              ));
      await repository.verifyOtp('9876543210', '123456');
      verifyNever(() => mockStorage.writeFcmCommandSecret(any()));
    });

    test('verifyOtp sends correct request data', () async {
      when(() => mockVoltiumApiClient.postAuthVerifyOtp(any()))
          .thenAnswer((_) async => VerifyOtpResponse(token: 'tok'));
      await repository.verifyOtp('9876543210', '654321');
      final captured = verify(() => mockVoltiumApiClient.postAuthVerifyOtp(captureAny())).captured;
      final request = captured.first as VerifyOtpRequest;
      expect(request.phone, '9876543210');
      expect(request.otp, '654321');
    });

    test('verifyOtp throws on api exception', () async {
      when(() => mockVoltiumApiClient.postAuthVerifyOtp(any()))
          .thenThrow(Exception('Verify error'));
      expect(() => repository.verifyOtp('9876543210', '123456'), throwsException);
    });

    // logout tests
    test('logout clears session from storage', () async {
      when(() => mockStorage.clearSession()).thenAnswer((_) async {});
      await repository.logout();
      verify(() => mockStorage.clearSession()).called(1);
    });

    test('logout handles storage exception', () async {
      when(() => mockStorage.clearSession()).thenThrow(Exception('Storage error'));
      expect(() => repository.logout(), throwsException);
    });

    test('logout delegates strictly to storage clearSession', () async {
      when(() => mockStorage.clearSession()).thenAnswer((_) async {});
      await repository.logout();
      verify(() => mockApiClient.storage).called(1);
    });
  });
}
