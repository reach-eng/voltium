// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rider_metrics.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RiderMetrics _$RiderMetricsFromJson(Map<String, dynamic> json) => RiderMetrics(
  weeklyDistance: (json['weeklyDistance'] as num?)?.toDouble() ?? 0.0,
  carbonSaved: (json['carbonSaved'] as num?)?.toDouble() ?? 0.0,
  currentSpeed: (json['currentSpeed'] as num?)?.toDouble() ?? 0.0,
  batteryPercent: (json['batteryPercent'] as num?)?.toDouble() ?? 0.0,
  accountStatus: json['accountStatus'] as String? ?? 'PRE_ACTIVE',
  lifecycleStatus: json['lifecycleStatus'] as String? ?? 'NEW',
);

Map<String, dynamic> _$RiderMetricsToJson(RiderMetrics instance) =>
    <String, dynamic>{
      'weeklyDistance': instance.weeklyDistance,
      'carbonSaved': instance.carbonSaved,
      'currentSpeed': instance.currentSpeed,
      'batteryPercent': instance.batteryPercent,
      'accountStatus': instance.accountStatus,
      'lifecycleStatus': instance.lifecycleStatus,
    };
