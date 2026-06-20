import 'package:flutter/material.dart';
import 'package:voltium_rider/models/earnings_entry_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/date_helpers.dart';

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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A0F172A),
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
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: AppColors.iconBackground,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.chevron_left,
                  size: 20, color: Color(0xFF1E293B),),
            ),
          ),
          Column(
            children: [
              const Text('WEEKLY EARNINGS',
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  color: AppColors.slate500,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                _getWeekRange(),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1E293B),
                ),
              ),
            ],
          ),
          InkWell(
            onTap: onNext,
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: AppColors.iconBackground,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.chevron_right,
                size: 20,
                color: onNext != null
                    ? const Color(0xFF1E293B)
                    : const Color(0xFFCBD5E1),
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
          colors: [AppColors.primary, AppColors.primaryGradientEnd],
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: const [
          BoxShadow(
            color: Color(0x260053C1),
            blurRadius: 48,
            offset: Offset(0, 24),
          ),
        ],
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('THIS WEEK',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  color: Colors.white.withValues(alpha: 0.7),
                  letterSpacing: 1.5,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.trending_up, color: Color(0xFF4ADE80), size: 14),
                    SizedBox(width: 4),
                    Text(
                      '+12%',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF4ADE80),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const Text(
                '\u20B9',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w300,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                total.toStringAsFixed(0),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 40,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -1,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('TRIPS',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          color: Colors.white.withValues(alpha: 0.7),
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$trips',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('HOURS',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          color: Colors.white.withValues(alpha: 0.7),
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${hours.toStringAsFixed(1)}h',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
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

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: hasEntries ? null : Border.all(color: AppColors.outlineVariant),
        boxShadow: hasEntries
            ? const [
                BoxShadow(
                  color: Color(0x0A0F172A),
                  blurRadius: 48,
                  offset: Offset(0, 24),
                ),
              ]
            : null,
      ),
      child: hasEntries
          ? _buildEntryCard(date, amount, trips, hours, platforms)
          : _buildEmptyCard(date),
    );
  }

  Widget _buildEntryCard(DateTime date, double amount, int trips, double hours,
      Set<GigPlatform> platforms,) {
    return Padding(
      padding: const EdgeInsets.all(16),
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
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: AppColors.slate500,
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    DateHelpers.formatFullDate(date),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  ...platforms.map((p) => Padding(
                        padding: const EdgeInsets.only(right: 4),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2,),
                          decoration: BoxDecoration(
                            color: EarningEntry.platformColor(p)
                                .withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            EarningEntry.platformLabel(p),
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: EarningEntry.platformColor(p),
                            ),
                          ),
                        ),
                      ),),
                  const SizedBox(width: 8),
                  Text(
                    '\u20B9${amount.toStringAsFixed(0)}',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF16A34A),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _buildDayStat(Icons.directions_bike, '$trips trips'),
              const SizedBox(width: 16),
              _buildDayStat(
                  Icons.schedule, '${hours.toStringAsFixed(1)}h online',),
              const Spacer(),
              InkWell(
                onTap: onAddEntry,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.add, size: 14, color: AppColors.primary),
                      SizedBox(width: 4),
                      Text('Add',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
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
    );
  }

  Widget _buildEmptyCard(DateTime date) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                DateHelpers.dayName(date),
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  color: AppColors.slate400,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                DateHelpers.formatFullDate(date),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.slate400,
                ),
              ),
            ],
          ),
          InkWell(
            onTap: onAddEntry,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.iconBackground,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.add, size: 14, color: AppColors.slate500),
                  SizedBox(width: 4),
                  Text('Add Entry',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: AppColors.slate500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDayStat(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppColors.slate500),
        const SizedBox(width: 4),
        Text(
          text,
          style: const TextStyle(
            fontSize: 12,
            color: AppColors.slate500,
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
        borderRadius: BorderRadius.circular(24),
        boxShadow: const [
          BoxShadow(
            color: Color(0x2610B981),
            blurRadius: 48,
            offset: Offset(0, 24),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('WEEKLY SUMMARY',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: Colors.white,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildSummaryStat(
                    'Total Earnings', '\u20B9${total.toStringAsFixed(0)}',),
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
                    'Avg/Day', '\u20B9${avgPerDay.toStringAsFixed(0)}',),
              ),
              Expanded(
                child: _buildSummaryStat('Best Day',
                    '${DateHelpers.dayName(bestDate)} (\u20B9${bestAmount.toStringAsFixed(0)})',),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(Icons.lightbulb, color: Colors.white, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'You earned \u20B9${total.toStringAsFixed(0)} this week. ${bestAmount > 0 ? 'Your best day was ${DateHelpers.dayName(bestDate)} with \u20B9${bestAmount.toStringAsFixed(0)}!' : 'Start logging to see insights!'}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.white,
                      fontWeight: FontWeight.w500,
                    ),
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
          style: TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w600,
            color: Colors.white.withValues(alpha: 0.7),
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}
