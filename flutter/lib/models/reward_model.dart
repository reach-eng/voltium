import 'package:json_annotation/json_annotation.dart';

part 'reward_model.g.dart';

@JsonSerializable()
class RewardItem {
  final String id;
  final String title;
  final int points;
  final DateTime createdAt;

  const RewardItem({
    required this.id,
    required this.title,
    required this.points,
    required this.createdAt,
  });

  factory RewardItem.fromJson(Map<String, dynamic> json) =>
      _$RewardItemFromJson(json);
  Map<String, dynamic> toJson() => _$RewardItemToJson(this);
}
