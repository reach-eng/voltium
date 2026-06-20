import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/models/transaction_model.dart';

void main() {
  group('TransactionModel', () {
    final mockJson = {
      'id': 'tx_123',
      'riderId': 'rider_456',
      'type': 'CREDIT',
      'amount': 500.50,
      'purpose': 'Top-up',
      'status': 'SUCCESS',
      'upiRef': 'upi_789',
      'createdAt': '2026-04-30T10:00:00Z',
      'breakdowns': [
        {
          'id': 'b_1',
          'label': 'Base Amount',
          'amount': 450.0,
          'type': 'CHARGE',
        },
        {
          'id': 'b_2',
          'label': 'Tax',
          'amount': 50.5,
          'type': 'TAX',
        }
      ],
    };

    test('fromJson should parse correctly', () {
      final transaction = TransactionModel.fromJson(mockJson);

      expect(transaction.id, 'tx_123');
      expect(transaction.riderId, 'rider_456');
      expect(transaction.type, TransactionType.credit);
      expect(transaction.amount, 500.50);
      expect(transaction.status, TransactionStatus.success);
      expect(transaction.breakdowns.length, 2);
      expect(transaction.breakdowns[0].label, 'Base Amount');
      expect(transaction.breakdowns[1].type, BreakdownType.tax);
    });

    test('toJson should convert correctly', () {
      final transaction = TransactionModel.fromJson(mockJson);
      final json = transaction.toJson();

      expect(json['id'], 'tx_123');
      expect(json['type'], 'credit');
      expect(json['amount'], 500.50);
      expect(json['breakdowns'], isA<List>());
      expect((json['breakdowns'] as List).length, 2);
    });

    test('isCredit should return true for CREDIT type', () {
      const transaction = TransactionModel(
        riderId: '1',
        amount: 100,
        type: TransactionType.credit,
      );
      expect(transaction.isCredit, isTrue);
    });

    test('isCredit should return false for DEBIT type', () {
      const transaction = TransactionModel(
        riderId: '1',
        amount: 100,
        type: TransactionType.debit,
      );
      expect(transaction.isCredit, isFalse);
    });

    test('copyWith should update fields correctly', () {
      const transaction = TransactionModel(
        riderId: '1',
        amount: 100,
        status: TransactionStatus.pending,
      );

      final updated =
          transaction.copyWith(status: TransactionStatus.success, amount: 200);

      expect(updated.status, TransactionStatus.success);
      expect(updated.amount, 200);
      expect(updated.riderId, '1');
    });
  });
}
