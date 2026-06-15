// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sponsored_offer_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SponsoredOffer _$SponsoredOfferFromJson(Map<String, dynamic> json) =>
    SponsoredOffer(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      icon: json['icon'] as String?,
      validFrom: DateTime.parse(json['validFrom'] as String),
      validUntil: DateTime.parse(json['validUntil'] as String),
      isActive: json['isActive'] as bool? ?? true,
    );

Map<String, dynamic> _$SponsoredOfferToJson(SponsoredOffer instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'description': instance.description,
      'icon': instance.icon,
      'validFrom': instance.validFrom.toIso8601String(),
      'validUntil': instance.validUntil.toIso8601String(),
      'isActive': instance.isActive,
    };
