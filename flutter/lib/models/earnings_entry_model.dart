import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

enum GigPlatform { zomato, swiggy, zepto, blinkit, other }

class EarningEntry {
  final String id;
  final DateTime date;
  final GigPlatform platform;
  final double amount;
  final int trips;
  final double hours;
  final String? notes;

  /// AUDIT FIX (2026-08-22, HIGH RACE): explicit sync-state marker.
  ///
  /// The old scheme inferred sync state from the `srv-` id prefix, which
  /// misclassified server-loaded entries (raw UUIDs, no prefix) as pending
  /// and re-POSTed them as duplicates on every cold start. Server-loaded
  /// entries are constructed with `isSynced: true`; only entries explicitly
  /// marked unsynced are replayed by the pending-sync pass. Legacy entries
  /// persisted under the old millis-timestamp id scheme default to unsynced
  /// and are marked after their one replay (idempotent thanks to marking).
  final bool isSynced;

  EarningEntry({
    required this.id,
    required this.date,
    required this.platform,
    required this.amount,
    required this.trips,
    required this.hours,
    this.notes,
    this.isSynced = false,
  });

  EarningEntry copyWith({
    String? id,
    DateTime? date,
    GigPlatform? platform,
    double? amount,
    int? trips,
    double? hours,
    String? notes,
    bool? isSynced,
  }) =>
      EarningEntry(
        id: id ?? this.id,
        date: date ?? this.date,
        platform: platform ?? this.platform,
        amount: amount ?? this.amount,
        trips: trips ?? this.trips,
        hours: hours ?? this.hours,
        notes: notes ?? this.notes,
        isSynced: isSynced ?? this.isSynced,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'date': date.toIso8601String(),
        'platform': platform.name,
        'amount': amount,
        'trips': trips,
        'hours': hours,
        'notes': notes,
        'isSynced': isSynced,
      };

  factory EarningEntry.fromJson(Map<String, dynamic> json) => EarningEntry(
        id: json['id'] as String,
        // AUDIT FIX (2026-08-22): normalize to local time so Z-suffixed UTC
        // dates bucket into the correct local day/week.
        date: DateTime.parse(json['date'] as String).toLocal(),
        platform: GigPlatform.values.firstWhere(
          (e) => e.name == json['platform'],
          orElse: () => GigPlatform.other,
        ),
        amount: (json['amount'] as num).toDouble(),
        trips: json['trips'] as int,
        hours: (json['hours'] as num).toDouble(),
        notes: json['notes'] as String?,
        // Backward compat: legacy entries only carried the `srv-` prefix
        // marker; treat prefixed ids as already synced, everything else
        // (incl. old millis ids) as pending-once.
        isSynced: json['isSynced'] as bool? ??
            (json['id'] as String? ?? '').startsWith('srv-'),
      );

  static String platformLabel(GigPlatform p) {
    switch (p) {
      case GigPlatform.zomato:
        return 'Zomato';
      case GigPlatform.swiggy:
        return 'Swiggy';
      case GigPlatform.zepto:
        return 'Zepto';
      case GigPlatform.blinkit:
        return 'Blinkit';
      case GigPlatform.other:
        return 'Other';
    }
  }

  static Color platformColor(GigPlatform p) {
    switch (p) {
      case GigPlatform.zomato:
        return AppColors.error;
      case GigPlatform.swiggy:
        return AppColors.warning;
      case GigPlatform.zepto:
        return AppColors.successDark;
      case GigPlatform.blinkit:
        return AppColors.warning;
      case GigPlatform.other:
        return AppColors.slate500;
    }
  }
}
