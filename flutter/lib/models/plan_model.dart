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
  @JsonKey(defaultValue: 0.0)
  final double securityDeposit;
  final int durationDays;
  @JsonKey(defaultValue: [])
  final List<String> features;
  @JsonKey(defaultValue: '')
  final String category;

  // PR-7 (F-033 — 2026-08-22 deep audit): the server contract now
  // exposes a server-side `bestValue: boolean` flag instead of the
  // client-side name-substring heuristic (`_isBestValuePlan`,
  // `name.contains('monthly') || name.contains('elite')`). The
  // heuristic silently broke on plan renames and on Hindi-locale
  // plan names; the server flag is the canonical signal.
  @JsonKey(defaultValue: false)
  final bool bestValue;

  // PR-7 (F-033): server-provided icon key. The previous
  // implementation guessed an icon from the plan name (`speed` for
  // "Daily", `bolt` for "Premium", etc.) which produced wrong
  // icons when a plan was renamed. The server now sends a stable
  // `iconKey` (e.g. `'daily'`, `'weekly'`, `'monthly'`, `'elite'`)
  // and the client maps it via `PlanIcons.byKey`.
  @JsonKey(defaultValue: '')
  final String iconKey;

  const PlanModel({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.securityDeposit,
    required this.durationDays,
    required this.features,
    required this.category,
    this.bestValue = false,
    this.iconKey = '',
  });

  factory PlanModel.fromJson(Map<String, dynamic> json) =>
      _$PlanModelFromJson(json);
  Map<String, dynamic> toJson() => _$PlanModelToJson(this);
}
