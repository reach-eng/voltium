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
  }) {
    return EarningEntry(
      id: id ?? this.id,
      date: date ?? this.date,
      platform: platform ?? this.platform,
      amount: amount ?? this.amount,
      trips: trips ?? this.trips,
      hours: hours ?? this.hours,
      notes: notes ?? this.notes,
      isSynced: isSynced ?? this.isSynced,
    );
  }

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
        date: DateTime.parse(json['date'] as String),
        platform: GigPlatform.values.firstWhere(
          (e) => e.name == json['platform'],
          orElse: () => GigPlatform.other,
        ),
        amount: (json['amount'] as num).toDouble(),
        trips: json['trips'] as int,
        hours: (json['hours'] as num).toDouble(),
        notes: json['notes'] as String?,
        isSynced: json['isSynced'] as bool? ?? false,
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
