// GENERATED CODE - DO NOT MODIFY BY HAND
// PR-RUPEES-2026-08-08: regenerated for the `amountInPaise` →
// `amountInRupees` rename. Run `dart run build_runner build` to
// regenerate if you change the @JsonSerializable annotations.

part of 'deposit_record.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DepositRecord _$DepositRecordFromJson(Map<String, dynamic> json) {
  // PR-RUPEES-2026-08-08: the API returns `amountInRupees` (decimal).
  // The legacy `amountInPaise` field is also accepted during the
  // rollout for backwards-compat — we prefer the rupee field.
  double rupees = 0.0;
  final inRupees = json['amountInRupees'];
  final inPaise = json['amountInPaise'];
  if (inRupees is num) {
    rupees = inRupees.toDouble();
  } else if (inPaise is num) {
    rupees = inPaise.toDouble() / 100.0;
  }
  return DepositRecord(
    id: json['id'] as String,
    amountInRupees: rupees,
    status: $enumDecode(_$DepositStatusEnumMap, json['status']),
    rejectionReason: json['rejectionReason'] as String?,
    proofUrl: json['proofUrl'] as String?,
    createdAt: DateTime.parse(json['createdAt'] as String),
    approvedAt: json['approvedAt'] == null
        ? null
        : DateTime.parse(json['approvedAt'] as String),
  );
}

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
