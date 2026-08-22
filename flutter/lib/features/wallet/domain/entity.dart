/// Top-up request entity.
///
/// All Voltium users are based in India. The API accepts and returns
/// money in **rupees** (decimal). The Flutter app never deals in
/// paise; the conversion to paise happens server-side on insert.
class TopupRequest {
  final String riderId;
  final double amountInRupees;
  final String method;
  final String? upiRef;
  final String? proofUrl;
  final String purpose;

  const TopupRequest({
    required this.riderId,
    required this.amountInRupees,
    required this.method,
    this.upiRef,
    this.proofUrl,
    this.purpose = 'TOP_UP',
  });

  Map<String, dynamic> toJson() => {
        'riderId': riderId,
        // The API contract is rupees — no /100 here. See PR-RUPEES-2026-08-08.
        'amount': amountInRupees,
        'method': method,
        if (upiRef != null) 'upiRef': upiRef,
        if (proofUrl != null) 'proofUrl': proofUrl,
        'purpose': purpose,
      };
}

/// Line-item breakdown (charge / tax / discount / penalty / adjustment)
/// attached to a transaction by the server.
///
/// `type` is kept as the raw server string; the presentation layer
/// normalises it into the `BreakdownType` enum.
class TransactionBreakdownEntity {
  final String? id;
  final String label;
  final double amountInRupees;
  final String type;
  final int sortOrder;

  const TransactionBreakdownEntity({
    this.id,
    required this.label,
    this.amountInRupees = 0,
    this.type = 'charge',
    this.sortOrder = 0,
  });

  factory TransactionBreakdownEntity.fromJson(Map<String, dynamic> json) {
    return TransactionBreakdownEntity(
      id: json['id'] as String?,
      label: json['label'] as String? ?? '',
      amountInRupees: _toDouble(json['amountInRupees'] ?? json['amount']),
      type: json['type'] as String? ?? 'charge',
      sortOrder: json['sortOrder'] as int? ?? 0,
    );
  }

  static double _toDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }
}

/// Transaction history entry.
///
/// All amounts are in **rupees** as received from the API. The DB
/// still stores paise; the conversion happens at the API boundary.
/// See PR-RUPEES-2026-08-08.
class TransactionEntity {
  final String id;
  final double amountInRupees;
  final String type;
  final String purpose;
  final String status;
  final DateTime createdAt;
  final List<TransactionBreakdownEntity> breakdowns;

  const TransactionEntity({
    required this.id,
    this.amountInRupees = 0,
    this.type = 'CREDIT',
    this.purpose = '',
    this.status = 'PENDING',
    required this.createdAt,
    this.breakdowns = const [],
  });

  bool get isCredit => type == 'CREDIT';

  factory TransactionEntity.fromJson(Map<String, dynamic> json) {
    // The API returns `amount` in rupees (and the deprecated
    // `amountInPaise` for legacy clients — preferred `amountInRupees`
    // when present). We prefer the rupees-shaped fields and fall
    // back to the legacy paise field if needed.
    double rupees = 0.0;
    final inRupees = json['amountInRupees'];
    final amount = json['amount'];
    final inPaise = json['amountInPaise'];
    if (inRupees is num) {
      rupees = inRupees.toDouble();
    } else if (amount is num) {
      rupees = amount.toDouble();
    } else if (inPaise is num) {
      rupees = inPaise.toDouble() / 100.0;
    }

    return TransactionEntity(
      id: json['id'] as String? ?? '',
      amountInRupees: rupees.abs(),
      type: json['type'] as String? ?? 'CREDIT',
      purpose: json['purpose'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
      // AUDIT FIX 2026-08-22 (HIST-c): the server includes `breakdowns`
      // on every history entry — map them so the fee-breakdown UI works.
      breakdowns: json['breakdowns'] is List
          ? (json['breakdowns'] as List)
              .whereType<Map<String, dynamic>>()
              .map(TransactionBreakdownEntity.fromJson)
              .toList()
          : const [],
    );
  }
}
