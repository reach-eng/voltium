import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/profile/domain/entity.dart';
import 'package:voltium_rider/features/wallet/domain/entity.dart';

void main() {
  group('Entity Parsing', () {
    group('ProfileEntity', () {
      test('fromJson parses full data', () {
        final json = {
          'id': '123',
          'fullName': 'John Doe',
          'phone': '9876543210',
          'email': 'john@example.com',
          'fatherName': 'Papa Doe',
          'motherName': 'Mama Doe',
          'currentAddress': '123 Street',
          'emergencyContact': '9876543211',
          'dob': '1990-01-01',
          'profilePhoto': 'https://example.com/photo.jpg',
        };

        final entity = ProfileEntity.fromJson(json);

        expect(entity.riderId, '123');
        expect(entity.fullName, 'John Doe');
        expect(entity.phone, '9876543210');
        expect(entity.email, 'john@example.com');
        expect(entity.fatherName, 'Papa Doe');
        expect(entity.motherName, 'Mama Doe');
        expect(entity.currentAddress, '123 Street');
        expect(entity.emergencyContact, '9876543211');
        expect(entity.dob, '1990-01-01');
        expect(entity.profilePhotoUrl, 'https://example.com/photo.jpg');
      });

      test('fromJson handles null values and defaults', () {
        final json = <String, dynamic>{};
        final entity = ProfileEntity.fromJson(json);

        expect(entity.riderId, '');
        expect(entity.fullName, '');
        expect(entity.phone, '');
        expect(entity.email, isNull);
        expect(entity.fatherName, isNull);
      });
    });

    group('WalletEntity', () {
      test('fromJson parses full data', () {
        final json = {
          'riderId': '123',
          'balanceInPaise': 10050,
          'securityDeposit': 250000,
          'depositStatus': 'PAID',
          'paymentStreak': 5,
          'pendingTopups': 50000,
        };

        final entity = WalletEntity.fromJson(json);

        expect(entity.riderId, '123');
        expect(entity.balanceInPaise, 10050);
        expect(entity.balanceInRupees, 100.50);
        expect(entity.securityDeposit, 250000);
        expect(entity.securityDepositInRupees, 2500.0);
        expect(entity.depositStatus, 'PAID');
        expect(entity.paymentStreak, 5);
        expect(entity.pendingTopupsInPaise, 50000);
        expect(entity.isLowBalance, false);
      });

      test('fromJson handles empty/null data', () {
        final json = <String, dynamic>{};
        final entity = WalletEntity.fromJson(json);

        expect(entity.riderId, '');
        expect(entity.balanceInPaise, 0);
        expect(entity.securityDeposit, 0);
        expect(entity.depositStatus, 'PENDING');
        expect(entity.paymentStreak, 0);
        expect(entity.pendingTopupsInPaise, 0);
        expect(entity.isLowBalance, true); // 0 < 5000
      });
    });

    group('TransactionEntity', () {
      test('fromJson parses correctly', () {
        final json = {
          'id': 'tx_123',
          'amount': 500,
          'type': 'DEBIT',
          'purpose': 'RENTAL',
          'status': 'SUCCESS',
          'createdAt': '2023-10-24T12:00:00Z',
        };

        final entity = TransactionEntity.fromJson(json);

        expect(entity.id, 'tx_123');
        expect(entity.amountInPaise, 50000);
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
        expect(entity.amountInPaise, 0);
        expect(entity.type, 'CREDIT');
        expect(entity.isCredit, true);
        expect(entity.status, 'PENDING');
      });
    });

    group('TopupRequest', () {
      test('toJson outputs correctly', () {
        const req = TopupRequest(
          riderId: '123',
          amount: 500,
          method: 'UPI',
          upiRef: 'REF123',
          proofUrl: 'https://example.com/proof.jpg',
        );

        final json = req.toJson();
        expect(json['riderId'], '123');
        expect(json['amount'], 500.0);
        expect(json['method'], 'UPI');
        expect(json['upiRef'], 'REF123');
        expect(json['proofUrl'], 'https://example.com/proof.jpg');
        expect(json['purpose'], 'TOP_UP'); // Default
      });
    });
  });
}
