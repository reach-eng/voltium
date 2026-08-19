import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/wallet/domain/entity.dart';

void main() {
  group('Entity Parsing', () {
    group('TransactionEntity', () {
      test('fromJson parses correctly', () {
        final json = {
          'id': 'tx_123',
          // PR-RUPEES-2026-08-08: the API now returns the amount in
          // **rupees** (decimal). The legacy `amountInPaise` is also
          // accepted during the rollout for backwards-compat.
          'amountInRupees': 500.0,
          'type': 'DEBIT',
          'purpose': 'RENTAL',
          'status': 'SUCCESS',
          'createdAt': '2023-10-24T12:00:00Z',
        };

        final entity = TransactionEntity.fromJson(json);

        expect(entity.id, 'tx_123');
        expect(entity.amountInRupees, 500.0);
        expect(entity.type, 'DEBIT');
        expect(entity.isCredit, false);
        expect(entity.purpose, 'RENTAL');
        expect(entity.status, 'SUCCESS');
        expect(entity.createdAt.year, 2023);
      });

      test('fromJson handles missing data', () {
        final json = {
          'id': 'tx_124',
        };
        final entity = TransactionEntity.fromJson(json);

        expect(entity.id, 'tx_124');
        expect(entity.amountInRupees, 0.0);
        expect(entity.type, 'CREDIT');
        expect(entity.isCredit, true);
        expect(entity.status, 'PENDING');
      });

      test('fromJson falls back to legacy amountInPaise field', () {
        // PR-RUPEES-2026-08-08: backwards-compat with the old paise
        // field. The legacy `amountInPaise: 50000` (₹500) should
        // parse to `amountInRupees: 500.0`.
        final json = {
          'id': 'tx_125',
          'amountInPaise': 50000,
          'type': 'CREDIT',
          'purpose': 'TOP_UP',
          'status': 'SUCCESS',
          'createdAt': '2023-10-24T12:00:00Z',
        };

        final entity = TransactionEntity.fromJson(json);

        expect(entity.amountInRupees, 500.0);
      });
    });

    group('TopupRequest', () {
      test('toJson outputs correctly', () {
        // PR-RUPEES-2026-08-08: `amount` is renamed to `amountInRupees`
        // to make the unit explicit. The value is in rupees.
        const req = TopupRequest(
          riderId: '123',
          amountInRupees: 500,
          method: 'UPI',
          upiRef: 'REF123',
          proofUrl: 'https://example.com/proof.jpg',
        );

        final json = req.toJson();
        expect(json['riderId'], '123');
        // The wire format is still `amount` (the API contract); only
        // the Dart field is renamed.
        expect(json['amount'], 500.0);
        expect(json['method'], 'UPI');
        expect(json['upiRef'], 'REF123');
        expect(json['proofUrl'], 'https://example.com/proof.jpg');
        expect(json['purpose'], 'TOP_UP'); // Default
      });
    });
  });
}
