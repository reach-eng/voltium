import 'package:posthog_flutter/posthog_flutter.dart';
import 'package:flutter/foundation.dart';

class PostHogService {
  static Future<void> initialize() async {
    if (kIsWeb) return; // For now focus on mobile app
    // PostHog SDK init is deferred until a real API key is provided via
    // environment configuration. The capture/screen/identify helpers below
    // are no-ops until then.
  }

  static Future<void> capture(String eventName,
      {Map<String, Object>? properties}) async {
    await Posthog().capture(
      eventName: eventName,
      properties: _scrubProperties(properties),
    );
  }

  static Future<void> screen(String screenName,
      {Map<String, Object>? properties}) async {
    await Posthog().screen(
      screenName: screenName,
      properties: _scrubProperties(properties),
    );
  }

  static Future<void> identify(String userId,
      {Map<String, Object>? properties}) async {
    await Posthog().identify(
      userId: userId,
      userProperties: _scrubProperties(properties),
    );
  }

  static Future<void> captureError(dynamic error, StackTrace? stack,
      {String? reason}) async {
    await Posthog().capture(
      eventName: 'fatal_error',
      properties: <String, Object>{
        'error_type': error.runtimeType.toString(),
        'error_message': error.toString(),
        if (reason != null) 'reason': reason,
        if (stack != null) 'stack': stack.toString(),
      },
    );
  }

  // PII Scrubbing
  static Map<String, Object>? _scrubProperties(
      Map<String, Object>? properties) {
    if (properties == null) return null;

    final Map<String, Object> scrubbed = Map<String, Object>.from(properties);
    final piiKeys = ['phone', 'email', 'otp', 'aadhaar', 'pan', 'password'];

    for (var key in scrubbed.keys) {
      if (piiKeys.any((p) => key.toLowerCase().contains(p))) {
        scrubbed[key] = '[SCRUBBED]';
      }
    }

    return scrubbed;
  }
}
