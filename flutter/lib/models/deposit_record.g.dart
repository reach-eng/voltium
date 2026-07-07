// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'deposit_record.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DepositRecord _$DepositRecordFromJson(Map<String, dynamic> json) =>
    DepositRecord(
      id: json['id'] as String,
      amountInPaise: (json['amountInPaise'] as num).toInt(),
      status: $enumDecode(_$DepositStatusEnumMap, json['status']),
      rejectionReason: json['rejectionReason'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      approvedAt: json['approvedAt'] == null
          ? null
          : DateTime.parse(json['approvedAt'] as String),
    );

Map<String, dynamic> _$DepositRecordToJson(DepositRecord instance) =>
    <String, dynamic>{
      'id': instance.id,
      'amountInPaise': instance.amountInPaise,
      'status': _$DepositStatusEnumMap[instance.status]!,
      'rejectionReason': instance.rejectionReason,
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
