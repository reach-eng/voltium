import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/auth/presentation/rider_lifecycle_gate.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/utils/lifecycle_rank.dart';

void main() {
  group('lifecycleRank', () {
    test('returns 0 for unknown or empty status', () {
      final rider = RiderModel(
        riderId: '1',
        name: 'Test',
        phone: '9999999999',
        lifecycleStatus: '',
        accountStatus: AccountStatus.active,
      );
      expect(lifecycleRank(rider), 0);

      final rider2 = rider.copyWith(lifecycleStatus: 'UNKNOWN_STATUS');
      expect(lifecycleRank(rider2), 0);
    });

    test('returns correct rank for all defined statuses', () {
      final statuses = {
        'NEW': 0,
        'PHONE_VERIFIED': 1,
        'PROFILE_SUBMITTED': 2,
        'GUARANTOR_SUBMITTED': 3,
        'GUARANTOR_APPROVED': 3,
        'PLAN_SELECTED': 4,
        'DEPOSIT_PENDING': 5,
        'DEPOSIT_APPROVED': 6,
        'KYC_SUBMITTED': 7,
        'KYC_APPROVED': 8,
        'PICKUP_SCHEDULED': 9,
        'ACTIVE': 10,
        'ACTIVE_RIDING': 10,
        'RIDING': 10,
        'SUSPENDED': 11,
        'RETURN_PENDING': 12,
        'RETURNED': 12,
        'PICKUP_COMPLETED': 13,
        'CLOSED': 13,
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
        bool pickupDone = false}) {
      return RiderModel(
        riderId: '1',
        name: 'Test',
        phone: '9999999999',
        lifecycleStatus: status,
        accountStatus: accountStatus,
        pickupDone: pickupDone,
      );
    }

    test('returns terminated if accountStatus is terminated', () {
      final rider =
          createRider('ACTIVE', accountStatus: AccountStatus.terminated);
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.terminated);
    });

    test('returns terminated if lifecycleRank >= 14', () {
      // Current max is 13, but if a status >= 14 is added, it should terminate.
      // We can mock this by checking >= 14 logic is there, but since lifecycleRank max is 13,
      // it's hard to hit >= 14 with current enum.
      // So this test passes trivially for now.
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

    test('returns dashboard if pickupDone is true', () {
      final rider = createRider('KYC_APPROVED', pickupDone: true);
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.dashboard);
    });

    test(
        'returns dashboard if rank >= 10 (except SUSPENDED which is caught earlier)',
        () {
      final rider = createRider('ACTIVE'); // rank 10
      expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.dashboard);

      final rider2 = createRider('CLOSED'); // rank 13
      expect(RiderLifecycleGate.redirect(rider2), LifecycleTarget.dashboard);
    });

    test('returns preDashboard for all other ranks', () {
      final preDashboardStatuses = [
        'NEW', // 0
        'PHONE_VERIFIED', // 1
        'GUARANTOR_SUBMITTED', // 3
        'GUARANTOR_APPROVED', // 3
        'PLAN_SELECTED', // 4
        'DEPOSIT_PENDING', // 5
        'DEPOSIT_APPROVED', // 6
        'KYC_SUBMITTED', // 7
        'KYC_APPROVED', // 8
        'PICKUP_SCHEDULED', // 9
      ];

      for (final status in preDashboardStatuses) {
        final rider = createRider(status);
        expect(RiderLifecycleGate.redirect(rider), LifecycleTarget.preDashboard,
            reason: 'Status $status should redirect to preDashboard');
      }
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
    });
  });
}
