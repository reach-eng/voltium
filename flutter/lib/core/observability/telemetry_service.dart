import 'package:flutter/foundation.dart';

class TelemetryService {
  static void initialize() {
    if (kIsWeb) return;
    // OpenTelemetry initialization is a no-op until the
    // opentelemetry_dart package stabilizes its public API.
  }

  static void injectTraceHeaders(Map<String, String> headers) {
    // No-op: trace context propagation is handled by the HTTP client
    // interceptor when OpenTelemetry tracing is fully wired up.
  }
}
