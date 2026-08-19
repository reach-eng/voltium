import 'package:flutter/foundation.dart';

@immutable
class UpcomingRentPrompt {
  final bool showPrompt;
  final String leaseId;
  final int rentAmountInRupees;
  final int walletBalanceInRupees;
  final int shortfallInRupees;
  final int recommendedTopUpRupees;
  final DateTime dueDate;
  final String dueTimeFormatted;
  final bool requiresTopUp;

  const UpcomingRentPrompt({
    required this.showPrompt,
    required this.leaseId,
    required this.rentAmountInRupees,
    required this.walletBalanceInRupees,
    required this.shortfallInRupees,
    required this.recommendedTopUpRupees,
    required this.dueDate,
    required this.dueTimeFormatted,
    required this.requiresTopUp,
  });

  factory UpcomingRentPrompt.fromJson(Map<String, dynamic> json) {
    return UpcomingRentPrompt(
      showPrompt: json['showPrompt'] as bool? ?? false,
      leaseId: json['leaseId'] as String? ?? '',
      rentAmountInRupees: (json['rentAmountInRupees'] as num?)?.toInt() ?? 0,
      walletBalanceInRupees:
          (json['walletBalanceInRupees'] as num?)?.toInt() ?? 0,
      shortfallInRupees: (json['shortfallInRupees'] as num?)?.toInt() ?? 0,
      recommendedTopUpRupees:
          (json['recommendedTopUpRupees'] as num?)?.toInt() ?? 0,
      dueDate: json['dueDate'] != null
          ? DateTime.tryParse(json['dueDate'] as String) ?? DateTime.now()
          : DateTime.now(),
      dueTimeFormatted: json['dueTimeFormatted'] as String? ?? '',
      requiresTopUp: json['requiresTopUp'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'showPrompt': showPrompt,
      'leaseId': leaseId,
      'rentAmountInRupees': rentAmountInRupees,
      'walletBalanceInRupees': walletBalanceInRupees,
      'shortfallInRupees': shortfallInRupees,
      'recommendedTopUpRupees': recommendedTopUpRupees,
      'dueDate': dueDate.toIso8601String(),
      'dueTimeFormatted': dueTimeFormatted,
      'requiresTopUp': requiresTopUp,
    };
  }
}
