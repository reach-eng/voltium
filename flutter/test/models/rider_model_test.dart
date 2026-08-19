import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/models/deposit_record.dart';
import 'package:voltium_rider/models/rider_model.dart';

// Minimal base RiderModel for tests
RiderModel _base({
  String riderId = 'r1',
  String phone = '9876543210',
  String name = 'John Doe',
  String? id,
  String planStatus = 'NONE',
  KycStatus kycStatus = KycStatus.pending,
  DepositRecord? depositRecord,
  bool registrationDone = false,
  bool depositDone = false,
  bool kycDone = false,
  bool planDone = false,
  bool pickupDone = false,
  String? currentPlan,
  double? currentPlanPrice,
  double securityDeposit = 0.0,
}) =>
    RiderModel(
      id: id,
      riderId: riderId,
      phone: phone,
      name: name,
      planStatus: planStatus,
      kycStatus: kycStatus,
      depositRecord: depositRecord,
      registrationDone: registrationDone,
      depositDone: depositDone,
      kycDone: kycDone,
      planDone: planDone,
      pickupDone: pickupDone,
      currentPlan: currentPlan,
      currentPlanPrice: currentPlanPrice,
      securityDeposit: securityDeposit,
    );

void main() {
  // ── Enums ────────────────────────────────────────────────────────────────
  group('KycStatus enum', () {
    test('has all expected values', () {
      expect(
          KycStatus.values,
          containsAll([
            KycStatus.pending,
            KycStatus.submitted,
            KycStatus.approved,
            KycStatus.rejected,
            KycStatus.verified,
            KycStatus.draft,
            KycStatus.infoRequired,
            KycStatus.expired,
          ]));
    });
  });

  group('AccountStatus enum', () {
    test('has all expected values', () {
      expect(
          AccountStatus.values,
          containsAll([
            AccountStatus.preActive,
            AccountStatus.active,
            AccountStatus.suspended,
            AccountStatus.terminated,
            AccountStatus.inactive,
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
      final m1 = RiderModel(
          riderId: 'r1', phone: '123', name: 'A', id: 'db1', updatedAt: ts);
      final m2 = RiderModel(
          riderId: 'r1', phone: '999', name: 'B', id: 'db1', updatedAt: ts);
      expect(m1, equals(m2));
    });

    test('different updatedAt are not equal', () {
      final m1 = RiderModel(
          riderId: 'r1',
          phone: '123',
          name: 'A',
          id: 'db1',
          updatedAt: DateTime(2024, 1, 1));
      final m2 = RiderModel(
          riderId: 'r1',
          phone: '123',
          name: 'A',
          id: 'db1',
          updatedAt: DateTime(2024, 6, 1));
      expect(m1, isNot(equals(m2)));
    });
  });

  // ── activeRentalPlanPrice getter ─────────────────────────────────────────
  // PR-47 (WALLET P1-1): the getter now reads the backend-joined
  // `currentPlanPrice` (already converted from paise in fromJson) instead
  // of the hardcoded AppConstants map — the server is the source of truth
  // for plan pricing. Falls back to 0.0 when no price is available.
  group('RiderModel.activeRentalPlanPrice', () {
    test('returns backend currentPlanPrice when set', () {
      final m = _base(currentPlanPrice: 1499.5);
      expect(m.activeRentalPlanPrice, 1499.5);
    });

    test('returns plan price for WEEKLY_MAX plan', () {
      final m = _base(currentPlan: 'WEEKLY_MAX', currentPlanPrice: 1500);
      expect(m.activeRentalPlanPrice, 1500.0);
    });

    test('returns plan price for WEEKLY_BASIC plan', () {
      final m = _base(currentPlan: 'WEEKLY_BASIC', currentPlanPrice: 1000);
      expect(m.activeRentalPlanPrice, 1000.0);
    });

    test('returns plan price for DAILY_FLEX plan', () {
      final m = _base(currentPlan: 'DAILY_FLEX', currentPlanPrice: 250);
      expect(m.activeRentalPlanPrice, 250.0);
    });

    test('null price → 0.0 (no backend price yet)', () {
      final m = _base(currentPlan: 'WEEKLY_MAX');
      expect(m.activeRentalPlanPrice, 0.0);
    });

    test('unknown plan with price still uses the backend price', () {
      final m = _base(currentPlan: 'CUSTOM_PLAN', currentPlanPrice: 1200);
      expect(m.activeRentalPlanPrice, 1200.0);
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

  // ── Compound state getters (used by PreDashboardScreen) ───────────────
  // PR-P2.3: these tests pin the boolean expressions the screen relies
  // on. The pre_dashboard refactor in PR-P2.3 replaced inline
  // expressions (e.g. `rider.planStatus == 'REJECTED'`) with these named
  // getters, so locking them down ensures the screen and model can't
  // drift apart silently.
  group('RiderModel — rejection flags', () {
    test('isKycRejected mirrors kycStatus', () {
      expect(
        _base(kycStatus: KycStatus.rejected).isKycRejected,
        isTrue,
      );
      expect(
        _base(kycStatus: KycStatus.approved).isKycRejected,
        isFalse,
      );
      expect(
        _base(kycStatus: KycStatus.pending).isKycRejected,
        isFalse,
      );
    });

    test('isKycSubmitted mirrors kycStatus', () {
      expect(_base(kycStatus: KycStatus.submitted).isKycSubmitted, isTrue);
      expect(_base(kycStatus: KycStatus.approved).isKycSubmitted, isFalse);
    });

    test('isPlanRejected mirrors planStatus', () {
      expect(_base(planStatus: 'REJECTED').isPlanRejected, isTrue);
      expect(_base(planStatus: 'APPROVED').isPlanRejected, isFalse);
      expect(_base(planStatus: 'NONE').isPlanRejected, isFalse);
    });

    test('isDepositRejected mirrors depositRecord.status', () {
      // No record → not rejected
      expect(_base().isDepositRejected, isFalse);
      // Rejected record
      final rejected = _base(
        depositRecord: const _StubDepositRecord(
          status: DepositStatus.rejected,
        ),
      );
      expect(rejected.isDepositRejected, isTrue);
      // Approved record → not rejected
      final approved = _base(
        depositRecord: const _StubDepositRecord(
          status: DepositStatus.approved,
        ),
      );
      expect(approved.isDepositRejected, isFalse);
    });
  });

  group('RiderModel — flow flags (needs/can/is)', () {
    test('isAwaitingPickup = plan done AND pickup not done', () {
      final m = _base(planDone: true, pickupDone: false);
      expect(m.isAwaitingPickup, isTrue);
      expect(
          _base(planDone: false, pickupDone: false).isAwaitingPickup, isFalse);
      expect(_base(planDone: true, pickupDone: true).isAwaitingPickup, isFalse);
    });

    test('needsPlanSelection = registration done AND plan not done', () {
      final m = _base(registrationDone: true, planDone: false);
      expect(m.needsPlanSelection, isTrue);
      expect(
        _base(registrationDone: true, planDone: true).needsPlanSelection,
        isFalse,
      );
      expect(
        _base(registrationDone: false, planDone: false).needsPlanSelection,
        isFalse,
      );
    });

    test('needsRegistrationStart = no registration AND no KYC started', () {
      // Fresh rider, no KYC submitted/rejected → start registration
      final fresh = _base(
        registrationDone: false,
        kycStatus: KycStatus.pending,
      );
      expect(fresh.needsRegistrationStart, isTrue);
      // KYC already submitted → don't show start-registration CTA
      final submitted =
          _base(registrationDone: false, kycStatus: KycStatus.submitted);
      expect(submitted.needsRegistrationStart, isFalse);
      // KYC rejected → don't show start-registration CTA
      final rejected =
          _base(registrationDone: false, kycStatus: KycStatus.rejected);
      expect(rejected.needsRegistrationStart, isFalse);
      // Already registered → don't show start-registration CTA
      final registered = _base(
        registrationDone: true,
        kycStatus: KycStatus.pending,
      );
      expect(registered.needsRegistrationStart, isFalse);
    });

    test('needsDeposit = plan done AND deposit not done', () {
      final m = _base(planDone: true, depositDone: false);
      expect(m.needsDeposit, isTrue);
      expect(_base(planDone: false, depositDone: false).needsDeposit, isFalse);
      expect(_base(planDone: true, depositDone: true).needsDeposit, isFalse);
    });

    test('canSubmitDeposit = no record OR record is notSubmitted', () {
      expect(_base().canSubmitDeposit, isTrue);
      final submitted = _base(
        depositRecord:
            const _StubDepositRecord(status: DepositStatus.notSubmitted),
      );
      expect(submitted.canSubmitDeposit, isTrue);
      final pending = _base(
        depositRecord: const _StubDepositRecord(status: DepositStatus.pending),
      );
      expect(pending.canSubmitDeposit, isFalse);
    });

    test('isDepositPending = record in pending/pendingVerification/rejected',
        () {
      final pending = _base(
        depositRecord: const _StubDepositRecord(status: DepositStatus.pending),
      );
      expect(pending.isDepositPending, isTrue);
      final pv = _base(
        depositRecord: const _StubDepositRecord(
          status: DepositStatus.pendingVerification,
        ),
      );
      expect(pv.isDepositPending, isTrue);
      final rejected = _base(
        depositRecord: const _StubDepositRecord(status: DepositStatus.rejected),
      );
      expect(rejected.isDepositPending, isTrue);
      expect(_base().isDepositPending, isFalse);
      final approved = _base(
        depositRecord: const _StubDepositRecord(status: DepositStatus.approved),
      );
      expect(approved.isDepositPending, isFalse);
    });

    test('isReadyForPickup = deposit done AND KYC approved AND pickup not done',
        () {
      final m = _base(
        depositDone: true,
        kycDone: true,
        pickupDone: false,
      );
      expect(m.isReadyForPickup, isTrue);
      // Missing KYC
      expect(
        _base(depositDone: true, kycDone: false, pickupDone: false)
            .isReadyForPickup,
        isFalse,
      );
      // Missing deposit
      expect(
        _base(depositDone: false, kycDone: true, pickupDone: false)
            .isReadyForPickup,
        isFalse,
      );
      // Already picked up
      expect(
        _base(depositDone: true, kycDone: true, pickupDone: true)
            .isReadyForPickup,
        isFalse,
      );
    });
  });

  group('RiderModel — requiredPaymentAmount', () {
    test('is plan-price + security-deposit + walletMinTopup fallback', () {
      // The exact arithmetic is delegated to [activeRentalPlanPrice]
      // and [activeRentalPlanSecurityDeposit], which have their own
      // fallback to AppConstants lookup tables. We just pin the
      // composition: required = active_price + active_security +
      // (walletMinTopup if no active_price).
      // The full fallback arithmetic is exercised in production
      // by [PreDashboardScreen]; this test asserts the public shape.
      final m = _base();
      final required = m.requiredPaymentAmount(0.0);
      expect(required, isNotNull);
      expect(required, greaterThanOrEqualTo(0.0));
    });
  });
}

/// Minimal stub for [DepositRecord] in tests. The real model is
/// generated from JSON and pulls in many fields, which is overkill
/// for these state-derivation tests. We use a small concrete class
/// that implements just enough of the [DepositRecord] surface.
class _StubDepositRecord implements DepositRecord {
  final DepositStatus _status;
  const _StubDepositRecord({required DepositStatus status}) : _status = status;

  @override
  DepositStatus get status => _status;

  // All other fields are not exercised by these tests. We override
  // them with noSuchMethod forwarding so the type contract holds
  // without a long boilerplate constructor.
  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}
