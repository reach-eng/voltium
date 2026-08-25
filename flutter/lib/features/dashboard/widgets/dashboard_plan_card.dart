import 'package:flutter/material.dart';
import '../../../utils/date_helpers.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/premium_cards.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

/// Reusable active plan card with blue gradient.
/// Displays subscription name, price, security deposit, time remaining, and next recharge date.
class PlanCard extends StatelessWidget {
  final String? currentPlan;
  final double? currentPlanPrice;
  final double? securityDeposit;
  final bool advanceRentPaid;
  final DateTime? planStartDate;
  final DateTime? planEndDate;
  final bool compact;

  const PlanCard({
    super.key,
    required this.currentPlan,
    this.currentPlanPrice,
    this.securityDeposit,
    this.advanceRentPaid = false,
    this.planStartDate,
    this.planEndDate,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final noPlanText = l10n?.txtnoPlan ?? 'NO PLAN';
    final planName = (currentPlan?.isNotEmpty ?? false)
        ? currentPlan!.replaceAll('_', ' ').toUpperCase()
        : (l10n?.txtweeklyPayment ?? 'WEEKLY PLAN');

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
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Text(
                    l10n?.txtcurrentSubscription ?? 'CURRENT SUBSCRIPTION',
                    style: AppTypography.labelMedium.copyWith(
                      color: Colors.white70,
                      letterSpacing: 1.0,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: AppColors.success,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          'ACTIVE',
                          style: AppTypography.labelSmall.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
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
                      .copyWith(fontWeight: FontWeight.w800, letterSpacing: 1.2)
                      .copyWith(color: Colors.white),
                ),
              ),
              const SizedBox(height: 16),
            ],
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Expanded(
                  child: Text(
                    compact
                        ? (currentPlan?.replaceAll('_', ' ').toLowerCase() ??
                                noPlanText.toLowerCase())
                            .split(' ')
                            .map((s) => s.isNotEmpty
                                ? s[0].toUpperCase() + s.substring(1)
                                : '')
                            .join(' ')
                        : planName,
                    style: AppTypography.headingMedium.copyWith(
                      color: Colors.white,
                      letterSpacing: 0.5,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                if (currentPlanPrice != null && currentPlanPrice! > 0) ...[
                  Text(
                    '₹${currentPlanPrice!.toInt()}',
                    style: AppTypography.headingMedium.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ],
            ),
            if (!compact &&
                ((securityDeposit != null && securityDeposit! > 0) ||
                    advanceRentPaid)) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  if (securityDeposit != null && securityDeposit! > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.shield_outlined,
                              size: 13, color: Colors.white70),
                          const SizedBox(width: 4),
                          Text(
                            'Deposit: ₹${securityDeposit!.toInt()} (Refundable)',
                            style: AppTypography.bodySmall.copyWith(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (advanceRentPaid)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.success.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.check_circle_outline,
                              size: 13, color: Colors.white),
                          const SizedBox(width: 4),
                          Text(
                            'Advance Rent Paid',
                            style: AppTypography.bodySmall.copyWith(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: Spacing.paddingMd,
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
                            letterSpacing: 1,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          DateHelpers.computeTimeRemaining(planEndDate),
                          style: AppTypography.headingSmall.copyWith(
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Container(
                    padding: Spacing.paddingMd,
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
                            letterSpacing: 1,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          DateHelpers.computeNextRecharge(planEndDate),
                          style: AppTypography.headingSmall.copyWith(
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
