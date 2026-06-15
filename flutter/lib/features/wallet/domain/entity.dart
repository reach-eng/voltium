/// Wallet domain entity representing the rider's wallet state.
class WalletEntity {
  final String riderId;
  final int balanceInPaise;
  final int securityDeposit;
  final String depositStatus;
  final int paymentStreak;
  final int pendingTopupsInPaise;

  const WalletEntity({
    this.riderId = '',
    this.balanceInPaise = 0,
    this.securityDeposit = 0,
    this.depositStatus = 'PENDING',
    this.paymentStreak = 0,
    this.pendingTopupsInPaise = 0,
  });

  double get balanceInRupees => balanceInPaise / 100;
  double get securityDepositInRupees => securityDeposit / 100;

  bool get isLowBalance => balanceInPaise < 5000; // Below ₹50

  factory WalletEntity.fromJson(Map<String, dynamic> json) {
    return WalletEntity(
      riderId: json['riderId'] as String? ?? '',
      balanceInPaise: json['balanceInPaise'] as int? ?? 0,
      securityDeposit: json['securityDeposit'] as int? ?? 0,
      depositStatus: json['depositStatus'] as String? ?? 'PENDING',
      paymentStreak: json['paymentStreak'] as int? ?? 0,
      pendingTopupsInPaise: json['pendingTopups'] as int? ?? 0,
    );
  }
}

/// Top-up request entity.
class TopupRequest {
  final double amount;
  final String method;
  final String? upiRef;
  final String? proofUrl;
  final String purpose;

  const TopupRequest({
    required this.amount,
    required this.method,
    this.upiRef,
    this.proofUrl,
    this.purpose = 'TOP_UP',
  });

  Map<String, dynamic> toJson() => {
        'amount': amount,
        'method': method,
        if (upiRef != null) 'upiRef': upiRef,
        if (proofUrl != null) 'proofUrl': proofUrl,
        'purpose': purpose,
      };
}

/// Transaction history entry.
class TransactionEntity {
  final String id;
  final int amountInPaise;
  final String type;
  final String purpose;
  final String status;
  final DateTime createdAt;

  const TransactionEntity({
    required this.id,
    this.amountInPaise = 0,
    this.type = 'CREDIT',
    this.purpose = '',
    this.status = 'PENDING',
    required this.createdAt,
  });

  double get amountInRupees => amountInPaise / 100;
  bool get isCredit => type == 'CREDIT';

  factory TransactionEntity.fromJson(Map<String, dynamic> json) {
    return TransactionEntity(
      id: json['id'] as String,
      amountInPaise: (json['amount'] as num?)?.toInt() ?? 0,
      type: json['type'] as String? ?? 'CREDIT',
      purpose: json['purpose'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
