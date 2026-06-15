import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import '../domain/repository.dart';
import '../domain/entity.dart';

/// Implementation of AuthRepository.
class AuthRepositoryImpl implements AuthRepository {
  final ApiClient _client;
  final VoltiumApiClient _apiClient;

  AuthRepositoryImpl(this._client, this._apiClient);

  @override
  Future<SendOtpResult> sendOtp(String phone, {String? referralCode}) async {
    final request = SendOtpRequest(phone: phone);
    final response = await _apiClient.postAuthSendOtp(request);
    return SendOtpResult(
      exists: response.exists ?? false,
    );
  }

  @override
  Future<VerifyOtpResult> verifyOtp(String phone, String otp) async {
    final request = VerifyOtpRequest(phone: phone, otp: otp);
    final response = await _apiClient.postAuthVerifyOtp(request);
    return VerifyOtpResult(
      riderId: response.riderId ?? '',
      token: response.token ?? '',
      isNewRider: response.isNewRider ?? false,
    );
  }

  @override
  Future<void> logout() async {
    await _client.post('/api/auth/logout');
  }
}
