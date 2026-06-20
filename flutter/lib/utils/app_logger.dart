import 'package:flutter/foundation.dart';

void appLog(String message, {String? tag, dynamic data}) {
  if (!kDebugMode) return;

  final prefix = tag != null ? '[$tag] ' : '';
  if (data != null) {
    debugPrint('$prefix$message: $data');
  } else {
    debugPrint('$prefix$message');
  }
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
  if (!kDebugMode) return;
  debugPrint('[ERROR] $message: $error');
  if (stackTrace != null) {
    debugPrintStack(stackTrace: stackTrace);
  }
}
