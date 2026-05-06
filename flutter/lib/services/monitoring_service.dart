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
    debugPrint('🚨 [Monitoring] Error logged: $error');
    if (kDebugMode) return;
    
    Sentry.captureException(
      error,
      stackTrace: stackTrace,
      withScope: (scope) {
        if (reason != null) {
          scope.setTag('reason', reason);
        }
      },
    );
  }

  static void logInfo(String message) {
    debugPrint('ℹ️ [Monitoring] Info: $message');
    Sentry.addBreadcrumb(Breadcrumb(message: message, level: SentryLevel.info));
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
