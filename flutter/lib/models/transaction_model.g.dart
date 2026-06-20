// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'transaction_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$TransactionBreakdownToJson(
        TransactionBreakdown instance) =>
    <String, dynamic>{
      'id': instance.id,
      'label': instance.label,
      'amount': instance.amount,
      'type': _$BreakdownTypeEnumMap[instance.type]!,
      'sortOrder': instance.sortOrder,
    };

const _$BreakdownTypeEnumMap = {
  BreakdownType.charge: 'charge',
  BreakdownType.tax: 'tax',
  BreakdownType.discount: 'discount',
  BreakdownType.penalty: 'penalty',
  BreakdownType.adjustment: 'adjustment',
};

Map<String, dynamic> _$TransactionModelToJson(TransactionModel instance) =>
    <String, dynamic>{
      'id': instance.id,
      'riderId': instance.riderId,
      'type': _$TransactionTypeEnumMap[instance.type]!,
      'amount': instance.amount,
      'purpose': instance.purpose,
      'status': _$TransactionStatusEnumMap[instance.status]!,
      'upiRef': instance.upiRef,
      'receipt': instance.receipt,
      'remark': instance.remark,
      'description': instance.description,
      'createdAt': instance.createdAt?.toIso8601String(),
      'breakdowns': instance.breakdowns,
    };

const _$TransactionTypeEnumMap = {
  TransactionType.credit: 'credit',
  TransactionType.debit: 'debit',
};

const _$TransactionStatusEnumMap = {
  TransactionStatus.success: 'success',
  TransactionStatus.failed: 'failed',
  TransactionStatus.pending: 'pending',
  TransactionStatus.refunded: 'refunded',
};
