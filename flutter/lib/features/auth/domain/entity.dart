import 'package:voltium_rider/core/navigation/app_state.dart';
import 'package:voltium_rider/features/auth/presentation/rider_lifecycle_gate.dart';
import 'package:voltium_rider/models/rider_model.dart';

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
  final AppState nextState;

  const VerifyOtpResult({
    this.riderId = '',
    this.token = '',
    this.refreshToken = '',
    this.isNewRider = false,
    this.fcmCommandSecret = '',
    this.rawJson = const {},
    this.nextState = const AuthFlow(AuthStep.otpVerify),
  });

  /// Derive explicit AppState from rider profile if available, or fall back to [nextState].
  AppState determineAppState([RiderModel? rider]) {
    if (rider != null) {
      return RiderLifecycleGate.redirectAppState(rider);
    }
    if (isNewRider) {
      return const Onboarding(OnboardingStep.kycSubmit);
    }
    return nextState;
  }
}
