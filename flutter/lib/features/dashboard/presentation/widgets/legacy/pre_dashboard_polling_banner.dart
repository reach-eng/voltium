import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// Banner shown when the rider provider's onboarding/post-pickup
/// polling has reached the max-poll limit (~8 minutes) without a
/// server-side state change. The user can tap "Refresh" to retry.
///
/// Pure presentational widget — the parent owns the polling state
/// and provides the refresh callback.
class PreDashboardPollingBanner extends StatelessWidget {
  /// Called when the user taps "Refresh".
  final VoidCallback onRefresh;

  const PreDashboardPollingBanner({super.key, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.warningSurface,
      child: SafeArea(
        bottom: false,
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 12, 12),
          child: Row(
            children: [
              const Icon(
                Icons.hourglass_top_rounded,
                color: AppColors.warningForeground,
                size: 22,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Status taking longer than expected. Pull down to refresh.',
                  style: AppTypography.bodyMedium.copyWith(
                    color: AppColors.of(context).onSurface,
                  ),
                ),
              ),
              TextButton(
                key: const Key('preDashboardPollingTimeoutRefresh'),
                onPressed: onRefresh,
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.of(context).onSurface,
                  textStyle: AppTypography.titleSmall,
                ),
                child: const Text('Refresh'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
