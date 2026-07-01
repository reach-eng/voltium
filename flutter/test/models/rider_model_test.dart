import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/models/rider_model.dart';

// Minimal base RiderModel for tests
RiderModel _base({
  String riderId = 'r1',
  String phone = '9876543210',
  String name = 'John Doe',
}) =>
    RiderModel(riderId: riderId, phone: phone, name: name);

void main() {
  // ── Enums ────────────────────────────────────────────────────────────────
  group('KycStatus enum', () {
    test('has all expected values', () {
      expect(KycStatus.values, containsAll([
        KycStatus.pending, KycStatus.submitted, KycStatus.approved,
        KycStatus.rejected, KycStatus.verified, KycStatus.draft,
        KycStatus.infoRequired, KycStatus.expired,
      ]));
    });
  });

  group('AccountStatus enum', () {
    test('has all expected values', () {
      expect(AccountStatus.values, containsAll([
        AccountStatus.preActive, AccountStatus.active,
        AccountStatus.suspended, AccountStatus.terminated, AccountStatus.inactive,
      ]));
    });
  });

  group('DepositStatus enum', () {
    test('has all expected values', () {
      expect(DepositStatus.values, hasLength(9));
    });
  });

  // ── Default values ───────────────────────────────────────────────────────
  group('RiderModel defaults', () {
    test('required fields set correctly', () {
      final m = _base();
      expect(m.riderId, 'r1');
      expect(m.phone, '9876543210');
      expect(m.name, 'John Doe');
    });

    test('optional fields default to null or false', () {
      final m = _base();
      expect(m.email, isNull);
      expect(m.assignedVehicle, isNull);
      expect(m.isAdminLocked, isFalse);
      expect(m.returnPending, isFalse);
      expect(m.planDone, isFalse);
      expect(m.pickupDone, isFalse);
    });

    test('numeric fields default to zero', () {
      final m = _base();
      expect(m.walletBalance, 0.0);
      expect(m.securityDeposit, 0.0);
      expect(m.paymentStreak, 0);
      expect(m.weeklyDistance, 0.0);
      expect(m.carbonSaved, 0.0);
      expect(m.batteryPercent, 0.0);
    });

    test('status fields default to NONE/NEW', () {
      final m = _base();
      expect(m.planStatus, 'NONE');
      expect(m.rentalStatus, 'NONE');
      expect(m.lifecycleStatus, 'NEW');
      expect(m.accountStatus, AccountStatus.preActive);
      expect(m.kycStatus, KycStatus.pending);
    });
  });

  // ── copyWith ────────────────────────────────────────────────────────────
  group('RiderModel.copyWith', () {
    test('updates name while preserving other fields', () {
      final m = _base();
      final updated = m.copyWith(name: 'Jane Doe');
      expect(updated.name, 'Jane Doe');
      expect(updated.riderId, 'r1');
      expect(updated.phone, '9876543210');
    });

    test('updates wallet balance', () {
      final m = _base();
      final updated = m.copyWith(walletBalance: 5000.0);
      expect(updated.walletBalance, 5000.0);
    });

    test('updates kycStatus', () {
      final m = _base();
      final updated = m.copyWith(kycStatus: KycStatus.approved);
      expect(updated.kycStatus, KycStatus.approved);
      expect(m.kycStatus, KycStatus.pending); // original unchanged
    });

    test('updates lifecycle booleans independently', () {
      final m = _base();
      final afterKyc = m.copyWith(kycDone: true);
      expect(afterKyc.kycDone, isTrue);
      expect(afterKyc.planDone, isFalse);

      final afterPlan = afterKyc.copyWith(planDone: true);
      expect(afterPlan.kycDone, isTrue);
      expect(afterPlan.planDone, isTrue);
    });

    test('updates accountStatus', () {
      final m = _base();
      final updated = m.copyWith(accountStatus: AccountStatus.active);
      expect(updated.accountStatus, AccountStatus.active);
    });
  });

  // ── Equality ────────────────────────────────────────────────────────────
  group('RiderModel equality', () {
    test('same id and updatedAt are equal', () {
      final ts = DateTime(2024, 1, 1);
      final m1 = RiderModel(riderId: 'r1', phone: '123', name: 'A',
          id: 'db1', updatedAt: ts);
      final m2 = RiderModel(riderId: 'r1', phone: '999', name: 'B',
          id: 'db1', updatedAt: ts);
      expect(m1, equals(m2));
    });

    test('different updatedAt are not equal', () {
      final m1 = RiderModel(riderId: 'r1', phone: '123', name: 'A',
          id: 'db1', updatedAt: DateTime(2024, 1, 1));
      final m2 = RiderModel(riderId: 'r1', phone: '123', name: 'A',
          id: 'db1', updatedAt: DateTime(2024, 6, 1));
      expect(m1, isNot(equals(m2)));
    });
  });

  // ── activeRentalPlanPrice getter ─────────────────────────────────────────
  group('RiderModel.activeRentalPlanPrice', () {
    test('WEEKLY_MAX → 1500.0', () {
      final m = _base().copyWith(currentPlan: 'WEEKLY_MAX');
      expect(m.activeRentalPlanPrice, 1500.0);
    });

    test('WEEKLY_BASIC → 1000.0', () {
      final m = _base().copyWith(currentPlan: 'WEEKLY_BASIC');
      expect(m.activeRentalPlanPrice, 1000.0);
    });

    test('DAILY_FLEX → 250.0', () {
      final m = _base().copyWith(currentPlan: 'DAILY_FLEX');
      expect(m.activeRentalPlanPrice, 250.0);
    });

    test('null plan → default 1500.0', () {
      final m = _base();
      expect(m.activeRentalPlanPrice, 1500.0);
    });

    test('unknown plan → default 1500.0', () {
      final m = _base().copyWith(currentPlan: 'CUSTOM_PLAN');
      expect(m.activeRentalPlanPrice, 1500.0);
    });
  });

  // ── toString ────────────────────────────────────────────────────────────
  group('RiderModel.toString', () {
    test('contains riderId and name', () {
      final m = _base(riderId: 'abc', name: 'Alice');
      expect(m.toString(), contains('abc'));
      expect(m.toString(), contains('Alice'));
    });
  });
}
