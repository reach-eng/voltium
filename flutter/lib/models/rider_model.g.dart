// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rider_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$RiderModelToJson(RiderModel instance) =>
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
      'kycStatus': _$KycStatusEnumMap[instance.kycStatus]!,
      'aadhaarFront': instance.aadhaarFront,
      'aadhaarBack': instance.aadhaarBack,
      'panCard': instance.panCard,
      'kycRejectionReason': instance.kycRejectionReason,
      'bankAccount': instance.bankAccount,
      'bankIfsc': instance.bankIfsc,
      'bankName': instance.bankName,
      'bankPassbook': instance.bankPassbook,
      'guarantorName': instance.guarantorName,
      'guarantorRelation': instance.guarantorRelation,
      'guarantorDob': instance.guarantorDob?.toIso8601String(),
      'guarantorPhone': instance.guarantorPhone,
      'guarantorAadhaarFront': instance.guarantorAadhaarFront,
      'guarantorAadhaarBack': instance.guarantorAadhaarBack,
      'guarantorPan': instance.guarantorPan,
      'guarantorVideo': instance.guarantorVideo,
      'guarantorSignature': instance.guarantorSignature,
      'guarantorPhoto': instance.guarantorPhoto,
      'guarantorAddress': instance.guarantorAddress,
      'guarantorStatus': _$GuarantorStatusEnumMap[instance.guarantorStatus]!,
      'walletBalance': instance.walletBalance,
      'securityDeposit': instance.securityDeposit,
      'depositStatus': _$DepositStatusEnumMap[instance.depositStatus]!,
      'paymentStreak': instance.paymentStreak,
      'weeklyDistance': instance.weeklyDistance,
      'carbonSaved': instance.carbonSaved,
      'currentSpeed': instance.currentSpeed,
      'batteryPercent': instance.batteryPercent,
      'planStatus': instance.planStatus,
      'currentPlan': instance.currentPlan,
      'planStartDate': instance.planStartDate?.toIso8601String(),
      'planEndDate': instance.planEndDate?.toIso8601String(),
      'rentalStatus': instance.rentalStatus,
      'assignedVehicle': instance.assignedVehicle,
      'pickupHub': instance.pickupHub,
      'teamLeader': instance.teamLeader,
      'emergencyContact': instance.emergencyContact,
      'intent': instance.intent,
      'submissionDate': instance.submissionDate?.toIso8601String(),
      'returnPending': instance.returnPending,
      'pickupPhotoFront': instance.pickupPhotoFront,
      'pickupPhotoBack': instance.pickupPhotoBack,
      'pickupPhotoLeft': instance.pickupPhotoLeft,
      'pickupPhotoRight': instance.pickupPhotoRight,
      'pickupPhotoWithVehicle': instance.pickupPhotoWithVehicle,
      'registrationDone': instance.registrationDone,
      'depositDone': instance.depositDone,
      'kycDone': instance.kycDone,
      'planDone': instance.planDone,
      'pickupDone': instance.pickupDone,
      'accountStatus': _$AccountStatusEnumMap[instance.accountStatus]!,
      'referralCode': instance.referralCode,
      'totalRewardPoints': instance.totalRewardPoints,
      'createdAt': instance.createdAt?.toIso8601String(),
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };

const _$KycStatusEnumMap = {
  KycStatus.PENDING: 'PENDING',
  KycStatus.SUBMITTED: 'SUBMITTED',
  KycStatus.VERIFIED: 'VERIFIED',
  KycStatus.REJECTED: 'REJECTED',
};

const _$GuarantorStatusEnumMap = {
  GuarantorStatus.PENDING: 'PENDING',
  GuarantorStatus.SUBMITTED: 'SUBMITTED',
  GuarantorStatus.VERIFIED: 'VERIFIED',
  GuarantorStatus.REJECTED: 'REJECTED',
};

const _$DepositStatusEnumMap = {
  DepositStatus.PENDING: 'PENDING',
  DepositStatus.COMPLETED: 'COMPLETED',
  DepositStatus.REFUNDED: 'REFUNDED',
  DepositStatus.FAILED: 'FAILED',
};

const _$AccountStatusEnumMap = {
  AccountStatus.PRE_ACTIVE: 'PRE_ACTIVE',
  AccountStatus.ACTIVE: 'ACTIVE',
  AccountStatus.SUSPENDED: 'SUSPENDED',
  AccountStatus.TERMINATED: 'TERMINATED',
};
