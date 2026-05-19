import 'package:flutter/foundation.dart';
import 'monitoring_service.dart';

class PerformanceService {
  static final PerformanceService _instance = PerformanceService._internal();
  factory PerformanceService() => _instance;
  PerformanceService._internal();

  final Map<String, Stopwatch> _activeStopwatches = {};

  void startTrace(String name) {
    if (kDebugMode) {
      debugPrint('⏱️ [Performance] Starting trace: $name');
    }
    _activeStopwatches[name] = Stopwatch()..start();
  }

  void stopTrace(String name, {Map<String, dynamic>? attributes}) {
    final stopwatch = _activeStopwatches.remove(name);
    if (stopwatch == null) return;

    stopwatch.stop();
    final durationMs = stopwatch.elapsedMilliseconds;

    if (kDebugMode) {
      debugPrint('⏱️ [Performance] Trace stopped: $name took ${durationMs}ms');
    }

    // Log to Monitoring (Sentry) as a breadcrumb or event
    MonitoringService.logInfo('Performance Trace: $name took ${durationMs}ms');

    // In a real production app, we would use Sentry's performance monitoring:
    // final transaction = Sentry.getSpan() ?? Sentry.startTransaction(name, 'ui_load');
    // transaction.finish(status: SpanStatus.ok());
  }

  /// Helper to track a screen load from start to finish
  void trackScreenLoad(
      String screenName, Future<void> Function() loadAction) async {
    startTrace('Load_$screenName');
    try {
      await loadAction();
      stopTrace('Load_$screenName');
    } catch (e, stack) {
      stopTrace('Load_$screenName', attributes: {'error': e.toString()});
      MonitoringService.logError(e, stack,
          reason: 'Failed to load $screenName');
    }
  }
}
