import 'package:json_annotation/json_annotation.dart';

part 'rider_identity.g.dart';

/// Identity and personal information for a rider.
///
/// Extracted from [RiderModel] to reduce coupling — widgets that only
/// need name/phone/ID can depend on this sub-model instead of the full
/// 60+ field monolith.
@JsonSerializable()
class RiderIdentity {
  final String? id;
  final String riderId;
  final String phone;
  final String name;
  final String? email;
  final String? fatherName;
  final String? motherName;
  final DateTime? dob;
  final String? currentAddress;
  final String? profilePhoto;
  final String? riderPhoto;
  final String? signature;
  final String? referralCode;
  final int totalRewardPoints;

  const RiderIdentity({
    this.id,
    required this.riderId,
    required this.phone,
    required this.name,
    this.email,
    this.fatherName,
    this.motherName,
    this.dob,
    this.currentAddress,
    this.profilePhoto,
    this.riderPhoto,
    this.signature,
    this.referralCode,
    this.totalRewardPoints = 0,
  });

  RiderIdentity copyWith({
    String? id,
    String? riderId,
    String? phone,
    String? name,
    String? email,
    String? fatherName,
    String? motherName,
    DateTime? dob,
    String? currentAddress,
    String? profilePhoto,
    String? riderPhoto,
    String? signature,
    String? referralCode,
    int? totalRewardPoints,
  }) {
    return RiderIdentity(
      id: id ?? this.id,
      riderId: riderId ?? this.riderId,
      phone: phone ?? this.phone,
      name: name ?? this.name,
      email: email ?? this.email,
      fatherName: fatherName ?? this.fatherName,
      motherName: motherName ?? this.motherName,
      dob: dob ?? this.dob,
      currentAddress: currentAddress ?? this.currentAddress,
      profilePhoto: profilePhoto ?? this.profilePhoto,
      riderPhoto: riderPhoto ?? this.riderPhoto,
      signature: signature ?? this.signature,
      referralCode: referralCode ?? this.referralCode,
      totalRewardPoints: totalRewardPoints ?? this.totalRewardPoints,
    );
  }

  factory RiderIdentity.fromJson(Map<String, dynamic> json) =>
      _$RiderIdentityFromJson(json);

  Map<String, dynamic> toJson() => _$RiderIdentityToJson(this);
}
