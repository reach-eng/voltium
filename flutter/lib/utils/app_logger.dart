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
/// routes every call through the structured logger with a `DEBUG` tag.
///
/// Existing call sites can keep their `debugPrint(...)` syntax by adding
/// `import 'package:voltium_rider/utils/app_logger.dart' show appDebug;`
/// and changing `debugPrint(...)` to `appDebug(...)`. New code should
/// prefer the structured `appLog` family.
void appDebug(String? message, {String? tag}) {
  if (kDebugMode) {
    _logger.d(tag != null ? '[$tag] $message' : message);
  }
}
