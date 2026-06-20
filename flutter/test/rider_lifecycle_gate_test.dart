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
    test('new rider with no intent → intent screen', () {
      final rider = makeRider(registrationDone: false, intent: null);
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.intent);
    });

    test('rider with empty intent → intent screen', () {
      final rider = makeRider(intent: '');
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.intent);
    });

    test('rider with intent but KYC not done → kycForm', () {
      final rider = makeRider(kycDone: false);
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.kycForm);
    });

    test('rider with KYC done but guarantor pending → guarantorForm', () {
      final rider = makeRider(
        kycDone: true,
        guarantorStatus: GuarantorStatus.pending,
      );
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.guarantorForm);
    });

    test('rider with all done but no pickup → preDashboard', () {
      final rider = makeRider(
        kycDone: true,
        guarantorStatus: GuarantorStatus.approved,
      );
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.preDashboard);
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
