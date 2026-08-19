import 'entity.dart';

/// Abstract repository for authentication operations.
abstract class AuthRepository {
  /// Sends OTP to the given phone number.
  Future<SendOtpResult> sendOtp(String phone, {String? referralCode});

  /// Verifies OTP and returns session token.
  Future<VerifyOtpResult> verifyOtp(String phone, String otp,
      {String? referralCode});

  /// Logs out the current rider session.
  Future<void> logout();

  /// DEEP-AUDIT D-P1-6 (2026-08-08): the local-only half of logout. When
  /// the network call to /api/rider/auth/logout fails (offline, server
  /// outage, etc.) the server-side session stays valid until the JWT
  /// TTL. To bound the damage we encrypt-and-delete the persisted
  /// refresh token — a stolen device that copied the secure-storage
  /// value before logout can no longer exchange it for a new access
  /// token. The session itself is gone with the app process exit; this
  /// just closes the persistence-side hole.
  Future<void> forgetRefreshToken();
}
