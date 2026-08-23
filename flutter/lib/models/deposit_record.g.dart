// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'deposit_record.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DepositRecord _$DepositRecordFromJson(Map<String, dynamic> json) =>
    DepositRecord(
      id: json['id'] as String,
      amountInRupees: (json['amountInRupees'] as num).toDouble(),
      status: $enumDecode(_$DepositStatusEnumMap, json['status']),
      rejectionReason: json['rejectionReason'] as String?,
      proofUrl: json['proofUrl'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      approvedAt: json['approvedAt'] == null
          ? null
          : DateTime.parse(json['approvedAt'] as String),
    );

Map<String, dynamic> _$DepositRecordToJson(DepositRecord instance) =>
    <String, dynamic>{
      'id': instance.id,
      'amountInRupees': instance.amountInRupees,
      'status': _$DepositStatusEnumMap[instance.status]!,
      'rejectionReason': instance.rejectionReason,
      'proofUrl': instance.proofUrl,
      'createdAt': instance.createdAt.toIso8601String(),
      'approvedAt': instance.approvedAt?.toIso8601String(),
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
