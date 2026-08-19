import 'package:voltium_rider/core/navigation/app_state.dart';
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
    // PR-VER-2026-08-06 (LOGIN_OTP_INTENT P0-1): the referral code used to be
    // dropped here — SendOtpRequest had no field, so signups with a code
    // lost it before the request left the device. The server captures the
    // code on verify (rider creation), so carry it through on send too.
    final request = SendOtpRequest(
      phone: phone,
      referralCode: referralCode,
    );
    final response = await _apiClient.postAuthSendOtp(request);
    return SendOtpResult(exists: response.exists ?? false);
  }

  @override
  Future<VerifyOtpResult> verifyOtp(String phone, String otp,
      {String? referralCode}) async {
    final request = VerifyOtpRequest(
      phone: phone,
      otp: otp,
      referralCode: referralCode,
    );
    final response = await _apiClient.postAuthVerifyOtp(request);

    final token = response.token;
    if (!PlatformInfo.isWeb && token != null && token.isNotEmpty) {
      await SecureStorageService().setToken(token);
      final refreshToken = response.refreshToken;
      if (refreshToken != null && refreshToken.isNotEmpty) {
        await SecureStorageService().setRefreshToken(refreshToken);
      }
    }

    // Persist the FCM command secret (BLOCKER 1.1) so subsequent
    // SECURITY_COMMAND FCM messages (ADMIN_LOCK etc.) can be HMAC-verified.
    // Web is excluded because FCM is mobile-only.
    final secret = response.fcmCommandSecret;
    if (!PlatformInfo.isWeb && secret != null && secret.isNotEmpty) {
      await SecureStorageService().writeFcmCommandSecret(secret);
    }
    final isNewRider = response.isNewRider ?? false;
    final nextAppState = isNewRider
        ? const Onboarding(OnboardingStep.kycSubmit)
        : const PreDashboard();

    return VerifyOtpResult(
      riderId: response.riderId ?? '',
      token: response.token ?? '',
      refreshToken: response.refreshToken ?? '',
      isNewRider: isNewRider,
      fcmCommandSecret: secret ?? '',
      rawJson: response.toJson(),
      nextState: nextAppState,
    );
  }

  @override
  Future<void> logout() async {
    // PR-VER-2026-08-06 (AUTH P0-1): the old implementation was a local-only
    // no-op. The web has POST /api/auth/logout — it invalidates the refresh
    // token server-side and writes the `rider.logout` audit row (SOC2).
    // Best-effort: an offline/failed logout must never block the user from
    // leaving, so the local credential wipe below always runs.
    try {
      await _client.post('/api/auth/logout');
    } catch (_) {
      // Token may already be invalid — the server call is best-effort.
    }
    // Preserve the FCM command secret + device-lock state (AUTH P1-4).
    await _client.storage.clearSessionCredentials();
  }

  @override
  Future<void> forgetRefreshToken() async {
    // DEEP-AUDIT D-P1-6 (2026-08-08): the local-only half of logout.
    // Called by RiderLogoutOrchestrator when the network call to
    // /api/auth/logout fails — the server-side session is still valid
    // until the JWT TTL, but deleting the persisted refresh token
    // closes the persistence-side hole. The session itself is gone
    // with the app process exit; this just makes a stolen secure-
    // storage copy worthless for refreshing.
    await _client.storage.deleteRefreshToken();
  }
}
