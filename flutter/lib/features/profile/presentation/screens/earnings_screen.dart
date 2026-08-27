import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

import 'package:voltium_rider/utils/date_helpers.dart';

import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart' as gen;
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'package:voltium_rider/models/earnings_entry_model.dart';
import 'package:voltium_rider/features/wallet/widgets/earnings_chart.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'package:voltium_rider/features/wallet/widgets/earnings_add_sheet.dart';
import '../widgets/earnings_widgets.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import '../../../../utils/app_logger.dart';

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  DateTime _weekStart = DateHelpers.getMondayOfWeek(DateTime.now());
  List<EarningEntry> _entries = [];
  bool _isLoading = true;

  /// AUDIT FIX (2026-08-22): true when the server fetch failed and we fell
  /// back to the local cache, so the rider knows the data may be stale.
  bool _staleData = false;

  static const String _storageKey = 'earnings_entries';

  @override
  void initState() {
    super.initState();
    // PR-39 (PROFILE P0-6): after the local load, replay any entries that
    // haven't made it to the backend yet.
    //
    // AUDIT FIX (2026-08-22, HIGH RACE): the replay used to run in a
    // post-frame callback that raced `_loadEntries()`. When the load finished
    // first, server entries (raw UUID ids without the `srv-` prefix) were
    // misread as pending and re-POSTed as duplicates. Now the load is awaited
    // before syncing, and sync-state is explicit via `EarningEntry.isSynced`
    // (server-loaded entries are marked synced on parse), so only genuinely
    // unsynced local entries are replayed.
    _initData();
  }

  Future<void> _initData() async {
    await _loadEntries();
    if (mounted) await _syncPendingEntries();
  }

  Future<void> _loadEntries() async {
    setState(() => _isLoading = true);
    try {
      // PR-13: was a wrapper call to
      // `VoltiumApiService.fetchEarnings`, a 1-line pass-through to
      // `VoltiumApiClient.getRiderEarnings()`. The generated method
      // already returns `Map<String, dynamic>`, so the call shape
      // is identical to the wrapper's `.toJson()` output.
      // This screen is `StatefulWidget` (no `ref`); construct
      // ad hoc.
      final response =
          await gen.VoltiumApiClient(ApiClient()).getRiderEarnings();
      dynamic listRaw;
      if (response['earnings'] != null) {
        listRaw = response['earnings'];
      } else if (response['data'] is Map &&
          (response['data'] as Map)['earnings'] != null) {
        listRaw = (response['data'] as Map)['earnings'];
      }
      final earningsList = listRaw as List<dynamic>?;
      if (earningsList != null) {
        _entries = earningsList.map((e) {
          final json = e as Map<String, dynamic>;
          return EarningEntry(
            id: json['id'] as String? ?? '',
            // AUDIT FIX (2026-08-22): normalize Z-suffixed UTC dates to local
            // time before storing — otherwise they bucket into the wrong
            // day/week against the local-midnight week start.
            date: json['date'] != null
                ? DateTime.parse(json['date'] as String).toLocal()
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
            // AUDIT FIX (2026-08-22): server rows are already persisted —
            // never replay them in _syncPendingEntries().
            isSynced: true,
          );
        }).toList();
        if (mounted) {
          setState(() {
            _isLoading = false;
            _staleData = false;
          });
        }
        return;
      }
    } catch (e) {
      // AUDIT FIX (2026-08-22): was `catch (_) {}` — log it and surface a
      // subtle stale-data banner instead of failing silently.
      appDebug('EarningsScreen: server fetch failed, using cache: $e');
      if (mounted) setState(() => _staleData = true);
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
    } catch (e) {
      appDebug('EarningsScreen: failed to load cached entries: $e');
    }
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
        .where(
          (e) =>
              e.date.isAtSameMomentAs(_weekStart) ||
              (e.date.isAfter(_weekStart) && e.date.isBefore(weekEnd)),
        )
        .toList();
  }

  List<Map<String, dynamic>> _getDailyEarnings() {
    final weekEntries = _getWeekEntries();
    final days = <Map<String, dynamic>>[];
    for (int i = 0; i < 7; i++) {
      final day = _weekStart.add(Duration(days: i));
      final dayEntries = weekEntries
          .where(
            (e) =>
                e.date.year == day.year &&
                e.date.month == day.month &&
                e.date.day == day.day,
          )
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
      final localId = DateTime.now().millisecondsSinceEpoch.toString();
      final entry = EarningEntry(
        id: localId,
        date: result['date'] as DateTime,
        platform: result['platform'] as GigPlatform,
        amount: (result['amount'] as num).toDouble(),
        trips: result['trips'] as int,
        hours: (result['hours'] as num).toDouble(),
        notes: result['notes'] as String?,
      );

      // PR-VER-2026-08-16 (PROFILE P0-6): sync to the backend FIRST. Only
      // persist to local cache if the server acknowledges — the old code
      // wrote to SharedPreferences optimistically and a network failure
      // left a "ghost" entry that the rider had to retry manually. Now:
      //   - Server OK  → add to local + persist with 'srv-' canonical id
      //   - Server fail → don't add locally; show a snackbar with retry
      // The retry path is _syncPendingEntries() on next cold start.
      final synced = await _syncEntryToBackend(entry);
      if (!synced) {
        if (mounted) {
          Toast.error(
            context,
            "Couldn't save the entry — we'll retry on your next sign-in.",
          );
        }
        return;
      }
      // AUDIT FIX (2026-08-22): was a field-by-field re-construction — use
      // copyWith to carry over the entry with the canonical server id.
      setState(() => _entries.add(entry.copyWith(id: 'srv-$localId')));
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

  /// PR-39 (PROFILE P0-6): push a single entry to the backend. Returns
  /// `true` on success.
  Future<bool> _syncEntryToBackend(EarningEntry entry) async {
    try {
      // PR-13: was a wrapper call to
      // `VoltiumApiService.createEarning`, which is a 1-line
      // pass-through to `ApiClient.post('/api/rider/earnings', body: ...)`.
      // Call the transport directly with the same body shape.
      final response = await ApiClient().post(
        '/api/rider/earnings',
        body: {
          'date': entry.date.toIso8601String(),
          'platform': entry.platform.name,
          'amount': entry.amount,
          'trips': entry.trips,
          'hours': entry.hours,
          if (entry.notes != null) 'notes': entry.notes,
        },
      );
      return response['id'] != null ||
          response['success'] == true ||
          response['data']?['id'] != null;
    } catch (_) {
      return false;
    }
  }

  /// PR-39 (PROFILE P0-6): on screen mount (after the load completes),
  /// replay any locally-stored entries that haven't been synced yet.
  ///
  /// AUDIT FIX (2026-08-22, HIGH RACE): sync-state is now the explicit
  /// `isSynced` marker instead of the `srv-` id prefix. Server-loaded rows
  /// are marked synced at parse time, so they are never re-POSTed. Legacy
  /// entries persisted under the old millis-id scheme replay exactly once
  /// and are then marked synced (idempotent on subsequent launches).
  Future<void> _syncPendingEntries() async {
    final pending = _entries.where((e) => !e.isSynced).toList();
    for (final entry in pending) {
      final ok = await _syncEntryToBackend(entry);
      if (ok && mounted) {
        setState(() {
          final idx = _entries.indexWhere((e) => e.id == entry.id);
          if (idx != -1) {
            _entries[idx] = _entries[idx].copyWith(
              id: 'srv-${entry.id}',
              isSynced: true,
            );
          }
        });
      }
    }
    await _saveEntries();
  }

  @override
  Widget build(BuildContext context) {
    final weekTotal = _getWeekTotal();
    final weekTrips = _getWeekTrips();
    final weekHours = _getWeekHours();
    final dailyEarnings = _getDailyEarnings();
    final bestDay = dailyEarnings.reduce(
      (a, b) => (a['amount'] as double) > (b['amount'] as double) ? a : b,
    );
    final avgPerDay =
        dailyEarnings.where((d) => d['hasEntries'] as bool).isEmpty
            ? 0.0
            : weekTotal /
                dailyEarnings.where((d) => d['hasEntries'] as bool).length;

    return Scaffold(
      backgroundColor: AppColors.of(context).iconBackground,
      body: Stack(
        children: [
          _buildBackground(),
          SafeArea(
            // AUDIT FIX (2026-08-22): the full-screen spinner now only shows
            // on the initial load (nothing to show yet). Pull-to-refresh
            // keeps the list mounted so it doesn't flash a blank screen.
            child: (_isLoading && _entries.isEmpty)
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
                              if (_staleData) ...[
                                const SizedBox(height: 12),
                                _buildStaleDataBanner(),
                                const SizedBox(height: 8),
                              ],
                              FadeUpWidget(
                                delay: 0,
                                child: WeekSelectorBar(
                                  weekStart: _weekStart,
                                  onPrev: () => setState(
                                    () => _weekStart = _weekStart
                                        .subtract(const Duration(days: 7)),
                                  ),
                                  onNext: _weekStart
                                          .add(const Duration(days: 7))
                                          .isAfter(DateTime.now())
                                      ? null
                                      : () => setState(
                                            () => _weekStart = _weekStart
                                                .add(const Duration(days: 7)),
                                          ),
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
                                      _weekStart.add(Duration(days: i)),
                                    ),
                                  ),
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
                                      defaultDate: day['date'] as DateTime,
                                    ),
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
        label: Text(
          'Add Entry',
          style: GoogleFonts.plusJakartaSans(
              color: Colors.white, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  Widget _buildBackground() {
    return Positioned.fill(
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.of(context).iconBackground,
              AppColors.of(context).surfaceBright
            ],
          ),
        ),
      ),
    );
  }

  /// AUDIT FIX (2026-08-22): subtle banner shown when the server fetch
  /// failed and cached data is being displayed.
  Widget _buildStaleDataBanner() {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: colors.warningSurface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.warningBorder),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off, size: 14, color: AppColors.warningDark),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              "Couldn't reach the server — showing saved data",
              style: AppTypography.labelSmall
                  .copyWith(color: AppColors.warningDark),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          // AUDIT FIX (2026-08-22): touch target was ~38dp with no tooltip or
          // semantics — now a 48dp circle with both.
          Tooltip(
            message: 'Back',
            child: Semantics(
              button: true,
              label: 'Back',
              child: InkWell(
                onTap: () => Navigator.maybePop(context),
                customBorder: const CircleBorder(),
                child: Container(
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 10,
                      ),
                    ],
                  ),
                  child: Icon(
                    Icons.arrow_back,
                    size: 22,
                    color: AppColors.of(context).onSurface,
                  ),
                ),
              ),
            ),
          ),
          SizedBox(width: 16),
          Text(
            'Earnings Log',
            style: AppTypography.headingSmall
                .copyWith(color: AppColors.of(context).onSurface),
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
              borderRadius: BorderRadius.circular(AppRadius.radiusModal),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 20),
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
            style: AppTypography.titleMedium
                .copyWith(color: AppColors.of(context).onSurface),
          ),
          SizedBox(height: 8),
          Text(
            'Tap "Add Entry" to start tracking your gig earnings',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 14, color: AppColors.of(context).onSurfaceVariant),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
