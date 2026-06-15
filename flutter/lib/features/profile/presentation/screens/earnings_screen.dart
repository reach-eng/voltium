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
import '../widgets/earnings_widgets.dart';

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
    final weekHours = _getWeekHours();
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
                                child: WeekSelectorBar(
                                  weekStart: _weekStart,
                                  onPrev: () => setState(() =>
                                      _weekStart = _weekStart.subtract(const Duration(days: 7))),
                                  onNext: _weekStart.add(const Duration(days: 7)).isAfter(DateTime.now())
                                      ? null
                                      : () => setState(() =>
                                          _weekStart = _weekStart.add(const Duration(days: 7))),
                                ),
                              ),
                              const SizedBox(height: 16),
                              FadeUpWidget(
                                delay: 100,
                                child: TotalEarningsCard(
                                  total: weekTotal,
                                  trips: weekTrips,
                                  hours: weekHours,
                                ),
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
                                  child: DayEarningsCard(
                                    day: day,
                                    onAddEntry: () => _showAddEntrySheet(
                                        defaultDate: day['date'] as DateTime),
                                  ),
                                );
                              }),
                              if (dailyEarnings
                                  .any((d) => d['hasEntries'] as bool)) ...[
                                const SizedBox(height: 16),
                                FadeUpWidget(
                                  delay: 700,
                                  child: WeeklySummaryCard(
                                    total: weekTotal,
                                    trips: weekTrips,
                                    avgPerDay: avgPerDay,
                                    bestDate: bestDay['date'] as DateTime,
                                    bestAmount: bestDay['amount'] as double,
                                  ),
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

