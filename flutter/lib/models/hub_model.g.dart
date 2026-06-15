// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'hub_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

HubModel _$HubModelFromJson(Map<String, dynamic> json) => HubModel(
      id: json['id'] as String,
      name: json['name'] as String,
      location: json['location'] as String?,
      city: json['city'] as String?,
      isActive: json['isActive'] as bool? ?? true,
    );

Map<String, dynamic> _$HubModelToJson(HubModel instance) => <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'location': instance.location,
      'city': instance.city,
      'isActive': instance.isActive,
    };
