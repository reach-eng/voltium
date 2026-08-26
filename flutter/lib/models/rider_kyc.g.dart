// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rider_kyc.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RiderKYC _$RiderKYCFromJson(Map<String, dynamic> json) => RiderKYC(
      kycStatus: $enumDecodeNullable(_$KycStatusEnumMap, json['kycStatus']) ??
          KycStatus.pending,
      aadhaarFront: json['aadhaarFront'] as String?,
      aadhaarBack: json['aadhaarBack'] as String?,
      panCard: json['panCard'] as String?,
      kycRejectionReason: json['kycRejectionReason'] as String?,
      bankAccount: json['bankAccount'] as String?,
      bankIfsc: json['bankIfsc'] as String?,
      bankName: json['bankName'] as String?,
      bankPassbook: json['bankPassbook'] as String?,
      guarantorName: json['guarantorName'] as String?,
      guarantorRelation: json['guarantorRelation'] as String?,
      guarantorDob: json['guarantorDob'] == null
          ? null
          : DateTime.parse(json['guarantorDob'] as String),
      guarantorPhone: json['guarantorPhone'] as String?,
      guarantorAadhaarFront: json['guarantorAadhaarFront'] as String?,
      guarantorAadhaarBack: json['guarantorAadhaarBack'] as String?,
      guarantorPan: json['guarantorPan'] as String?,
      guarantorVideo: json['guarantorVideo'] as String?,
      guarantorSignature: json['guarantorSignature'] as String?,
      guarantorPhoto: json['guarantorPhoto'] as String?,
      guarantorAddress: json['guarantorAddress'] as String?,
      guarantorStatus: $enumDecodeNullable(
              _$GuarantorStatusEnumMap, json['guarantorStatus']) ??
          GuarantorStatus.pending,
      securityDeposit: (json['securityDeposit'] as num?)?.toDouble() ?? 0.0,
      depositStatus:
          $enumDecodeNullable(_$DepositStatusEnumMap, json['depositStatus']) ??
              DepositStatus.pending,
      registrationDone: json['registrationDone'] as bool? ?? false,
      depositDone: json['depositDone'] as bool? ?? false,
      kycDone: json['kycDone'] as bool? ?? false,
    );

Map<String, dynamic> _$RiderKYCToJson(RiderKYC instance) => <String, dynamic>{
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
      'securityDeposit': instance.securityDeposit,
      'depositStatus': _$DepositStatusEnumMap[instance.depositStatus]!,
      'registrationDone': instance.registrationDone,
      'depositDone': instance.depositDone,
      'kycDone': instance.kycDone,
    };

const _$KycStatusEnumMap = {
  KycStatus.pending: 'PENDING',
  KycStatus.draft: 'DRAFT',
  KycStatus.submitted: 'SUBMITTED',
  KycStatus.verified: 'VERIFIED',
  KycStatus.approved: 'APPROVED',
  KycStatus.rejected: 'REJECTED',
  KycStatus.infoRequired: 'INFO_REQUIRED',
  KycStatus.expired: 'EXPIRED',
};

const _$GuarantorStatusEnumMap = {
  GuarantorStatus.pending: 'PENDING',
  GuarantorStatus.draft: 'DRAFT',
  GuarantorStatus.submitted: 'SUBMITTED',
  GuarantorStatus.verified: 'VERIFIED',
  GuarantorStatus.approved: 'APPROVED',
  GuarantorStatus.rejected: 'REJECTED',
  GuarantorStatus.infoRequired: 'INFO_REQUIRED',
  GuarantorStatus.replaced: 'REPLACED',
};

const _$DepositStatusEnumMap = {
  DepositStatus.pending: 'PENDING',
  DepositStatus.notSubmitted: 'NOT_SUBMITTED',
  DepositStatus.pendingVerification: 'PENDING_VERIFICATION',
  DepositStatus.approved: 'APPROVED',
  DepositStatus.rejected: 'REJECTED',
  DepositStatus.refundRequested: 'REFUND_REQUESTED',
  DepositStatus.refunded: 'REFUNDED',
  DepositStatus.forfeited: 'FORFEITED',
  DepositStatus.partiallyRefunded: 'PARTIALLY_REFUNDED',
};
