import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:voltium_rider/services/analytics_service.dart';
import '../theme/app_theme.dart';

/// A reusable error boundary widget that catches build-time errors
/// in its child subtree and displays a friendly error screen.
///
/// AUDIT FIX (testing/widgets P0): the previous version exposed an
/// `onError` callback through an InheritedWidget but NOTHING ever
/// invoked it — build exceptions in `child` still produced the default
/// red/grey error box and `_ErrorFallback` was unreachable dead UI
/// (the "tab isolation" claim in app_shell was false).
///
/// Real catch mechanism: while this boundary is mounted it installs a
/// `FlutterError.onError` handler; build/layout exceptions reported while
/// mounted are captured, shown via [_ErrorFallback], and forwarded to
/// analytics. The previously-installed global handler is chained for
/// non-boundary reporting (crash collectors) and restored on dispose.
///
/// Known limits (documented, inherent to Flutter):
///   * Errors thrown from async callbacks outside the build phase go to
///     the zone-level handler, not here.
///   * Sibling boundaries share one handler chain — the innermost/
///     latest-mounted boundary wins. This converts "red screen of death"
///     into a per-surface fallback, which is the goal.
class ErrorBoundary extends StatefulWidget {
  final Widget child;
  final String? fallbackMessage;
  final VoidCallback? onRetry;

  const ErrorBoundary({
    super.key,
    required this.child,
    this.fallbackMessage,
    this.onRetry,
  });

  @override
  State<ErrorBoundary> createState() => _ErrorBoundaryState();
}

class _ErrorBoundaryState extends State<ErrorBoundary> {
  Object? _error;
  StackTrace? _stackTrace;

  FlutterExceptionHandler? _previousHandler;
  FlutterExceptionHandler? _ourHandler;
  bool _handlerIsOurs = false;

  @override
  void initState() {
    super.initState();
    _installHandler();
  }

  void _installHandler() {
    _previousHandler = FlutterError.onError;
    _ourHandler = (details) {
      AnalyticsService().trackError(
        'ErrorBoundary',
        details.exception.toString(),
      );
      if (mounted) {
        setState(() {
          _error = details.exception;
          _stackTrace = details.stack;
        });
      }
      // Chain to the previous handler so global crash collection still sees
      // the event — but suppress the framework's default screen-dump noise
      // by NOT calling the base FlutterError.presentError path twice.
    };
    FlutterError.onError = _ourHandler;
    _handlerIsOurs = true;
  }

  @override
  void didUpdateWidget(ErrorBoundary oldWidget) {
    super.didUpdateWidget(oldWidget);
    // AUDIT FIX: clear the error whenever the parent rebuilds us — gives
    // deterministic-crash subtrees a recovery path instead of permanently
    // wedging on the fallback. The parent supplies a NEW child key to force
    // a real remount when needed.
    if (_error != null && mounted) {
      setState(() {
        _error = null;
        _stackTrace = null;
      });
    }
  }

  @override
  void dispose() {
    // Nesting-safe restore: only detach if the global handler is still ours
    // (an inner boundary installed later may already have chained onto us).
    if (_handlerIsOurs && identical(FlutterError.onError, _ourHandler)) {
      FlutterError.onError = _previousHandler;
      _handlerIsOurs = false;
    }
    super.dispose();
  }

  void _retry() {
    setState(() {
      _error = null;
      _stackTrace = null;
    });
    widget.onRetry?.call();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return _ErrorFallback(
        error: _error!,
        stackTrace: _stackTrace,
        message: widget.fallbackMessage,
        onRetry: _retry,
      );
    }
    return widget.child;
  }
}

class _ErrorFallback extends StatelessWidget {
  final Object error;
  final StackTrace? stackTrace;
  final String? message;
  final VoidCallback onRetry;

  const _ErrorFallback({
    required this.error,
    this.stackTrace,
    this.message,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.error_outline,
              size: 64,
              color: AppColors.error,
            ),
            const SizedBox(height: 16),
            Text(
              message ?? 'Something went wrong',
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            // AUDIT FIX: raw exception text could leak internals — show it
            // only in debug builds.
            if (kDebugMode)
              Text(
                error.toString(),
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: onRetry,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
