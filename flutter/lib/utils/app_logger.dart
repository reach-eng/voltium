import 'package:logger/logger.dart';
import 'package:flutter/foundation.dart';

// Create a configured logger instance
final _logger = Logger(
  printer: kDebugMode
      ? PrettyPrinter(
          methodCount: 1,
          errorMethodCount: 5,
          lineLength: 80,
          colors: true,
          printEmojis: true,
        )
      : SimplePrinter(),
  level: kDebugMode ? Level.debug : Level.info,
);

void appLog(String message, {String? tag, dynamic data}) {
  final content = tag != null ? '[$tag] $message' : message;
  _logger.d(data != null ? '$content: $data' : content);
}

void logApi(String message, {dynamic data}) {
  appLog(message, tag: 'API', data: data);
}

void logAuth(String message, {dynamic data}) {
  appLog(message, tag: 'AUTH', data: data);
}

void logState(String message, {dynamic data}) {
  appLog(message, tag: 'STATE', data: data);
}

void logError(String message, {dynamic error, StackTrace? stackTrace}) {
  _logger.e(message, error: error, stackTrace: stackTrace);
}

/// Replacement for `debugPrint` that respects `kDebugMode`.
///
/// Flutter's `debugPrint` always prints in release mode (it just strips
/// assertion info). For a privacy-and-noise conscious app, this wrapper
/// suppresses debug output entirely outside debug builds. It delegates to
/// `debugPrint` (NOT `_logger`) so output stays overridable in tests and
/// respects the framework's throttling; structured error paths use the
/// `appLog` family / `logError` instead.
///
/// Existing call sites can keep their `debugPrint(...)` syntax by adding
/// `import 'package:voltium_rider/utils/app_logger.dart' show appDebug;`
/// and changing `debugPrint(...)` to `appDebug(...)`. New code should
/// prefer the structured `appLog` family.
void appDebug(String? message, {String? tag}) {
  if (kDebugMode) {
    debugPrint(tag != null ? '[$tag] $message' : message);
  }
}
