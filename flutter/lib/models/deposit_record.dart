import 'package:json_annotation/json_annotation.dart';
import 'rider_model.dart'; // For DepositStatus

part 'deposit_record.g.dart';

@JsonSerializable()
class DepositRecord {
  final String id;
  final int amountInPaise;
  final DepositStatus status;
  final String? rejectionReason;
  final String? proofUrl;
  final DateTime createdAt;
  final DateTime? approvedAt;

  DepositRecord({
    required this.id,
    required this.amountInPaise,
    required this.status,
    this.rejectionReason,
    this.proofUrl,
    required this.createdAt,
    this.approvedAt,
  });

  factory DepositRecord.fromJson(Map<String, dynamic> json) =>
      _$DepositRecordFromJson(json);

  Map<String, dynamic> toJson() => _$DepositRecordToJson(this);
}
