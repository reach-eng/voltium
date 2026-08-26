import '../utils/app_logger.dart';

class MonitoringService {
  static Future<void> initialize() async {
    // Laptop-only rule: no local logs/local error tracking.
    // Errors remain local through debugPrint/local logs.
    appDebug('ℹ️ [Monitoring] Local-only monitoring initialized');
  }

  static void logError(dynamic error, dynamic stackTrace, {String? reason}) {
    final maskedError = _maskPII(error.toString());
    final maskedReason = reason == null ? '' : ' reason=${_maskPII(reason)}';
    appDebug(
      '🚨 [Monitoring] Error logged locally: $maskedError$maskedReason',
    );
    if (stackTrace != null) {
      appDebug(stackTrace.toString());
    }
  }

  static void logInfo(String message) {
    appDebug('ℹ️ [Monitoring] Info: ${_maskPII(message)}');
  }

  static void logEvent(String name, {Map<String, dynamic>? parameters}) {
    final safeParams = parameters
        ?.map((key, value) => MapEntry(key, _maskPII(value.toString())));
    appDebug('ℹ️ [Monitoring] Event: ${_maskPII(name)} ${safeParams ?? ''}');
  }

  static String _maskPII(String text) {
    return text.replaceAllMapped(RegExp(r'(\+91\s?)?(\d{6})(\d{4})'), (match) {
      final prefix = match.group(1) ?? '';
      final last4 = match.group(3);
      return '$prefix******$last4';
    }).replaceAll(
      RegExp(r'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', caseSensitive: false),
      '***@***',
    );
  }
}
