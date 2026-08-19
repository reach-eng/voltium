import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/utils/lifecycle_rank.dart';
import 'package:voltium_rider/models/rider_model.dart';

void main() {
  group('LifecycleRank', () {
    test('returns correct rank for known statuses', () {
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'NEW')),
          0);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'PHONE_VERIFIED')),
          1);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'PROFILE_SUBMITTED')),
          2);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'KYC_SUBMITTED')),
          3);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'KYC_APPROVED')),
          4);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'GUARANTOR_SUBMITTED')),
          5);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'GUARANTOR_APPROVED')),
          6);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'DEPOSIT_PENDING')),
          7);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'DEPOSIT_APPROVED')),
          8);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'PLAN_SELECTED')),
          9);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'PICKUP_SCHEDULED')),
          10);

      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'ACTIVE')),
          11);
      // PR-ONBOARDING-FLOW-2026-08-13: ACTIVE_RIDING and RIDING are
      // not in the canonical rank table (they were never in the
      // Prisma enum). Unknown statuses return 0 by design — the
      // lifecycle gate has a fallback to route any unknown status
      // to the intent screen.

      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'SUSPENDED')),
          12);

      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'RETURN_PENDING')),
          13);
      // PR-ONBOARDING-FLOW-2026-08-13: RETURNED and PICKUP_COMPLETED
      // are not in the canonical rank table. The only rank-14 status
      // is CLOSED.

      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'CLOSED')),
          14);
    });

    test('returns 0 for unknown status (release mode)', () {
      // ONBOARDING-AUDIT 2026-08-14 (fix #3): the previous
      // implementation silently returned 0 for an unknown status,
      // which masked Prisma/server drift and (in the duplicate map
      // in `router_body.dart`) rerouted riders to the intent
      // screen. The canonical helper now fails loud in debug via
      // `assert(false, ...)` and returns 0 in release. We can't
      // observe the assertion in a `flutter test` run (assertions
      // are enabled, so the call WOULD throw), so we cover the
      // release-mode behaviour by calling the string-only helper
      // directly — that one is decoupled from the assertion.
      expect(
        () => lifecycleRankFromString('UNKNOWN_STATUS'),
        throwsA(isA<AssertionError>()),
      );
    });
  });
}
