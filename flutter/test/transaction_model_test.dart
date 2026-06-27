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
      // Legacy 'SUCCESS' from old client writes normalises to the
      // new canonical 'approved' (Phase 2.5 BLOCKER).
      expect(transaction.status, TransactionStatus.approved);
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
      expect(json['status'], 'approved');
      expect(json['breakdowns'], isA<List>());
      expect((json['breakdowns'] as List).length, 2);
    });

    test('server-side enum values map to the canonical set', () {
      // PENDING / APPROVED / REJECTED / FAILED / REVERSED / REFUNDED
      // map 1:1 with the canonical Flutter enum.
      expect(TransactionModel.fromJson({...mockJson, 'status': 'PENDING'}).status,
          TransactionStatus.pending);
      expect(TransactionModel.fromJson({...mockJson, 'status': 'APPROVED'}).status,
          TransactionStatus.approved);
      expect(TransactionModel.fromJson({...mockJson, 'status': 'REJECTED'}).status,
          TransactionStatus.rejected);
      expect(TransactionModel.fromJson({...mockJson, 'status': 'FAILED'}).status,
          TransactionStatus.failed);
      expect(TransactionModel.fromJson({...mockJson, 'status': 'REVERSED'}).status,
          TransactionStatus.reversed);
      expect(TransactionModel.fromJson({...mockJson, 'status': 'REFUNDED'}).status,
          TransactionStatus.refunded);
    });

    test('legacy SUCCESS maps to approved (backwards compat)', () {
      // Before Phase 2.5 the client wrote `success` (lowercase) and
      // the server wrote `APPROVED`. Old records with `success` still
      // round-trip; the parser normalises to the canonical value.
      expect(TransactionModel.fromJson({...mockJson, 'status': 'success'}).status,
          TransactionStatus.approved);
      expect(TransactionModel.fromJson({...mockJson, 'status': 'SUCCESS'}).status,
          TransactionStatus.approved);
    });

    test('unknown status falls back to pending (not crash)', () {
      expect(TransactionModel.fromJson({...mockJson, 'status': 'GIBBERISH'}).status,
          TransactionStatus.pending);
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
          transaction.copyWith(status: TransactionStatus.approved, amount: 200);

      expect(updated.status, TransactionStatus.approved);
      expect(updated.amount, 200);
      expect(updated.riderId, '1');
    });
  });
}
