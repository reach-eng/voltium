import 'package:flutter/foundation.dart';

enum AnalyticsEvent {
  appOpened,
  appBackgrounded,
  screenViewed,
  buttonTapped,
  formSubmitted,
  apiCallStarted,
  apiCallCompleted,
  apiCallFailed,
  loginStarted,
  loginSuccess,
  loginFailed,
  otpSent,
  otpVerified,
  kycSubmitted,
  planSubscribed,
  topUpInitiated,
  topUpCompleted,
  errorOccurred,
}

class AnalyticsService {
  static final AnalyticsService _instance = AnalyticsService._internal();
  factory AnalyticsService() => _instance;
  AnalyticsService._internal();

  bool _isEnabled = kDebugMode == false;
  bool get isEnabled => _isEnabled;

  void setEnabled(bool enabled) {
    _isEnabled = enabled;
  }

  void track(AnalyticsEvent event, [Map<String, dynamic>? params]) {
    if (!_isEnabled) return;

    final eventName = event.name;
    final properties = {
      ...?params,
      'timestamp': DateTime.now().toIso8601String(),
    };

    debugPrint('[Analytics] $eventName: $properties');
  }

  void trackScreen(String screenName, [Map<String, dynamic>? params]) {
    track(AnalyticsEvent.screenViewed, {
      'screen_name': screenName,
      ...?params,
    });
  }

  void trackButtonTap(String buttonName, String screenName) {
    track(AnalyticsEvent.buttonTapped, {
      'button_name': buttonName,
      'screen_name': screenName,
    });
  }

  void trackApiCall(String endpoint, String method, bool success) {
    track(
        success
            ? AnalyticsEvent.apiCallCompleted
            : AnalyticsEvent.apiCallFailed,
        {
          'endpoint': endpoint,
          'method': method,
        });
  }

  void trackError(String errorType, String message) {
    track(AnalyticsEvent.errorOccurred, {
      'error_type': errorType,
      'message': message,
    });
  }

  void trackLogin(String riderId, bool success) {
    track(success ? AnalyticsEvent.loginSuccess : AnalyticsEvent.loginFailed, {
      'rider_hash': riderId.hashCode.toString(),
    });
  }

  void setUserProperties(String riderId, Map<String, dynamic> properties) {
    if (!_isEnabled) return;
    debugPrint('[Analytics] User properties set for $riderId: $properties');
  }

  void clearUser() {
    if (!_isEnabled) return;
    debugPrint('[Analytics] User cleared');
  }
}
