import 'package:flutter/material.dart';
import 'package:voltium_rider/services/analytics_service.dart';

/// A reusable error boundary widget that catches build-time errors
/// in its child subtree and displays a friendly error screen.
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

  @override
  void initState() {
    super.initState();
    _error = null;
    _stackTrace = null;
  }

  @override
  void didUpdateWidget(ErrorBoundary oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.child != widget.child) {
      setState(() {
        _error = null;
        _stackTrace = null;
      });
    }
  }

  void _handleError(Object error, StackTrace stackTrace) {
    setState(() {
      _error = error;
      _stackTrace = stackTrace;
    });
    AnalyticsService().trackError('ErrorBoundary', error.toString());
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

    return _ErrorBoundaryScope(
      onError: _handleError,
      child: widget.child,
    );
  }
}

class _ErrorBoundaryScope extends InheritedWidget {
  final void Function(Object error, StackTrace stackTrace) onError;

  const _ErrorBoundaryScope({
    required this.onError,
    required super.child,
  });

  @override
  bool updateShouldNotify(_ErrorBoundaryScope oldWidget) =>
      onError != oldWidget.onError;
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
              color: Colors.red,
            ),
            const SizedBox(height: 16),
            Text(
              message ?? 'Something went wrong',
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
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
