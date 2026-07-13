import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// Unified error state widget for consistent error display across the app.
///
/// Use instead of ad-hoc error Column/Container combinations.
///
/// Usage:
/// ```dart
/// ErrorStateWidget(
///   title: 'Unable to connect',
///   message: 'Check your internet connection and try again.',
///   onRetry: () => ref.read(appProvider).refresh(),
/// )
/// ```
class ErrorStateWidget extends StatelessWidget {
  final String title;
  final String? message;
  final IconData icon;
  final VoidCallback? onRetry;
  final String retryLabel;
  final Color? iconColor;
  final double iconSize;

  const ErrorStateWidget({
    super.key,
    required this.title,
    this.message,
    this.icon = Icons.error_outline_rounded,
    this.onRetry,
    this.retryLabel = 'Retry',
    this.iconColor,
    this.iconSize = 56,
  });

  /// Factory for network/connection errors.
  factory ErrorStateWidget.network({
    Key? key,
    String? message,
    VoidCallback? onRetry,
  }) {
    return ErrorStateWidget(
      key: key,
      title: 'Unable to connect',
      message: message ?? 'Check your internet connection and try again.',
      icon: Icons.cloud_off_rounded,
      onRetry: onRetry,
    );
  }

  /// Factory for "not found" / empty results.
  factory ErrorStateWidget.empty({
    Key? key,
    String title = 'No data found',
    String? message,
    VoidCallback? onRetry,
  }) {
    return ErrorStateWidget(
      key: key,
      title: title,
      message: message,
      icon: Icons.inbox_outlined,
      onRetry: onRetry,
      retryLabel: 'Refresh',
    );
  }

  /// Factory for generic "something went wrong" errors.
  factory ErrorStateWidget.generic({
    Key? key,
    String? message,
    VoidCallback? onRetry,
  }) {
    return ErrorStateWidget(
      key: key,
      title: 'Something went wrong',
      message: message ?? 'An unexpected error occurred. Please try again.',
      onRetry: onRetry,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: iconSize + 32,
              height: iconSize + 32,
              decoration: BoxDecoration(
                color: colors.errorSurface,
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: iconSize,
                color: iconColor ?? AppColors.errorRed,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              style: AppTypography.titleMedium.copyWith(
                color: colors.onSurface,
              ),
              textAlign: TextAlign.center,
            ),
            if (message != null) ...[
              const SizedBox(height: 8),
              Text(
                message!,
                style: AppTypography.bodyMedium.copyWith(
                  color: colors.onSurfaceMuted,
                ),
                textAlign: TextAlign.center,
              ),
            ],
            if (onRetry != null) ...[
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh, size: 18),
                label: Text(retryLabel),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.full),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
