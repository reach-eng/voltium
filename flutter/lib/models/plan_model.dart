import 'package:json_annotation/json_annotation.dart';

part 'plan_model.g.dart';

@JsonSerializable()
class PlanModel {
  final String id;
  final String name;
  final String description;
  final double price;
  final int durationDays;
  @JsonKey(defaultValue: [])
  final List<String> features;
  @JsonKey(defaultValue: '')
  final String category;

  const PlanModel({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.durationDays,
    required this.features,
    required this.category,
  });

  factory PlanModel.fromJson(Map<String, dynamic> json) =>
      _$PlanModelFromJson(json);
  Map<String, dynamic> toJson() => _$PlanModelToJson(this);
}
