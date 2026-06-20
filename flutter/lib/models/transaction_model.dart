import 'package:json_annotation/json_annotation.dart';

part 'transaction_model.g.dart';

enum TransactionType { credit, debit }

enum TransactionStatus { success, failed, pending, refunded }

enum BreakdownType { charge, tax, discount, penalty, adjustment }

/// A single line-item within a transaction (charge, tax, discount, etc.).
@JsonSerializable(createFactory: false)
class TransactionBreakdown {
  final String? id;
  final String label;
  final double amount;
  final BreakdownType type;
  final int sortOrder;

  const TransactionBreakdown({
    this.id,
    required this.label,
    required this.amount,
    this.type = BreakdownType.charge,
    this.sortOrder = 0,
  });

  factory TransactionBreakdown.fromJson(Map<String, dynamic> json) {
    return TransactionBreakdown(
      id: json['id'] as String?,
      label: json['label'] as String? ?? '',
      amount: _toDouble(json['amount']),
      type: _parseBreakdownType(json['type']),
      sortOrder: json['sortOrder'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() => _$TransactionBreakdownToJson(this);

  TransactionBreakdown copyWith({
    String? id,
    String? label,
    double? amount,
    BreakdownType? type,
    int? sortOrder,
  }) {
    return TransactionBreakdown(
      id: id ?? this.id,
      label: label ?? this.label,
      amount: amount ?? this.amount,
      type: type ?? this.type,
      sortOrder: sortOrder ?? this.sortOrder,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is TransactionBreakdown &&
        other.id == id &&
        other.label == label;
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(id, label, amount, type, sortOrder);

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  String toString() =>
      'TransactionBreakdown(label: $label, amount: $amount, type: $type)';

  // ── Private helper ──────────────────────────────────────────────────────

  static double _toDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }

  static BreakdownType _parseBreakdownType(dynamic value) {
    if (value == null) return BreakdownType.charge;
    if (value is BreakdownType) return value;
    final str = value.toString().toLowerCase();
    return BreakdownType.values.firstWhere(
      (e) => e.name.toLowerCase() == str,
      orElse: () => BreakdownType.charge,
    );
  }
}

/// Full transaction record (credit or debit) for a rider's wallet.
@JsonSerializable(createFactory: false)
class TransactionModel {
  final String? id;
  final String riderId;
  final TransactionType type;
  final double amount;
  final String? purpose;
  final TransactionStatus status;
  final String? upiRef;
  final String? receipt;
  final String? remark;
  final String? description;
  final DateTime? createdAt;
  final List<TransactionBreakdown> breakdowns;

  const TransactionModel({
    this.id,
    required this.riderId,
    this.type = TransactionType.debit,
    required this.amount,
    this.purpose,
    this.status = TransactionStatus.pending,
    this.upiRef,
    this.receipt,
    this.remark,
    this.description,
    this.createdAt,
    this.breakdowns = const [],
  });

  factory TransactionModel.fromJson(Map<String, dynamic> json) {
    return TransactionModel(
      id: json['id'] as String?,
      riderId: json['riderId'] as String? ?? '',
      type: _parseTransactionType(json['type']),
      amount: _toDouble(json['amount']),
      purpose: json['purpose'] as String?,
      status: _parseTransactionStatus(json['status']),
      upiRef: json['upiRef'] as String?,
      receipt: json['receipt'] as String?,
      remark: json['remark'] as String?,
      description: json['description'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
      breakdowns: json['breakdowns'] != null
          ? (json['breakdowns'] as List)
              .map(
                (b) => TransactionBreakdown.fromJson(b as Map<String, dynamic>),
              )
              .toList()
          : [],
    );
  }

  Map<String, dynamic> toJson() => _$TransactionModelToJson(this);

  TransactionModel copyWith({
    String? id,
    String? riderId,
    TransactionType? type,
    double? amount,
    String? purpose,
    TransactionStatus? status,
    String? upiRef,
    String? receipt,
    String? remark,
    String? description,
    DateTime? createdAt,
    List<TransactionBreakdown>? breakdowns,
  }) {
    return TransactionModel(
      id: id ?? this.id,
      riderId: riderId ?? this.riderId,
      type: type ?? this.type,
      amount: amount ?? this.amount,
      purpose: purpose ?? this.purpose,
      status: status ?? this.status,
      upiRef: upiRef ?? this.upiRef,
      receipt: receipt ?? this.receipt,
      remark: remark ?? this.remark,
      description: description ?? this.description,
      createdAt: createdAt ?? this.createdAt,
      breakdowns: breakdowns ?? this.breakdowns,
    );
  }

  /// Whether this transaction adds money to the wallet.
  @JsonKey(includeFromJson: false, includeToJson: false)
  bool get isCredit => type == TransactionType.credit;

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is TransactionModel &&
        other.id == id &&
        other.createdAt == createdAt;
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hashAll([id, createdAt]);

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  String toString() =>
      'TransactionModel(id: $id, type: $type, amount: $amount, status: $status)';

  // ── Private helpers ─────────────────────────────────────────────────────

  static double _toDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }

  static TransactionType _parseTransactionType(dynamic value) {
    if (value == null) return TransactionType.debit;
    if (value is TransactionType) return value;
    final str = value.toString().toLowerCase();
    return TransactionType.values.firstWhere(
      (e) => e.name.toLowerCase() == str,
      orElse: () => TransactionType.debit,
    );
  }

  static TransactionStatus _parseTransactionStatus(dynamic value) {
    if (value == null) return TransactionStatus.pending;
    if (value is TransactionStatus) return value;
    final str = value.toString().toLowerCase();
    return TransactionStatus.values.firstWhere(
      (e) => e.name.toLowerCase() == str,
      orElse: () => TransactionStatus.pending,
    );
  }
}
