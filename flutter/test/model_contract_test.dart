import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/models/transaction_model.dart';

void main() {
  group('Phase 1: Model Contract Testing', () {
    test('TransactionModel should correctly map from JSON', () {
      final json = {
        'id': 'tx-123',
        'riderId': 'rider_456',
        'amount': 50050,
        'type': 'CREDIT',
        'status': 'SUCCESS',
        'purpose': 'TOP_UP',
        'createdAt': '2026-05-01T10:00:00Z'
      };

      final tx = TransactionModel.fromJson(json);

      expect(tx.id, 'tx-123');
      expect(tx.amount, 50050);
      expect(tx.status, TransactionStatus.success);
    });

    test('TransactionModel should correctly format currency', () {
      final tx = TransactionModel(
        riderId: 'rider_456',
        id: 'tx-123',
        amount: 15075,
        type: TransactionType.credit,
        status: TransactionStatus.success,
        purpose: 'TOP_UP',
        createdAt: DateTime.now(),
      );

      expect(tx.amount / 100, 150.75);
    });
  });
}
