import 'package:posthog_flutter/posthog_flutter.dart';
import 'package:flutter/foundation.dart';

// Token and host are injected at build time via --dart-define or
// --dart-define-from-file referencing the project .env file.
const _token = String.fromEnvironment('POSTHOG_API_KEY');
const _host = String.fromEnvironment(
  'POSTHOG_HOST',
  defaultValue: 'https://us.i.posthog.com',
);

class PostHogService {
  static Future<void> initialize() async {
    if (_token.isEmpty) {
      if (kDebugMode) {
        debugPrint(
            '[PostHog] No API key — pass via --dart-define=POSTHOG_API_KEY=phc_xxx or --dart-define-from-file=.env');
      }
      return;
    }
    final config = PostHogConfig(_token);
    config.host = _host;
    config.debug = kDebugMode;
    await Posthog().setup(config);
    if (kDebugMode) {
      debugPrint('[PostHog] Initialized with host: $_host');
    }
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

  static Future<void> reset() async {
    await Posthog().reset();
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
