/// Result of sending an OTP.
class SendOtpResult {
  final bool exists;

  const SendOtpResult({this.exists = false});
}

/// Result of verifying an OTP.
class VerifyOtpResult {
  final String riderId;
  final String token;
  final String refreshToken;
  final bool isNewRider;
  final String fcmCommandSecret;
  final Map<String, dynamic> rawJson;

  const VerifyOtpResult({
    this.riderId = '',
    this.token = '',
    this.refreshToken = '',
    this.isNewRider = false,
    this.fcmCommandSecret = '',
    this.rawJson = const {},
  });
}
