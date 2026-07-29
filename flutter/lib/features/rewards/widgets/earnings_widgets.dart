import 'package:flutter/material.dart';
import 'package:voltium_rider/models/earnings_entry_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/date_helpers.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// Week selector with prev/next navigation
class WeekSelector extends StatelessWidget {
  final DateTime weekStart;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;

  const WeekSelector({
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadowSoft,
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
              decoration: const BoxDecoration(
                color: AppColors.iconBackground,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.chevron_left,
                size: 20,
                color: AppColors.slate800,
              ),
            ),
          ),
          Column(
            children: [
              Text(
                'WEEKLY EARNINGS',
                style: AppTypography.microBadge
                    .copyWith(color: AppColors.slate500, letterSpacing: 1.5),
              ),
              SizedBox(height: 2),
              Text(
                _getWeekRange(),
                style: AppTypography.bodyMediumEmphasis
                    .copyWith(color: AppColors.slate800),
              ),
            ],
          ),
          InkWell(
            onTap: onNext,
            child: Container(
              padding: Spacing.paddingSm,
              decoration: const BoxDecoration(
                color: AppColors.iconBackground,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.chevron_right,
                size: 20,
                color: AppColors.slate800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Weekly total earnings card
class TotalCard extends StatelessWidget {
  final double total;
  final int trips;
  final double hours;

  const TotalCard({
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
          colors: [AppColors.primary, AppColors.primaryGradientEnd],
        ),
        borderRadius: BorderRadius.circular(AppRadius.xl),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadowPrimaryStrong,
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
                style: AppTypography.microOverline.copyWith(
                  color: AppColors.white70,
                  letterSpacing: 1.5,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(51),
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.trending_up,
                      color: AppColors.successBright,
                      size: 14,
                    ),
                    SizedBox(width: 4),
                    Text(
                      '+12%',
                      style: AppTypography.microLabel
                          .copyWith(color: AppColors.successBright),
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
                    color: Colors.white.withAlpha(38),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'TRIPS',
                        style: AppTypography.microBadge.copyWith(
                          color: AppColors.white70,
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
                    color: Colors.white.withAlpha(38),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'HOURS',
                        style: AppTypography.microBadge.copyWith(
                          color: AppColors.white70,
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

/// Day card showing earnings for a single day
class DayCard extends StatelessWidget {
  final DateTime date;
  final double amount;
  final int trips;
  final double hours;
  final Set<GigPlatform> platforms;
  final bool hasEntries;
  final VoidCallback? onAddEntry;

  const DayCard({
    super.key,
    required this.date,
    required this.amount,
    required this.trips,
    required this.hours,
    required this.platforms,
    required this.hasEntries,
    this.onAddEntry,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: hasEntries ? null : Border.all(color: AppColors.outlineVariant),
        boxShadow: hasEntries
            ? const [
                BoxShadow(
                  color: AppColors.shadowSoft,
                  blurRadius: 48,
                  offset: Offset(0, 24),
                ),
              ]
            : null,
      ),
      child: hasEntries ? _buildEntryCard() : _buildEmptyCard(),
    );
  }

  Widget _buildEntryCard() {
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
                    style: AppTypography.microOverline.copyWith(
                        color: AppColors.slate500, letterSpacing: 1.5),
                  ),
                  SizedBox(height: 2),
                  Text(
                    DateHelpers.formatFullDate(date),
                    style: AppTypography.bodyMediumEmphasis
                        .copyWith(color: AppColors.slate800),
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
                          color: EarningEntry.platformColor(p).withAlpha(25),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          EarningEntry.platformLabel(p),
                          style: AppTypography.microBadge.copyWith(
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
              _buildStat(Icons.directions_bike, '$trips trips'),
              const SizedBox(width: 16),
              _buildStat(Icons.schedule, '${hours.toStringAsFixed(1)}h online'),
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
                        style: AppTypography.microLabel
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

  Widget _buildEmptyCard() {
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
                style: AppTypography.microOverline
                    .copyWith(color: AppColors.slate400, letterSpacing: 1.5),
              ),
              SizedBox(height: 2),
              Text(
                DateHelpers.formatFullDate(date),
                style: AppTypography.bodyMediumEmphasis
                    .copyWith(color: AppColors.slate400),
              ),
            ],
          ),
          InkWell(
            onTap: onAddEntry,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.iconBackground,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.add, size: 14, color: AppColors.slate500),
                  SizedBox(width: 4),
                  Text(
                    'Add Entry',
                    style: AppTypography.microLabel
                        .copyWith(color: AppColors.slate500),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStat(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppColors.slate500),
        SizedBox(width: 4),
        Text(
          text,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 12,
            color: AppColors.slate500,
          ),
        ),
      ],
    );
  }
}

/// Weekly summary card
class SummaryCard extends StatelessWidget {
  final double total;
  final int trips;
  final double avgPerDay;
  final DateTime bestDate;
  final double bestAmount;

  const SummaryCard({
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
        borderRadius: BorderRadius.circular(AppRadius.xl),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadowSuccessStrong,
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
            style: AppTypography.microOverline
                .copyWith(color: Colors.white, letterSpacing: 1.5),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildStat(
                  'Total Earnings',
                  '\u20B9${total.toStringAsFixed(0)}',
                ),
              ),
              Expanded(
                child: _buildStat('Total Trips', '$trips'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildStat(
                  'Avg/Day',
                  '\u20B9${avgPerDay.toStringAsFixed(0)}',
                ),
              ),
              Expanded(
                child: _buildStat(
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
              color: Colors.white.withAlpha(38),
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

  Widget _buildStat(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTypography.microBadge.copyWith(
            color: Colors.white.withAlpha(179),
            letterSpacing: 0.8,
          ),
        ),
        SizedBox(height: 4),
        Text(
          value,
          style: AppTypography.bodyMediumEmphasis.copyWith(color: Colors.white),
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

/// Empty state for no earnings
class EarningsEmptyState extends StatelessWidget {
  const EarningsEmptyState({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            height: 80,
            width: 80,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppRadius.xl),
              boxShadow: [
                BoxShadow(color: Colors.black.withAlpha(10), blurRadius: 20),
              ],
            ),
            child: const Icon(
              Icons.currency_rupee,
              size: 40,
              color: AppColors.primary,
            ),
          ),
          SizedBox(height: 24),
          Text(
            'No earnings logged yet',
            style:
                AppTypography.titleMedium.copyWith(color: AppColors.slate800),
          ),
          SizedBox(height: 8),
          Text(
            'Tap "Add Entry" to start tracking your gig earnings',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 14, color: AppColors.slate500),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
