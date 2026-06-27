import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/core/platform/platform_info.dart';
import 'package:voltium_rider/features/auth/domain/entity.dart';
import 'package:voltium_rider/features/auth/domain/repository.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';

/// Implementation of [AuthRepository] using the Voltium API.
class AuthRepositoryImpl implements AuthRepository {
  final ApiClient _client;
  final VoltiumApiClient _apiClient;

  AuthRepositoryImpl(this._client, this._apiClient);

  @override
  Future<SendOtpResult> sendOtp(String phone, {String? referralCode}) async {
    final request = SendOtpRequest(phone: phone);
    final response = await _apiClient.postAuthSendOtp(request);
    return SendOtpResult(exists: response.exists ?? false);
  }

  @override
  Future<VerifyOtpResult> verifyOtp(String phone, String otp) async {
    final request = VerifyOtpRequest(phone: phone, otp: otp);
    final response = await _apiClient.postAuthVerifyOtp(request);
    // Persist the FCM command secret (BLOCKER 1.1) so subsequent
    // SECURITY_COMMAND FCM messages (ADMIN_LOCK etc.) can be HMAC-verified.
    // Web is excluded because FCM is mobile-only.
    final secret = response.fcmCommandSecret;
    if (!PlatformInfo.isWeb && secret != null && secret.isNotEmpty) {
      await SecureStorageService().writeFcmCommandSecret(secret);
    }
    return VerifyOtpResult(
      riderId: response.riderId ?? '',
      token: response.token ?? '',
      isNewRider: response.isNewRider ?? false,
      fcmCommandSecret: secret ?? '',
    );
  }

  @override
  Future<void> logout() async {
    // No explicit logout endpoint; clear session token client-side
    await _client.storage.clearSession();
  }
}
