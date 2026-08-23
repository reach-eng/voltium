// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'plan_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PlanModel _$PlanModelFromJson(Map<String, dynamic> json) => PlanModel(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      price: (json['price'] as num).toDouble(),
      securityDeposit: (json['securityDeposit'] as num?)?.toDouble() ?? 0.0,
      durationDays: (json['durationDays'] as num).toInt(),
      features: (json['features'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      category: json['category'] as String? ?? '',
      bestValue: json['bestValue'] as bool? ?? false,
      iconKey: json['iconKey'] as String? ?? '',
    );

Map<String, dynamic> _$PlanModelToJson(PlanModel instance) => <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'description': instance.description,
      'price': instance.price,
      'securityDeposit': instance.securityDeposit,
      'durationDays': instance.durationDays,
      'features': instance.features,
      'category': instance.category,
      'bestValue': instance.bestValue,
      'iconKey': instance.iconKey,
    };
