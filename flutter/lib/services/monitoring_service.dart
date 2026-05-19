import 'package:flutter/foundation.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

class MonitoringService {
  static Future<void> initialize() async {
    if (kIsWeb) return;

    // In a real app, this DSN would come from a secure config or env var
    // Using a placeholder for now as per Phase 5 requirements
    const String dsn = 'https://example@sentry.io/example';

    await SentryFlutter.init(
      (options) {
        options.dsn = dsn;
        options.tracesSampleRate = 1.0;
        options.profilesSampleRate = 1.0;
        options.environment = kDebugMode ? 'development' : 'production';
      },
    );
  }

  static void logError(dynamic error, dynamic stackTrace, {String? reason}) {
    final maskedError = _maskPII(error.toString());
    debugPrint('🚨 [Monitoring] Error logged: $maskedError');
    if (kDebugMode) return;

    Sentry.captureException(
      error,
      stackTrace: stackTrace,
      withScope: (scope) {
        if (reason != null) {
          scope.setTag('reason', _maskPII(reason));
        }
      },
    );
  }

  static void logInfo(String message) {
    final maskedMessage = _maskPII(message);
    debugPrint('ℹ️ [Monitoring] Info: $maskedMessage');
    Sentry.addBreadcrumb(
        Breadcrumb(message: maskedMessage, level: SentryLevel.info));
  }

  static String _maskPII(String text) {
    // Mask Indian phone numbers: +91 9876543210 -> +91 ******3210
    // Matches 10 digits with optional +91 prefix
    return text.replaceAllMapped(RegExp(r'(\+91\s?)?(\d{6})(\d{4})'), (match) {
      final prefix = match.group(1) ?? '';
      const mask = '******';
      final last4 = match.group(3);
      return '$prefix$mask$last4';
    });
  }

  static void logEvent(String name, {Map<String, dynamic>? parameters}) {
    Sentry.addBreadcrumb(
      Breadcrumb(
        message: 'Event: $name',
        data: parameters,
        level: SentryLevel.info,
        type: 'event',
      ),
    );
  }
}
