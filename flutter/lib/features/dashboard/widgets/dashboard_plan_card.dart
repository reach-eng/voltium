import 'package:flutter/material.dart';
import '../../../utils/date_helpers.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/premium_cards.dart';
import 'package:voltium_rider/theme/app_typography.dart';

import 'package:voltium_rider/gen/app_localizations.dart';

/// Reusable active plan card with blue gradient.
/// Displays subscription name, time remaining, and next recharge date.
class PlanCard extends StatelessWidget {
  final String? currentPlan;
  final DateTime? planEndDate;
  final bool compact;

  const PlanCard({
    super.key,
    required this.currentPlan,
    this.planEndDate,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final noPlanText = l10n?.txtnoPlan ?? 'NO PLAN';

    return PremiumDoubleBezelCard(
        padding: EdgeInsets.zero,
        child: Container(
          padding: Spacing.paddingLg,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.primary, AppColors.primaryDark],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppRadius.radiusModal),
            boxShadow: AppShadows.glass,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!compact) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n?.txtcurrentSubscription ?? 'CURRENT SUBSCRIPTION',
                      style: AppTypography.labelMedium
                          .copyWith(color: Colors.white70, letterSpacing: 1.0),
                    ),
                    const Icon(Icons.auto_graph, color: Colors.white, size: 24),
                  ],
                ),
                const SizedBox(height: 4),
              ],
              if (compact) ...[
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                  ),
                  child: Text(
                    (currentPlan?.isNotEmpty ?? false)
                        ? currentPlan!.toUpperCase()
                        : noPlanText,
                    style: AppTypography.bodySmall
                        .copyWith(
                            fontWeight: FontWeight.w800, letterSpacing: 1.2)
                        .copyWith(color: Colors.white, letterSpacing: 1.2),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              Text(
                compact
                    ? (currentPlan?.replaceAll('_', ' ').toLowerCase() ??
                            noPlanText.toLowerCase())
                        .split(' ')
                        .map((s) => s.isNotEmpty
                            ? s[0].toUpperCase() + s.substring(1)
                            : '')
                        .join(' ')
                    : (currentPlan?.replaceAll('_', ' ').toUpperCase() ??
                        (l10n?.txtweeklyPayment ?? 'WEEKLY PAYMENT')),
                style: AppTypography.headingSmall
                    .copyWith(color: Colors.white, letterSpacing: 0.5),
              ),
              if (planEndDate != null) ...[
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.xs),
                  child: LinearProgressIndicator(
                    value: _computeRemainingRatio(planEndDate),
                    backgroundColor: Colors.white.withValues(alpha: 0.2),
                    valueColor:
                        const AlwaysStoppedAnimation<Color>(Colors.white),
                    minHeight: 4,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n?.txttimeRemaining ?? 'TIME REMAINING',
                            style: AppTypography.labelMedium.copyWith(
                                color: AppColors.primaryLightBlue,
                                letterSpacing: 1),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            DateHelpers.computeTimeRemaining(planEndDate),
                            style: AppTypography.titleMedium.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n?.txtnextRecharge ?? 'NEXT RECHARGE',
                            style: AppTypography.labelMedium.copyWith(
                                color: AppColors.primaryLightBlue,
                                letterSpacing: 1),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            DateHelpers.computeNextRecharge(planEndDate),
                            style: AppTypography.titleMedium.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ));
  }

  double _computeRemainingRatio(DateTime? endDate) {
    if (endDate == null) return 1.0;
    final now = DateTime.now();
    final remainingHours = endDate.difference(now).inHours;
    if (remainingHours <= 0) return 0.05;
    // Assume typical weekly (168h) or monthly window clamped between 0.05 and 1.0
    final ratio = remainingHours / 168.0;
    return ratio.clamp(0.05, 1.0);
  }
}
