import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

import 'package:voltium_rider/utils/date_helpers.dart';

import 'package:voltium_rider/services/api_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/models/earnings_entry_model.dart';
import 'package:voltium_rider/widgets/earnings_chart.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'package:voltium_rider/widgets/earnings_widgets.dart';
import 'package:voltium_rider/widgets/earnings_add_sheet.dart';

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  DateTime _weekStart = DateHelpers.getMondayOfWeek(DateTime.now());
  List<EarningEntry> _entries = [];
  bool _isLoading = true;

  static const String _storageKey = 'earnings_entries';

  @override
  void initState() {
    super.initState();
    _loadEntries();
  }

  Future<void> _loadEntries() async {
    setState(() => _isLoading = true);
    try {
      final response = await ApiService().fetchEarnings();
      if (response['success'] == true) {
        final data = response['data'] as Map<String, dynamic>?;
        if (data != null) {
          final earningsList = data['earnings'] as List<dynamic>? ?? [];
          _entries = earningsList.map((e) {
            final json = e as Map<String, dynamic>;
            return EarningEntry(
              id: json['id'] as String? ?? '',
              date: json['date'] != null
                  ? DateTime.parse(json['date'] as String)
                  : DateTime.now(),
              platform: GigPlatform.values.firstWhere(
                (p) =>
                    p.name == (json['platform'] as String? ?? '').toLowerCase(),
                orElse: () => GigPlatform.other,
              ),
              amount: (json['amount'] as num?)?.toDouble() ?? 0,
              trips: json['trips'] as int? ?? 0,
              hours: (json['hoursOnline'] as num?)?.toDouble() ?? 0,
              notes: json['notes'] as String?,
            );
          }).toList();
          if (mounted) setState(() => _isLoading = false);
          return;
        }
      }
    } catch (_) {
      // Fall through to SharedPreferences fallback
    }
    // Fallback: load from local storage
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey);
      if (raw != null) {
        final List<dynamic> decoded = jsonDecode(raw);
        _entries = decoded
            .map((e) => EarningEntry.fromJson(e as Map<String, dynamic>))
            .toList();
      }
    } catch (_) {}
    if (mounted) setState(() => _isLoading = false);
  }

  Future<void> _saveEntries() async {
    final prefs = await SharedPreferences.getInstance();
    final encoded = jsonEncode(_entries.map((e) => e.toJson()).toList());
    await prefs.setString(_storageKey, encoded);
  }

  List<EarningEntry> _getWeekEntries() {
    final weekEnd = _weekStart.add(const Duration(days: 7));
    return _entries
        .where((e) =>
            e.date.isAtSameMomentAs(_weekStart) ||
            (e.date.isAfter(_weekStart) && e.date.isBefore(weekEnd)))
        .toList();
  }

  List<Map<String, dynamic>> _getDailyEarnings() {
    final weekEntries = _getWeekEntries();
    final days = <Map<String, dynamic>>[];
    for (int i = 0; i < 7; i++) {
      final day = _weekStart.add(Duration(days: i));
      final dayEntries = weekEntries
          .where((e) =>
              e.date.year == day.year &&
              e.date.month == day.month &&
              e.date.day == day.day)
          .toList();
      final totalAmount =
          dayEntries.fold<double>(0, (sum, e) => sum + e.amount);
      final totalTrips = dayEntries.fold<int>(0, (sum, e) => sum + e.trips);
      final totalHours = dayEntries.fold<double>(0, (sum, e) => sum + e.hours);
      final platforms = dayEntries.map((e) => e.platform).toSet();

      days.add({
        'date': day,
        'amount': totalAmount,
        'trips': totalTrips,
        'hours': totalHours,
        'platforms': platforms,
        'hasEntries': dayEntries.isNotEmpty,
      });
    }
    return days;
  }

  double _getWeekTotal() {
    return _getWeekEntries().fold<double>(0, (sum, e) => sum + e.amount);
  }

  int _getWeekTrips() {
    return _getWeekEntries().fold<int>(0, (sum, e) => sum + e.trips);
  }

  double _getWeekHours() {
    return _getWeekEntries().fold<double>(0, (sum, e) => sum + e.hours);
  }

  String _getWeekRange() {
    final end = _weekStart.add(const Duration(days: 6));
    return '${DateHelpers.formatShortDate(_weekStart)} - ${DateHelpers.formatShortDate(end)}';
  }

  Future<void> _showAddEntrySheet({DateTime? defaultDate}) async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => AddEarningSheet(
        defaultDate: defaultDate ?? DateTime.now(),
      ),
    );

    if (result != null && mounted) {
      final entry = EarningEntry(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        date: result['date'] as DateTime,
        platform: result['platform'] as GigPlatform,
        amount: (result['amount'] as num).toDouble(),
        trips: result['trips'] as int,
        hours: (result['hours'] as num).toDouble(),
        notes: result['notes'] as String?,
      );
      setState(() => _entries.add(entry));
      await _saveEntries();

      if (mounted &&
          (entry.date.isBefore(_weekStart) ||
              entry.date.isAfter(_weekStart.add(const Duration(days: 6))))) {
        setState(() {
          _weekStart = DateHelpers.getMondayOfWeek(entry.date);
        });
      }
    }
  }

  void _deleteEntry(String id) async {
    setState(() => _entries.removeWhere((e) => e.id == id));
    await _saveEntries();
  }

  @override
  Widget build(BuildContext context) {
    final weekTotal = _getWeekTotal();
    final weekTrips = _getWeekTrips();
    final dailyEarnings = _getDailyEarnings();
    final bestDay = dailyEarnings.reduce(
        (a, b) => (a['amount'] as double) > (b['amount'] as double) ? a : b);
    final avgPerDay =
        dailyEarnings.where((d) => d['hasEntries'] as bool).isEmpty
            ? 0.0
            : weekTotal /
                dailyEarnings.where((d) => d['hasEntries'] as bool).length;

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      body: Stack(
        children: [
          _buildBackground(),
          SafeArea(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : Column(
                    children: [
                      _buildHeader(),
                      Expanded(
                        child: RefreshIndicator(
                          color: AppColors.primary,
                          onRefresh: _loadEntries,
                          child: ListView(
                            padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
                            children: [
                              FadeUpWidget(
                                delay: 0,
                                child: _buildWeekSelector(),
                              ),
                              const SizedBox(height: 16),
                              FadeUpWidget(
                                delay: 100,
                                child: _buildTotalCard(weekTotal),
                              ),
                              const SizedBox(height: 16),
                              FadeUpWidget(
                                delay: 200,
                                child: EarningsChart(
                                  dailyEarnings: dailyEarnings,
                                  dayLabels: List.generate(
                                      7,
                                      (i) => DateHelpers.dayName(
                                          _weekStart.add(Duration(days: i)))),
                                ),
                              ),
                              const SizedBox(height: 16),
                              ...dailyEarnings.asMap().entries.map((entry) {
                                final index = entry.key;
                                final day = entry.value;
                                return FadeUpWidget(
                                  delay: 300 + (index * 50),
                                  child: _buildDayCard(day),
                                );
                              }),
                              if (dailyEarnings
                                  .any((d) => d['hasEntries'] as bool)) ...[
                                const SizedBox(height: 16),
                                FadeUpWidget(
                                  delay: 700,
                                  child: _buildSummaryCard(
                                      weekTotal, weekTrips, avgPerDay, bestDay),
                                ),
                              ],
                              if (!dailyEarnings
                                  .any((d) => d['hasEntries'] as bool)) ...[
                                const SizedBox(height: 40),
                                FadeUpWidget(
                                  delay: 300,
                                  child: _buildEmptyState(),
                                ),
                              ],
                              const SizedBox(height: 32),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddEntrySheet(),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text(
          'Add Entry',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  Widget _buildBackground() {
    return Positioned.fill(
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFF1F5F9), Color(0xFFF8FAFC)],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          InkWell(
            onTap: () => Navigator.maybePop(context),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withOpacity(0.05), blurRadius: 10)
                ],
              ),
              child: const Icon(Icons.arrow_back,
                  size: 18, color: Color(0xFF1E293B)),
            ),
          ),
          const SizedBox(width: 16),
          const Text(
            'Earnings Log',
            style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B)),
          ),
        ],
      ),
    );
  }

  Widget _buildWeekSelector() {
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
            onTap: () => setState(() =>
                _weekStart = _weekStart.subtract(const Duration(days: 7))),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.chevron_left,
                  size: 20, color: Color(0xFF1E293B)),
            ),
          ),
          Column(
            children: [
              const Text(
                'WEEKLY EARNINGS',
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF64748B),
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
            onTap: () {
              final next = _weekStart.add(const Duration(days: 7));
              if (!next.isAfter(DateTime.now())) {
                setState(() => _weekStart = next);
              }
            },
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.chevron_right,
                size: 20,
                color: _weekStart
                        .add(const Duration(days: 7))
                        .isAfter(DateTime.now())
                    ? const Color(0xFFCBD5E1)
                    : const Color(0xFF1E293B),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTotalCard(double total) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0053C1), Color(0xFF2F6DDE)],
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
              Text(
                'THIS WEEK',
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
                child: Row(
                  children: [
                    const Icon(Icons.trending_up,
                        color: Color(0xFF4ADE80), size: 14),
                    const SizedBox(width: 4),
                    Text(
                      '+12%',
                      style: const TextStyle(
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
                      Text(
                        'TRIPS',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          color: Colors.white.withValues(alpha: 0.7),
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${_getWeekTrips()}',
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
                      Text(
                        'HOURS',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          color: Colors.white.withValues(alpha: 0.7),
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${_getWeekHours().toStringAsFixed(1)}h',
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

  Widget _buildDayCard(Map<String, dynamic> day) {
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
        border: hasEntries ? null : Border.all(color: const Color(0xFFE2E8F0)),
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
          ? Padding(
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
                              color: Color(0xFF64748B),
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
                                      horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: _platformColor(p)
                                        .withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    _platformLabel(p),
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                      color: _platformColor(p),
                                    ),
                                  ),
                                ),
                              )),
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
                      _buildDayStat(Icons.schedule,
                          '${hours.toStringAsFixed(1)}h online'),
                      const Spacer(),
                      InkWell(
                        onTap: () => _showAddEntrySheet(defaultDate: date),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.add,
                                  size: 14, color: Color(0xFF0053C1)),
                              SizedBox(width: 4),
                              Text(
                                'Add',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF0053C1),
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
            )
          : Padding(
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
                          color: Color(0xFF94A3B8),
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        DateHelpers.formatFullDate(date),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF94A3B8),
                        ),
                      ),
                    ],
                  ),
                  InkWell(
                    onTap: () => _showAddEntrySheet(defaultDate: date),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.add, size: 14, color: Color(0xFF64748B)),
                          SizedBox(width: 4),
                          Text(
                            'Add Entry',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildDayStat(IconData icon, String label) {
    return Row(
      children: [
        Icon(icon, size: 14, color: const Color(0xFF64748B)),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: Color(0xFF64748B),
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryCard(
      double total, int trips, double avgPerDay, Map<String, dynamic> bestDay) {
    final bestDate = bestDay['date'] as DateTime;
    final bestAmount = bestDay['amount'] as double;

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
          const Text(
            'WEEKLY SUMMARY',
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
                    'Total Earnings', '\u20B9${total.toStringAsFixed(0)}'),
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
                    'Avg/Day', '\u20B9${avgPerDay.toStringAsFixed(0)}'),
              ),
              Expanded(
                child: _buildSummaryStat('Best Day',
                    '${DateHelpers.dayName(bestDate)} (\u20B9${bestAmount.toStringAsFixed(0)})'),
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

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            height: 80,
            width: 80,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 20)
              ],
            ),
            child: const Icon(Icons.currency_rupee,
                size: 40, color: Color(0xFF0053C1)),
          ),
          const SizedBox(height: 24),
          const Text(
            'No earnings logged yet',
            style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B)),
          ),
          const SizedBox(height: 8),
          const Text(
            'Tap "Add Entry" to start tracking your gig earnings',
            style: TextStyle(fontSize: 14, color: Color(0xFF64748B)),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

