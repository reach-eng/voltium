/// Canonical error state widget for the Voltium Rider app.
///
/// Replaces the two parallel error widget families that existed pre-PR-3:
///   - `widgets/error_state_widget.dart`  (newer, themed — factories: .network, .empty, .generic)
///   - `widgets/empty_state.dart::NetworkErrorWidget`  (older, theme-default)
///   - `widgets/empty_state.dart::RetryWidget`         (older, simpler)
///
/// The new `ErrorState` keeps the best of both: themed primary surface
/// (Voltium Blue tint), optional retry CTA, and a richer factory set:
///   - `ErrorState.network(...)`         — offline / no connectivity
///   - `ErrorState.otp(...)`             — wrong / expired OTP (NEW in PR-3)
///   - `ErrorState.document(...)`        — blurry / rejected KYC doc (NEW in PR-3)
///   - `ErrorState.topup(...)`           — failed wallet top-up (NEW in PR-3)
///   - `ErrorState.form(...)`            — generic inline form error (NEW in PR-3)
///   - `ErrorState.generic(...)`         — last-resort "something went wrong"
///
/// Migration: `ErrorStateWidget(...)` → `ErrorState(...)` (drop the "Widget" suffix).
library;

import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class ErrorState extends StatelessWidget {
  final String title;
  final String? message;
  final IconData icon;
  final VoidCallback? onRetry;
  final String retryLabel;
  final Color? iconColor;
  final Color? iconBackground;
  final double iconSize;

  const ErrorState({
    super.key,
    required this.title,
    this.message,
    this.icon = Icons.error_outline_rounded,
    this.onRetry,
    this.retryLabel = 'Retry',
    this.iconColor,
    this.iconBackground,
    this.iconSize = 56,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Factories — keep the call-site readable and lock the copy in one place.
  // ──────────────────────────────────────────────────────────────────────────

  /// Offline / no connectivity. Use inside any screen body OR wrap a screen in
  /// `NetworkStatusBanner` (which now uses this internally).
  factory ErrorState.network({
    Key? key,
    String? message,
    VoidCallback? onRetry,
  }) {
    return ErrorState(
      key: key,
      title: 'You\'re offline',
      message: message ??
          'Check your internet connection. We\'ll auto-retry once you\'re back online.',
      icon: Icons.cloud_off_rounded,
      onRetry: onRetry,
      retryLabel: 'Retry',
    );
  }

  /// Wrong / expired OTP. Includes an attempt counter hint when caller passes it.
  factory ErrorState.otp({
    Key? key,
    String? message,
    int? attemptsRemaining,
    VoidCallback? onRetry,
  }) {
    final msg = message ??
        (attemptsRemaining != null
            ? 'That code didn\'t match. $attemptsRemaining attempt${attemptsRemaining == 1 ? '' : 's'} left.'
            : 'That code didn\'t match. Please try again.');
    return ErrorState(
      key: key,
      title: 'Wrong code',
      message: msg,
      icon: Icons.password_rounded,
      onRetry: onRetry,
      retryLabel: 'Try again',
    );
  }

  /// Blurry / rejected KYC document upload. The "Sample" CTA opens a dialog
  /// with a reference image — caller passes it in.
  factory ErrorState.document({
    Key? key,
    String? message,
    String? sampleHint,
    VoidCallback? onRetry,
  }) {
    return ErrorState(
      key: key,
      title: 'Photo not clear',
      message: message ??
          'Hold the camera steady and make sure all 4 corners of the document are visible. Try again in good light.',
      icon: Icons.no_photography_outlined,
      onRetry: onRetry,
      retryLabel: 'Retake photo',
    );
  }

  /// Failed wallet top-up. The retry button here is *not* the same as the
  /// original "Pay" button — it's a "Check status" action that re-polls
  /// the backend, since most top-up failures are "payment received but not
  /// yet reflected" (not a real failure).
  factory ErrorState.topup({
    Key? key,
    String? message,
    VoidCallback? onRetry,
  }) {
    return ErrorState(
      key: key,
      title: 'Payment not received yet',
      message: message ??
          'Don\'t worry — if you completed the UPI payment, we\'ll auto-refresh in 30 seconds. You can also check the status now.',
      icon: Icons.account_balance_wallet_outlined,
      onRetry: onRetry,
      retryLabel: 'Check status',
    );
  }

  /// Generic form-level error (e.g. server returned a validation message
  /// that isn't tied to a single field). Use this instead of an AlertDialog.
  factory ErrorState.form({
    Key? key,
    required String title,
    String? message,
    VoidCallback? onRetry,
  }) {
    return ErrorState(
      key: key,
      title: title,
      message: message,
      icon: Icons.report_gmailerrorred_rounded,
      onRetry: onRetry,
      retryLabel: 'Got it',
    );
  }

  /// "Empty result" state (no tickets match the filter, no FAQs match the
  /// search, etc). Distinct from the illustrated empty state because the
  /// action is "refresh" / "widen the filter" rather than a primary nav CTA.
  factory ErrorState.empty({
    Key? key,
    String title = 'No results found',
    String? message,
    VoidCallback? onRetry,
  }) {
    return ErrorState(
      key: key,
      title: title,
      message: message,
      icon: Icons.inbox_outlined,
      onRetry: onRetry,
      retryLabel: 'Refresh',
    );
  }

  /// Last-resort generic error. The message should never include a raw
  /// exception (`$e`); that violates the team's UX rules.
  factory ErrorState.generic({
    Key? key,
    String? message,
    VoidCallback? onRetry,
  }) {
    return ErrorState(
      key: key,
      title: 'Something went wrong',
      message:
          message ?? 'We hit a snag on our end. Please try again in a moment.',
      onRetry: onRetry,
      retryLabel: 'Try again',
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Build
  // ──────────────────────────────────────────────────────────────────────────

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
                color: iconBackground ?? colors.errorSurface,
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: iconSize,
                color: iconColor ?? AppColors.error,
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
