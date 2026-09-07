import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// Banner shown when the rider provider's onboarding/post-pickup polling
/// has reached the max-poll limit (240 ticks ≈ 2h) without a server-side
/// state change. The user can tap "Refresh" to retry.
///
/// HANG-TIGHT-AUDIT P0-3 (2026-09-08): shared between the pre-dashboard
/// wait state and the hangTight wait state. Both screens are the
/// post-submit "we'll notify you" UX — they share the polling lifecycle
/// and need the same recovery affordance. Lifted from
/// `pre_dashboard_polling_banner.dart` (now removed) so the same widget
/// key + behavior is the single source of truth.
///
/// Pure presentational widget — the parent owns the polling state and
/// provides the refresh callback. Callers should pass
/// `riderProvider.startOnboardingPoll()` (NOT just `refreshFromApi()`):
/// the poller has stopped, so a one-shot fetch without restarting it
/// leaves the rider stuck forever; `startOnboardingPoll` resets the
/// counter, clears `isPollingTimedOut`, and restarts the poller.
class WaitStatePollingBanner extends StatelessWidget {
  /// Called when the user taps "Refresh". Pass a callback that both
  /// triggers an immediate fetch AND restarts the polling lifecycle
  /// (see class doc above).
  final VoidCallback onRefresh;

  const WaitStatePollingBanner({super.key, required this.onRefresh});

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
                key: const Key('waitStatePollingTimeoutRefresh'),
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
