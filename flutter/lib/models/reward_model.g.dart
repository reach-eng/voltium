// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reward_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RewardItem _$RewardItemFromJson(Map<String, dynamic> json) => RewardItem(
      id: json['id'] as String,
      title: json['title'] as String,
      points: (json['points'] as num).toInt(),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$RewardItemToJson(RewardItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'points': instance.points,
      'createdAt': instance.createdAt.toIso8601String(),
    };
