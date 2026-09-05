import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/core/navigation/app_state.dart';
import 'package:voltium_rider/features/auth/domain/entity.dart';
import 'package:voltium_rider/features/auth/presentation/rider_lifecycle_gate.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/utils/lifecycle_rank.dart';

void main() {
  group('lifecycleRank', () {
    test('fails loud on unknown or empty status (debug mode)', () {
      // ONBOARDING-AUDIT 2026-08-14 (fix #3): the previous
      // implementation silently returned 0 for an unknown status,
      // which masked Prisma/server drift and (in the duplicate map
      // in `router_body.dart`) rerouted riders to the intent
      // screen. The canonical helper now fails loud in debug via
      // `assert(false, ...)` and returns 0 in release. Empty
      // statuses are also rejected — the lifecycle gate normalises
      // these upstream.
      for (final status in ['', 'UNKNOWN_STATUS']) {
        final rider = RiderModel(
          riderId: '1',
          name: 'Test',
          phone: '9999999999',
          lifecycleStatus: status,
          accountStatus: AccountStatus.active,
        );
        expect(() => lifecycleRank(rider), throwsA(isA<AssertionError>()),
            reason: 'Unknown/empty status "$status" should fail loud');
      }
    });

    test('returns correct rank for all defined statuses', () {
      final statuses = {
        'NEW': 0,
        'PHONE_VERIFIED': 1,
        'PROFILE_SUBMITTED': 2,
        'KYC_SUBMITTED': 3,
        'KYC_APPROVED': 4,
        'GUARANTOR_SUBMITTED': 5,
        'GUARANTOR_APPROVED': 6,
        'DEPOSIT_PENDING': 7,
        'DEPOSIT_APPROVED': 8,
        'PLAN_SELECTED': 9,
        'PICKUP_SCHEDULED': 10,
        'ACTIVE': 11,
        'SUSPENDED': 12,
        'RETURN_PENDING': 13,
        'CLOSED': 14,
        // PR-ONBOARDING-FLOW-2026-08-13: ACTIVE_RIDING, RIDING,
        // RETURNED, PICKUP_COMPLETED, TERMINATED were removed from
        // the rank table (they were never in the Prisma enum and
        // were dead code). The canonical table now matches the
        // server's `web/src/lib/lifecycle-ranks.ts` exactly.
      };

      for (final entry in statuses.entries) {
        final rider = RiderModel(
          riderId: '1',
          name: 'Test',
          phone: '9999999999',
          lifecycleStatus: entry.key,
          accountStatus: AccountStatus.active,
        );
        expect(lifecycleRank(rider), entry.value,
            reason: 'Status ${entry.key} should have rank ${entry.value}');
      }
    });
  });

  group('RiderLifecycleGate.redirect', () {
    RiderModel createRider(String status,
        {AccountStatus accountStatus = AccountStatus.active,
        bool pickupDone = false,
        KycStatus kycStatus = KycStatus.pending,
        DepositStatus depositStatus = DepositStatus.pending,
        double securityDeposit = 0.0}) {
      return RiderModel(
        riderId: '1',
        name: 'Test',
        phone: '9999999999',
        lifecycleStatus: status,
        accountStatus: accountStatus,
        pickupDone: pickupDone,
        kycStatus: kycStatus,
        depositStatus: depositStatus,
        securityDeposit: securityDeposit,
      );
    }

    test('returns terminated if accountStatus is terminated', () {
      final rider =
          createRider('ACTIVE', accountStatus: AccountStatus.terminated);
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.terminated);
    });

    test('returns terminated if lifecycleRank >= 14 (CLOSED)', () {
      // PR-ONBOARDING-FLOW-2026-08-13: CLOSED is rank 14 and is
      // terminal. The previous test passed trivially because
      // PICKUP_COMPLETED (also rank 14) was removed and there was no
      // way to reach rank 14 in the production code path. Now
      // CLOSED is the canonical rank-14 status.
      final rider = createRider('CLOSED');
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.terminated);
    });

    test('returns suspended if accountStatus is suspended', () {
      final rider =
          createRider('ACTIVE', accountStatus: AccountStatus.suspended);
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.suspended);
    });

    test('returns suspended if lifecycleStatus is SUSPENDED', () {
      final rider = createRider('SUSPENDED');
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.suspended);
    });

    test('returns guarantorForm if rank is 2 (PROFILE_SUBMITTED)', () {
      final rider = createRider('PROFILE_SUBMITTED');
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.guarantorForm);
    });

    test(
        'PR-HANGTIGHT-2026-09-06: pickupDone alone does NOT grant dashboard',
        () {
      // The server computes pickupDone = isActivated || pickedUpAt, so
      // every picked-up rider has pickupDone=true while their KYC /
      // deposit approvals may still be pending. The gate must key on
      // the strict approval getters (or rank >= 11), not pickupDone.
      final rider = createRider('KYC_APPROVED', pickupDone: true);
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.guarantorForm);
    });

    test(
        'returns dashboard if rank >= 10 (except SUSPENDED which is caught earlier and rank >= 13 which is terminated)',
        () {
      final rider = createRider('ACTIVE'); // rank 11
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.dashboard);
    });

    test('returns intent for rank < 2', () {
      final intentStatuses = [
        'NEW', // 0
        'PHONE_VERIFIED', // 1
      ];

      for (final status in intentStatuses) {
        final rider = createRider(status);
        expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.intent,
            reason: 'Status $status should redirect to intent');
      }
    });

    test('PR-ONBOARDING-FLOW-2026-08-12: rank 3-4 map to guarantorForm', () {
      // KYC is in review or approved. The active path runs KYC review
      // in parallel with the guarantor form, so the rider proceeds to
      // guarantor next.
      for (final status in ['KYC_SUBMITTED', 'KYC_APPROVED']) {
        final rider = createRider(status);
        expect(
            RiderLifecycleGate.redirect(rider), LifecycleTarget.guarantorForm,
            reason:
                'Status $status (rank 3-4) should redirect to guarantorForm');
      }
    });

    test('PR-ONBOARDING-FLOW-2026-08-12: rank 5-6 map to choosePlan', () {
      // Guarantor is in-flight or approved. The active path advances to
      // plan selection next.
      for (final status in ['GUARANTOR_SUBMITTED', 'GUARANTOR_APPROVED']) {
        final rider = createRider(status);
        expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.choosePlan,
            reason: 'Status $status (rank 5-6) should redirect to choosePlan');
      }
    });

    test('PR-ONBOARDING-FLOW-2026-08-12: rank 7-8 map to planSuccess', () {
      // DEPOSIT_PENDING / DEPOSIT_APPROVED from the older flow. The
      // rider has already paid the deposit; the new flow continues to
      // the plan-success confirmation and the pickup hub.
      for (final status in ['DEPOSIT_PENDING', 'DEPOSIT_APPROVED']) {
        final rider = createRider(status);
        expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.planSuccess,
            reason: 'Status $status (rank 7-8) should redirect to planSuccess');
      }
    });

    test(
        'PR-ONBOARDING-FLOW-2026-08-13: rank 9 (PLAN_SELECTED) maps to topUpAmount',
        () {
      // PLAN_SELECTED: the rider has selected a plan. In the new
      // flow the next step is the Enter Amount screen (topUpAmount),
      // which auto-fills the required amount from the plan +
      // advance-rent flag. The deposit itself does not bump the rank
      // in the new flow.
      final rider = createRider('PLAN_SELECTED');
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.topUpAmount,
          reason: 'PLAN_SELECTED (rank 9) should redirect to topUpAmount');
    });

    test(
        'PR-AUDIT 2026-08-12 (H3): PLAN_SELECTED + depositDone=true → pickupHub, not topUpAmount',
        () {
      // The active path's deposit doesn't bump the rank (the server
      // bumps to DEPOSIT_PENDING in the same transaction, but the
      // client may observe the pre-bump state for one refresh).
      // A rider who killed the app mid-deposit and re-launched would
      // land at PLAN_SELECTED with depositDone=true; the gate MUST
      // route them to pickupHub, not topUpAmount, or they'll submit
      // a duplicate SECURITY_DEPOSIT transaction.
      final rider = RiderModel(
        riderId: '1',
        name: 'Test',
        phone: '9999999999',
        lifecycleStatus: 'PLAN_SELECTED',
        accountStatus: AccountStatus.active,
        depositDone: true,
      );
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.pickupHub,
          reason: 'PLAN_SELECTED + depositDone should skip topUpAmount');
    });

    test(
        'PR-ONBOARDING-FLOW-2026-08-12: preDashboard is no longer in the active path',
        () {
      // The active path's rank 3-9 mapping is exhaustive — none of
      // these ranks fall through to preDashboard. Pre-dashboard is
      // only reached for the suspended/terminated case (or by admin
      // tooling routing to the archived older flow).
      final activePathStatuses = [
        'KYC_SUBMITTED', // 3
        'KYC_APPROVED', // 4
        'GUARANTOR_SUBMITTED', // 5
        'GUARANTOR_APPROVED', // 6
        'DEPOSIT_PENDING', // 7
        'DEPOSIT_APPROVED', // 8
        'PLAN_SELECTED', // 9
      ];

      for (final status in activePathStatuses) {
        final rider = createRider(status);
        expect(RiderLifecycleGate.redirect(rider),
            isNot(equals(LifecycleTarget.preDashboard)),
            reason: 'Status $status should NOT redirect to preDashboard '
                'in the new active path');
      }
    });

    test('returns hangTight for PICKUP_SCHEDULED (rank 10) with !pickupDone',
        () {
      // PR-ONBOARDING-FLOW-2026-08-11: the rider submitted the pickup
      // form (pickupVerification onNext → hangTight) and is waiting for
      // admin to flip them to ACTIVE. The new flow's tail state.
      final rider = createRider('PICKUP_SCHEDULED', pickupDone: false);
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.hangTight);
    });

    test(
        'PR-HANGTIGHT-2026-09-06: rank 10 + pickupDone but approvals pending → hangTight',
        () {
      // The old behavior routed rank-10 riders with pickupDone=true
      // straight to the dashboard, skipping the admin-approval wait.
      // pickupDone is true for every picked-up rider (server ORs
      // pickedUpAt), so it must not gate the dashboard.
      final rider = createRider('PICKUP_SCHEDULED', pickupDone: true);
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.hangTight);
    });

    test(
        'PR-HANGTIGHT-2026-09-06: rank 10 + both approvals approved → dashboard',
        () {
      final rider = createRider(
        'PICKUP_SCHEDULED',
        pickupDone: true,
        kycStatus: KycStatus.approved,
        depositStatus: DepositStatus.approved,
      );
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.dashboard);
    });

    test(
        'PR-HANGTIGHT-2026-09-06: rank 10 + credited deposit (securityDeposit > 0) + kyc approved → dashboard',
        () {
      // Mirrors the server's isDepositApproved:
      // depositStatus === 'APPROVED' || securityDepositInPaise > 0.
      final rider = createRider(
        'PICKUP_SCHEDULED',
        kycStatus: KycStatus.approved,
        securityDeposit: 2000,
      );
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.dashboard);
    });

    test(
        'PR-HANGTIGHT-2026-09-06: rank 10 + only KYC approved → hangTight',
        () {
      final rider = createRider(
        'PICKUP_SCHEDULED',
        kycStatus: KycStatus.approved,
        depositStatus: DepositStatus.pendingVerification,
      );
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.hangTight);
    });

    test(
        'PR-HANGTIGHT-2026-09-06: rank 10 + only deposit approved → hangTight',
        () {
      final rider = createRider(
        'PICKUP_SCHEDULED',
        depositStatus: DepositStatus.approved,
      );
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.hangTight);
    });
  });

  group('RiderLifecycleGate helpers', () {
    test('canAccessDashboard works correctly', () {
      final riderActive = RiderModel(
        riderId: '1',
        name: 'Test',
        phone: '999',
        lifecycleStatus: 'ACTIVE',
        accountStatus: AccountStatus.active,
        pickupDone: true,
      );
      expect(RiderLifecycleGate.canAccessDashboard(riderActive), true);

      final riderNew =
          riderActive.copyWith(lifecycleStatus: 'NEW', pickupDone: false);
      expect(RiderLifecycleGate.canAccessDashboard(riderNew), false);
    });

    test('isOnboarding works correctly', () {
      final riderNew = RiderModel(
        riderId: '1',
        name: 'Test',
        phone: '999',
        lifecycleStatus: 'NEW',
        accountStatus: AccountStatus.active,
      );
      expect(RiderLifecycleGate.isOnboarding(riderNew), true);

      final riderProfileSubmitted =
          riderNew.copyWith(lifecycleStatus: 'PROFILE_SUBMITTED');
      expect(RiderLifecycleGate.isOnboarding(riderProfileSubmitted), true);

      final riderActive =
          riderNew.copyWith(lifecycleStatus: 'ACTIVE', pickupDone: true);
      expect(RiderLifecycleGate.isOnboarding(riderActive), false);

      // PR-ONBOARDING-FLOW-2026-08-11: a rider in PICKUP_SCHEDULED
      // (rank 10, !pickupDone) is still "onboarding" — they're on the
      // hangTight wait surface, not on the active dashboard.
      final riderPickedUpButNotActive = RiderModel(
        riderId: '1',
        name: 'Test',
        phone: '999',
        lifecycleStatus: 'PICKUP_SCHEDULED',
        accountStatus: AccountStatus.active,
        pickupDone: false,
      );
      expect(
        RiderLifecycleGate.isOnboarding(riderPickedUpButNotActive),
        true,
        reason: 'PICKUP_SCHEDULED with !pickupDone is still onboarding '
            '(hangTight is part of the onboarding flow)',
      );
    });

    test('redirectAppState returns explicit AppState subclasses', () {
      final terminatedRider = RiderModel(
        riderId: '1',
        name: 'Test',
        phone: '999',
        accountStatus: AccountStatus.terminated,
      );
      expect(RiderLifecycleGate.redirectAppState(terminatedRider),
          isA<AccountClosed>());

      final guarantorRider = RiderModel(
        riderId: '1',
        name: 'Test',
        phone: '999',
        lifecycleStatus: 'PROFILE_SUBMITTED',
        accountStatus: AccountStatus.active,
      );
      expect(RiderLifecycleGate.redirectAppState(guarantorRider),
          const Onboarding(OnboardingStep.guarantor));

      final activeRider = RiderModel(
        riderId: '1',
        name: 'Test',
        phone: '999',
        lifecycleStatus: 'ACTIVE',
        accountStatus: AccountStatus.active,
        pickupDone: true,
      );
      expect(RiderLifecycleGate.redirectAppState(activeRider),
          isA<ActiveDashboard>());

      final newRider = RiderModel(
        riderId: '1',
        name: 'Test',
        phone: '999',
        lifecycleStatus: 'NEW',
        accountStatus: AccountStatus.active,
      );
      expect(RiderLifecycleGate.redirectAppState(newRider),
          const Onboarding(OnboardingStep.kycSubmit));

      // PR-ONBOARDING-FLOW-2026-08-11: PICKUP_SCHEDULED with !pickupDone
      // maps to the new HangTight sealed-class state.
      final hangTightRider = RiderModel(
        riderId: '1',
        name: 'Test',
        phone: '999',
        lifecycleStatus: 'PICKUP_SCHEDULED',
        accountStatus: AccountStatus.active,
        pickupDone: false,
      );
      expect(RiderLifecycleGate.redirectAppState(hangTightRider),
          const HangTight());
    });

    test('VerifyOtpResult.determineAppState works correctly', () {
      const resultNew = VerifyOtpResult(isNewRider: true);
      expect(resultNew.determineAppState(),
          const Onboarding(OnboardingStep.kycSubmit));

      const resultExisting =
          VerifyOtpResult(isNewRider: false, nextState: PreDashboard());
      expect(resultExisting.determineAppState(), const PreDashboard());

      final activeRider = RiderModel(
        riderId: '1',
        name: 'Test',
        phone: '999',
        lifecycleStatus: 'ACTIVE',
        accountStatus: AccountStatus.active,
        pickupDone: true,
      );
      expect(resultExisting.determineAppState(activeRider),
          isA<ActiveDashboard>());
    });
  });
}
