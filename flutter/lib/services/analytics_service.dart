import 'package:flutter/foundation.dart';
import 'monitoring_service.dart';
import '../utils/app_logger.dart';

enum AnalyticsEvent {
  appOpened,
  screenViewed,
  buttonTapped,
  apiCallCompleted,
  apiCallFailed,
  loginSuccess,
  loginFailed,
  errorOccurred,
}

/// PR-11 (2026-08-21): the canonical event API for the rider app.
///
/// All event / screen / identity calls route through
/// [MonitoringService] — the layer that talks to PostHog internally.
/// This class is now a thin wrapper that adds typed
/// [AnalyticsEvent] names so screens can `track(AnalyticsEvent.foo)`
/// instead of typing string literals.
///
/// Direct `PostHogService.*` calls are no longer used here. The
/// remaining 50+ direct call sites in feature screens are tolerated
/// for now and will be migrated in a follow-up.
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
    final properties = <String, Object>{
      if (params != null) ...params.map((k, v) => MapEntry(k, v as Object)),
    };

    appDebug('[Analytics] $eventName: $properties');
    // Fire-and-forget: the canonical interface (MonitoringService) is
    // async, but track() stays sync so screens don't need to await
    // analytics. PostHog itself is fire-and-forget in the SDK.
    MonitoringService.logEvent(eventName, parameters: properties);
  }

  void trackScreen(String screenName, [Map<String, dynamic>? params]) {
    if (!_isEnabled) return;
    final properties = <String, dynamic>{
      'screen_name': screenName,
      ...?params,
    };
    // Track through the typed AnalyticsEvent.screenViewed so the
    // PostHog event list stays consistent across screens.
    track(AnalyticsEvent.screenViewed, properties);
    // Also fire MonitoringService.logScreen so the screen event
    // lands in PostHog's screen() channel (used for funnel analysis).
    MonitoringService.logScreen(screenName, parameters: properties);
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
    if (success) {
      // PR-11: route through MonitoringService instead of PostHogService
      // directly. The hash happens here for testability; the actual
      // call is in MonitoringService.identifyUser.
      MonitoringService.identifyUser(riderId);
    }
  }

  void setUserProperties(String riderId, Map<String, dynamic> properties) {
    if (!_isEnabled) return;
    appDebug('[Analytics] User properties set for $riderId: $properties');
    // PR-11: route through MonitoringService (the canonical layer)
    // rather than PostHogService directly.
    MonitoringService.identifyUser(
      riderId,
      properties: properties,
    );
  }

  void clearUser() {
    if (!_isEnabled) return;
    appDebug('[Analytics] User cleared');
    MonitoringService.resetUser();
  }
}
