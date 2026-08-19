/// Tests for RiderLifecycleGate — pure lifecycle routing logic.
///
/// These are pure Dart unit tests with no Flutter widget testing overhead.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/auth/presentation/rider_lifecycle_gate.dart';
import 'package:voltium_rider/models/rider_model.dart';

/// Helper to create a RiderModel with overridden defaults.
RiderModel makeRider({
  bool pickupDone = false,
  bool registrationDone = true,
  bool kycDone = false,
  String? intent = 'personal',
  GuarantorStatus guarantorStatus = GuarantorStatus.pending,
  AccountStatus accountStatus = AccountStatus.preActive,
  String lifecycleStatus = 'NEW',
}) {
  return RiderModel(
    riderId: 'VF-RD-TEST',
    phone: '9876543210',
    name: 'Test Rider',
    pickupDone: pickupDone,
    registrationDone: registrationDone,
    kycDone: kycDone,
    intent: intent,
    guarantorStatus: guarantorStatus,
    accountStatus: accountStatus,
    lifecycleStatus: lifecycleStatus,
  );
}

void main() {
  group('RiderLifecycleGate.redirect', () {
    test('new rider with no intent -> intent', () {
      final rider = makeRider(registrationDone: false, intent: null);
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.intent);
    });

    test('rider with empty intent -> intent', () {
      final rider = makeRider(intent: '');
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.intent);
    });

    test(
        'PR-ONBOARDING-FLOW-2026-08-12: GUARANTOR_APPROVED (rank 6) → choosePlan',
        () {
      // PR-ONBOARDING-FLOW-2026-08-12: in the new active path, rank 6
      // (GUARANTOR_APPROVED) advances to plan selection — the rider
      // can pick a plan while the guarantor is being reviewed. The
      // older flow's pre-dashboard wait is no longer in the active
      // path.
      final rider =
          makeRider(kycDone: false, lifecycleStatus: 'GUARANTOR_APPROVED');
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.choosePlan);
    });

    test('rider with KYC done but guarantor pending → guarantorForm', () {
      final rider = makeRider(
        kycDone: true,
        guarantorStatus: GuarantorStatus.pending,
        lifecycleStatus: 'PROFILE_SUBMITTED',
      );
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.guarantorForm);
    });

    test('PR-ONBOARDING-FLOW-2026-08-12: KYC_APPROVED (rank 4) → guarantorForm',
        () {
      // PR-ONBOARDING-FLOW-2026-08-12: in the new active path, rank 4
      // (KYC_APPROVED) advances to the guarantor form — KYC review
      // and guarantor filling run in parallel. The older flow's
      // pre-dashboard wait is no longer in the active path.
      final rider = makeRider(
        kycDone: true,
        guarantorStatus: GuarantorStatus.approved,
        lifecycleStatus: 'KYC_APPROVED',
      );
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.guarantorForm);
    });

    test('rider with pickup done → dashboard', () {
      final rider = makeRider(pickupDone: true);
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.dashboard);
    });

    test('suspended rider → suspended (overrides everything)', () {
      final rider = makeRider(
        pickupDone: true,
        accountStatus: AccountStatus.suspended,
      );
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.suspended);
    });

    test('terminated rider → terminated', () {
      final rider = makeRider(
        pickupDone: false,
        accountStatus: AccountStatus.terminated,
      );
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.terminated);
    });

    test('closed lifecycle status → terminated', () {
      final rider = makeRider(
        pickupDone: true,
        lifecycleStatus: 'CLOSED',
      );
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.terminated);
    });
  });

  group('RiderLifecycleGate.canAccessDashboard', () {
    test('returns true for active rider with pickup done', () {
      final rider = makeRider(pickupDone: true);
      expect(RiderLifecycleGate.canAccessDashboard(rider), isTrue);
    });

    test('returns false for rider in onboarding', () {
      final rider = makeRider(kycDone: false);
      expect(RiderLifecycleGate.canAccessDashboard(rider), isFalse);
    });
  });

  group('RiderLifecycleGate.isOnboarding', () {
    test('returns true for rider in KYC flow', () {
      final rider = makeRider(kycDone: false);
      expect(RiderLifecycleGate.isOnboarding(rider), isTrue);
    });

    test('returns true for rider in guarantor flow', () {
      final rider = makeRider(
        kycDone: true,
        guarantorStatus: GuarantorStatus.pending,
      );
      expect(RiderLifecycleGate.isOnboarding(rider), isTrue);
    });

    test('returns false for fully onboarded rider', () {
      final rider = makeRider(pickupDone: true);
      expect(RiderLifecycleGate.isOnboarding(rider), isFalse);
    });
  });
}
