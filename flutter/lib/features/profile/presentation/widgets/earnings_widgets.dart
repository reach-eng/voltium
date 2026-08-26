import 'package:flutter/material.dart';
import 'package:voltium_rider/models/earnings_entry_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/date_helpers.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class WeekSelectorBar extends StatelessWidget {
  final DateTime weekStart;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;

  const WeekSelectorBar({
    super.key,
    required this.weekStart,
    this.onPrev,
    this.onNext,
  });

  String _getWeekRange() {
    final end = weekStart.add(const Duration(days: 6));
    return '${DateHelpers.formatShortDate(weekStart)} - ${DateHelpers.formatShortDate(end)}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadowSoftColor,
            blurRadius: 48,
            offset: Offset(0, 24),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          InkWell(
            onTap: onPrev,
            child: Container(
              padding: Spacing.paddingSm,
              decoration: BoxDecoration(
                color: colors.iconBackground,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.chevron_left,
                size: 20,
                color: colors.onSurface,
              ),
            ),
          ),
          Column(
            children: [
              Text(
                'WEEKLY EARNINGS',
                style: AppTypography.labelSmall.copyWith(fontSize: 9).copyWith(
                    color: colors.onSurfaceVariant, letterSpacing: 1.5),
              ),
              SizedBox(height: 2),
              Text(
                _getWeekRange(),
                style: AppTypography.bodyMedium
                    .copyWith(fontWeight: FontWeight.w600)
                    .copyWith(color: colors.onSurface),
              ),
            ],
          ),
          InkWell(
            onTap: onNext,
            child: Container(
              padding: Spacing.paddingSm,
              decoration: BoxDecoration(
                color: colors.iconBackground,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.chevron_right,
                size: 20,
                color:
                    onNext != null ? colors.onSurface : colors.outlineVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class TotalEarningsCard extends StatelessWidget {
  final double total;
  final int trips;
  final double hours;

  const TotalEarningsCard({
    super.key,
    required this.total,
    required this.trips,
    required this.hours,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primary, AppColors.primaryLight],
        ),
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadowPrimaryStrongColor,
            blurRadius: 48,
            offset: Offset(0, 24),
          ),
        ],
      ),
      padding: Spacing.paddingLg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'THIS WEEK',
                style: AppTypography.overline.copyWith(
                  color: Colors.white.withValues(alpha: 0.7),
                  letterSpacing: 1.5,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Row(
                  children: [
                    Icon(Icons.trending_up, color: AppColors.success, size: 14),
                    SizedBox(width: 4),
                    Text(
                      '+12%',
                      style: AppTypography.labelSmall
                          .copyWith(color: AppColors.success),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '\u20B9',
                style: GoogleFonts.plusJakartaSans(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w300,
                ),
              ),
              SizedBox(width: 4),
              Text(
                total.toStringAsFixed(0),
                style: AppTypography.displayLarge
                    .copyWith(color: Colors.white, letterSpacing: -1),
              ),
            ],
          ),
          SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(Spacing.sm),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'TRIPS',
                        style: AppTypography.labelSmall
                            .copyWith(fontSize: 9)
                            .copyWith(
                              color: Colors.white.withValues(alpha: 0.7),
                              letterSpacing: 0.8,
                            ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        '$trips',
                        style: AppTypography.titleSmall
                            .copyWith(color: Colors.white),
                      ),
                    ],
                  ),
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(Spacing.sm),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'HOURS',
                        style: AppTypography.labelSmall
                            .copyWith(fontSize: 9)
                            .copyWith(
                              color: Colors.white.withValues(alpha: 0.7),
                              letterSpacing: 0.8,
                            ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        '${hours.toStringAsFixed(1)}h',
                        style: AppTypography.titleSmall
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
    );
  }
}

class DayEarningsCard extends StatelessWidget {
  final Map<String, dynamic> day;
  final VoidCallback? onAddEntry;

  const DayEarningsCard({
    super.key,
    required this.day,
    this.onAddEntry,
  });

