// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rider_wallet.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RiderWallet _$RiderWalletFromJson(Map<String, dynamic> json) => RiderWallet(
  walletBalance: (json['walletBalance'] as num?)?.toDouble() ?? 0.0,
  paymentStreak: (json['paymentStreak'] as num?)?.toInt() ?? 0,
  planStatus: json['planStatus'] as String? ?? 'NONE',
  currentPlan: json['currentPlan'] as String?,
  planStartDate: json['planStartDate'] == null
      ? null
      : DateTime.parse(json['planStartDate'] as String),
  planEndDate: json['planEndDate'] == null
      ? null
      : DateTime.parse(json['planEndDate'] as String),
);

Map<String, dynamic> _$RiderWalletToJson(RiderWallet instance) =>
    <String, dynamic>{
      'walletBalance': instance.walletBalance,
      'paymentStreak': instance.paymentStreak,
      'planStatus': instance.planStatus,
      'currentPlan': instance.currentPlan,
      'planStartDate': instance.planStartDate?.toIso8601String(),
      'planEndDate': instance.planEndDate?.toIso8601String(),
    };
