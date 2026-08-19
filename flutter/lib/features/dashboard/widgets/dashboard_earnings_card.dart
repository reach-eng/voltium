import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/widgets/premium_cards.dart';

/// Hero card for Rider Dashboard displaying today's earnings, weekly trend sparkline,
/// and earning streak badge.
class DashboardEarningsCard extends StatelessWidget {
  final double todayEarnings;
  final List<double> weeklyEarnings;
  final int streakDays;
  final VoidCallback? onTap;

  const DashboardEarningsCard({
    super.key,
    required this.todayEarnings,
    this.weeklyEarnings = const [],
    this.streakDays = 0,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final hasWeeklyData = weeklyEarnings.isNotEmpty;
    final maxEarning =
        hasWeeklyData ? (weeklyEarnings.reduce((a, b) => a > b ? a : b)) : 1.0;
    final normalizedMax = maxEarning > 0 ? maxEarning : 1.0;

    return Semantics(
      label: "Today's Earnings: ₹${todayEarnings.toStringAsFixed(0)}",
      button: true,
      child: GestureDetector(
        onTap: onTap,
        child: PremiumDoubleBezelCard(
          padding: EdgeInsets.zero,
          child: Container(
            padding: Spacing.paddingLg,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.slate900, AppColors.of(context).onSurface],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(AppRadius.lg),
              boxShadow: AppShadows.card,
              border: Border.all(
                color: AppColors.success.withValues(alpha: 0.3),
                width: 1.5,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Header Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(Spacing.xs),
                          decoration: BoxDecoration(
                            color: AppColors.success.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(AppRadius.sm),
                          ),
                          child: const Icon(
                            Icons.trending_up_rounded,
                            color: AppColors.success,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: Spacing.sm),
                        Text(
                          "TODAY'S EARNINGS",
                          style: AppTypography.labelSmall.copyWith(
                            color: AppColors.slate400,
                            letterSpacing: 1.2,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    if (streakDays > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: Spacing.sm,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.warning.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(AppRadius.full),
                          border: Border.all(
                            color: AppColors.warning,
                            width: 1,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.local_fire_department_rounded,
                              color: AppColors.warning,
                              size: 14,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '$streakDays Day Streak',
                              style: AppTypography.labelSmall.copyWith(
                                color: AppColors.warning,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),

                const SizedBox(height: Spacing.md),

                // Amount & Sparkline Row
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Amount Counter Display
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '₹${todayEarnings.toStringAsFixed(0)}',
                          style: AppTypography.headingLarge.copyWith(
                            color: Colors.white,
                            fontSize: 32,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(
                              Icons.arrow_forward_ios_rounded,
                              color: AppColors.success,
                              size: 12,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'View earnings breakdown',
                              style: AppTypography.bodySmall.copyWith(
                                color: AppColors.slate400,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),

                    // 7-day Mini Sparkline Bar Chart
                    if (hasWeeklyData)
                      SizedBox(
                        height: 40,
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: weeklyEarnings.take(7).map((val) {
                            final heightPct =
                                (val / normalizedMax).clamp(0.15, 1.0);
                            final isToday = val == todayEarnings;
                            return Container(
                              margin:
                                  const EdgeInsets.symmetric(horizontal: 2.5),
                              width: 6,
                              height: 40 * heightPct,
                              decoration: BoxDecoration(
                                color: isToday
                                    ? AppColors.success
                                    : AppColors.slate600,
                                borderRadius:
                                    BorderRadius.circular(AppRadius.xs),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
