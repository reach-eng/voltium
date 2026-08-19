import 'package:json_annotation/json_annotation.dart';

part 'plan_model.g.dart';

@JsonSerializable()
class PlanModel {
  final String id;
  final String name;
  final String? description;
  final double price;
  // PR-47 (WALLET P1-1): the backend (`plan.use-cases.ts:57, 74, 131, 170, 201`)
  // already returns `securityDeposit` in rupees alongside `price`. Adding the
  // field to the model removes the need for the `AppConstants.planSecurityDepositRupees`
  // hardcoded map in `choose_plan_screen`.
  final double securityDeposit;
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
    required this.securityDeposit,
    required this.durationDays,
    required this.features,
    required this.category,
  });

  factory PlanModel.fromJson(Map<String, dynamic> json) =>
      _$PlanModelFromJson(json);
  Map<String, dynamic> toJson() => _$PlanModelToJson(this);
}
