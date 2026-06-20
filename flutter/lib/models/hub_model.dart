import 'package:json_annotation/json_annotation.dart';

part 'hub_model.g.dart';

@JsonSerializable()
class HubModel {
  final String id;
  final String name;
  final String? location;
  final String? city;
  final bool isActive;

  const HubModel({
    required this.id,
    required this.name,
    this.location,
    this.city,
    this.isActive = true,
  });

  /// Human-readable display address combining location and city.
  String get displayAddress {
    final parts =
        [location, city].where((p) => p != null && p.isNotEmpty).toList();
    return parts.isNotEmpty ? parts.join(', ') : 'Hub';
  }

  factory HubModel.fromJson(Map<String, dynamic> json) =>
      _$HubModelFromJson(json);
  Map<String, dynamic> toJson() => _$HubModelToJson(this);
}
