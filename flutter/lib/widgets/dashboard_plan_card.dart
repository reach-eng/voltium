import 'package:flutter/material.dart';
import '../utils/date_helpers.dart';
import '../theme/app_theme.dart';
import 'premium_cards.dart';
import 'package:voltium_rider/theme/app_typography.dart';

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
    return PremiumDoubleBezelCard(
        padding: EdgeInsets.zero,
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.primary, AppColors.primaryDark],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(28),
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
                      'CURRENT SUBSCRIPTION',
                      style: AppTypography.labelMedium
                          .copyWith(color: Colors.white70, letterSpacing: 1.0),
                    ),
                    Icon(Icons.auto_graph, color: Colors.white, size: 24),
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
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    (currentPlan?.isNotEmpty ?? false)
                        ? currentPlan!.toUpperCase()
                        : 'NO PLAN',
                    style: AppTypography.bodySmallTracked
                        .copyWith(color: Colors.white, letterSpacing: 1.2),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              Text(
                compact
                    ? (currentPlan?.replaceAll('_', ' ').toLowerCase() ??
                            'no plan')
                        .split(' ')
                        .map((s) => s[0].toUpperCase() + s.substring(1))
                        .join(' ')
                    : (currentPlan?.replaceAll('_', ' ').toUpperCase() ??
                        'WEEKLY PAYMENT'),
                style: AppTypography.headingSmall
                    .copyWith(color: Colors.white, letterSpacing: 0.5),
              ),
              SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'TIME REMAINING',
                            style: AppTypography.labelMedium.copyWith(
                                color: AppColors.primaryLightBlue,
                                letterSpacing: 1),
                          ),
                          SizedBox(height: 4),
                          Text(
                            DateHelpers.computeTimeRemaining(planEndDate),
                            style: AppTypography.headingSmall
                                .copyWith(color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'NEXT RECHARGE',
                            style: AppTypography.labelMedium.copyWith(
                                color: AppColors.primaryLightBlue,
                                letterSpacing: 1),
                          ),
                          SizedBox(height: 4),
                          Text(
                            DateHelpers.computeNextRecharge(planEndDate),
                            style: AppTypography.headingSmall
                                .copyWith(color: Colors.white),
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
}
