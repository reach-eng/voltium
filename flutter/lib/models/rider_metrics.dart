import 'package:json_annotation/json_annotation.dart';

part 'rider_metrics.g.dart';

/// Rider performance and telemetry metrics.
///
/// Extracted from [RiderModel] — dashboard widgets that show distance,
/// speed, battery, and carbon savings can depend only on this sub-model.
@JsonSerializable()
class RiderMetrics {
  final double weeklyDistance;
  final double carbonSaved;
  final double currentSpeed;
  final double batteryPercent;

  // ── Account status ────────────────────────────────────────────────
  final String accountStatus;
  final String lifecycleStatus;

  const RiderMetrics({
    this.weeklyDistance = 0.0,
    this.carbonSaved = 0.0,
    this.currentSpeed = 0.0,
    this.batteryPercent = 0.0,
    this.accountStatus = 'PRE_ACTIVE',
    this.lifecycleStatus = 'NEW',
  });

  RiderMetrics copyWith({
    double? weeklyDistance,
    double? carbonSaved,
    double? currentSpeed,
    double? batteryPercent,
    String? accountStatus,
    String? lifecycleStatus,
  }) {
    return RiderMetrics(
      weeklyDistance: weeklyDistance ?? this.weeklyDistance,
      carbonSaved: carbonSaved ?? this.carbonSaved,
      currentSpeed: currentSpeed ?? this.currentSpeed,
      batteryPercent: batteryPercent ?? this.batteryPercent,
      accountStatus: accountStatus ?? this.accountStatus,
      lifecycleStatus: lifecycleStatus ?? this.lifecycleStatus,
    );
  }

  factory RiderMetrics.fromJson(Map<String, dynamic> json) =>
      _$RiderMetricsFromJson(json);

  Map<String, dynamic> toJson() => _$RiderMetricsToJson(this);
}