  @override
  Widget build(BuildContext context) {
    final date = day['date'] as DateTime;
    final amount = day['amount'] as double;
    final trips = day['trips'] as int;
    final hours = day['hours'] as double;
    final platforms = day['platforms'] as Set<GigPlatform>;
    final hasEntries = day['hasEntries'] as bool;
    final colors = AppColors.of(context);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: hasEntries ? null : Border.all(color: colors.outlineVariant),
        boxShadow: hasEntries
            ? const [
                BoxShadow(
                  color: AppColors.shadowSoftColor,
                  blurRadius: 48,
                  offset: Offset(0, 24),
                ),
              ]
            : null,
      ),
      child: hasEntries
          ? _buildEntryCard(context, date, amount, trips, hours, platforms)
          : _buildEmptyCard(context, date),
    );
  }

  Widget _buildEntryCard(
    BuildContext context,
    DateTime date,
    double amount,
    int trips,
    double hours,
    Set<GigPlatform> platforms,
  ) {
    final colors = AppColors.of(context);
    return Padding(
      padding: Spacing.paddingMd,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    DateHelpers.dayName(date),
                    style: AppTypography.overline.copyWith(
                        color: colors.onSurfaceVariant, letterSpacing: 1.5),
                  ),
                  SizedBox(height: 2),
                  Text(
                    DateHelpers.formatFullDate(date),
                    style: AppTypography.bodyMedium
                        .copyWith(fontWeight: FontWeight.w600)
                        .copyWith(color: colors.onSurface),
                  ),
                ],
              ),
              Row(
                children: [
                  ...platforms.map(
                    (p) => Padding(
                      padding: const EdgeInsets.only(right: 4),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: EarningEntry.platformColor(p)
                              .withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          EarningEntry.platformLabel(p),
                          style: AppTypography.labelSmall
                              .copyWith(fontSize: 9)
                              .copyWith(
                                color: EarningEntry.platformColor(p),
                              ),
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: 8),
                  Text(
                    '\u20B9${amount.toStringAsFixed(0)}',
                    style: AppTypography.titleMedium
                        .copyWith(color: AppColors.success),
                  ),
                ],
              ),
            ],
          ),
          SizedBox(height: 12),
          Row(
            children: [
              _buildDayStat(context, Icons.directions_bike, '$trips trips'),
              const SizedBox(width: 16),
              _buildDayStat(
                context,
                Icons.schedule,
                '${hours.toStringAsFixed(1)}h online',
              ),
              const Spacer(),
              InkWell(
                onTap: onAddEntry,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.primarySurface,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.add, size: 14, color: AppColors.primary),
                      SizedBox(width: 4),
                      Text(
                        'Add',
                        style: AppTypography.labelSmall
                            .copyWith(color: AppColors.primary),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyCard(BuildContext context, DateTime date) {
    final colors = AppColors.of(context);
    return Padding(
      padding: Spacing.paddingMd,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                DateHelpers.dayName(date),
                style: AppTypography.overline
                    .copyWith(color: colors.onSurfaceMuted, letterSpacing: 1.5),
              ),
              SizedBox(height: 2),
              Text(
                DateHelpers.formatFullDate(date),
                style: AppTypography.bodyMedium
                    .copyWith(fontWeight: FontWeight.w600)
                    .copyWith(color: colors.onSurfaceMuted),
              ),
            ],
          ),
          InkWell(
            onTap: onAddEntry,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: colors.iconBackground,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.add, size: 14, color: colors.onSurfaceVariant),
                  SizedBox(width: 4),
                  Text(
                    'Add Entry',
                    style: AppTypography.labelSmall
                        .copyWith(color: colors.onSurfaceVariant),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDayStat(BuildContext context, IconData icon, String text) {
    final colors = AppColors.of(context);
    return Row(
      children: [
        Icon(icon, size: 14, color: colors.onSurfaceVariant),
        SizedBox(width: 4),
        Text(
          text,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 12,
            color: colors.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

class WeeklySummaryCard extends StatelessWidget {
  final double total;
  final int trips;
  final double avgPerDay;
  final DateTime bestDate;
  final double bestAmount;

  const WeeklySummaryCard({
    super.key,
    required this.total,
    required this.trips,
    required this.avgPerDay,
    required this.bestDate,
    required this.bestAmount,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: AppGradients.success,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadowSuccessStrongColor,
            blurRadius: 48,
            offset: Offset(0, 24),
          ),
        ],
      ),
      padding: const EdgeInsets.all(Spacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'WEEKLY SUMMARY',
            style: AppTypography.overline
                .copyWith(color: Colors.white, letterSpacing: 1.5),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildSummaryStat(
                  'Total Earnings',
                  '\u20B9${total.toStringAsFixed(0)}',
                ),
              ),
              Expanded(
                child: _buildSummaryStat('Total Trips', '$trips'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildSummaryStat(
                  'Avg/Day',
                  '\u20B9${avgPerDay.toStringAsFixed(0)}',
                ),
              ),
              Expanded(
                child: _buildSummaryStat(
                  'Best Day',
                  '${DateHelpers.dayName(bestDate)} (\u20B9${bestAmount.toStringAsFixed(0)})',
                ),
              ),
            ],
          ),
          SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(Spacing.sm),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Row(
              children: [
                const Icon(Icons.lightbulb, color: Colors.white, size: 18),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'You earned \u20B9${total.toStringAsFixed(0)} this week. ${bestAmount > 0 ? 'Your best day was ${DateHelpers.dayName(bestDate)} with \u20B9${bestAmount.toStringAsFixed(0)}!' : 'Start logging to see insights!'}',
                    style:
                        AppTypography.bodySmall.copyWith(color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryStat(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTypography.labelSmall.copyWith(fontSize: 9).copyWith(
                color: Colors.white.withValues(alpha: 0.7),
                letterSpacing: 0.8,
              ),
        ),
        SizedBox(height: 4),
        Text(
          value,
          style: AppTypography.bodyMedium
              .copyWith(fontWeight: FontWeight.w600)
              .copyWith(color: Colors.white),
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}
