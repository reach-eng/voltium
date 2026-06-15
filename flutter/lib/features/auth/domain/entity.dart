/// Result of sending an OTP.
class SendOtpResult {
  final bool exists;

  const SendOtpResult({this.exists = false});
}

/// Result of verifying an OTP.
class VerifyOtpResult {
  final String riderId;
  final String token;
  final bool isNewRider;

  const VerifyOtpResult({
    this.riderId = '',
    this.token = '',
    this.isNewRider = false,
  });
}
