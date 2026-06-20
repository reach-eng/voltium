import 'entity.dart';

/// Abstract repository for authentication operations.
abstract class AuthRepository {
  /// Sends OTP to the given phone number.
  Future<SendOtpResult> sendOtp(String phone, {String? referralCode});

  /// Verifies OTP and returns session token.
  Future<VerifyOtpResult> verifyOtp(String phone, String otp);

  /// Logs out the current rider session.
  Future<void> logout();
}
