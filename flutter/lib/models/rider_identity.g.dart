// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rider_identity.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RiderIdentity _$RiderIdentityFromJson(Map<String, dynamic> json) =>
    RiderIdentity(
      id: json['id'] as String?,
      riderId: json['riderId'] as String,
      phone: json['phone'] as String,
      name: json['name'] as String,
      email: json['email'] as String?,
      fatherName: json['fatherName'] as String?,
      motherName: json['motherName'] as String?,
      dob: json['dob'] == null ? null : DateTime.parse(json['dob'] as String),
      currentAddress: json['currentAddress'] as String?,
      profilePhoto: json['profilePhoto'] as String?,
      riderPhoto: json['riderPhoto'] as String?,
      signature: json['signature'] as String?,
      referralCode: json['referralCode'] as String?,
      totalRewardPoints: (json['totalRewardPoints'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$RiderIdentityToJson(RiderIdentity instance) =>
    <String, dynamic>{
      'id': instance.id,
      'riderId': instance.riderId,
      'phone': instance.phone,
      'name': instance.name,
      'email': instance.email,
      'fatherName': instance.fatherName,
      'motherName': instance.motherName,
      'dob': instance.dob?.toIso8601String(),
      'currentAddress': instance.currentAddress,
      'profilePhoto': instance.profilePhoto,
      'riderPhoto': instance.riderPhoto,
      'signature': instance.signature,
      'referralCode': instance.referralCode,
      'totalRewardPoints': instance.totalRewardPoints,
    };
