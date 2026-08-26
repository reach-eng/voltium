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
          7);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'KYC_APPROVED')),
          8);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'GUARANTOR_SUBMITTED')),
          3);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'GUARANTOR_APPROVED')),
          3);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'DEPOSIT_PENDING')),
          5);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'DEPOSIT_APPROVED')),
          6);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'PLAN_SELECTED')),
          4);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'PICKUP_SCHEDULED')),
          9);

      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'ACTIVE')),
          10);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'ACTIVE_RIDING')),
          10);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'RIDING')),
          10);

      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'SUSPENDED')),
          11);

      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'RETURN_PENDING')),
          12);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'RETURNED')),
          12);

      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'PICKUP_COMPLETED')),
          13);
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'CLOSED')),
          13);
    });

    test('returns 0 for unknown status', () {
      expect(
          lifecycleRank(const RiderModel(
              riderId: '1',
              phone: '123',
              name: 'John',
              lifecycleStatus: 'UNKNOWN_STATUS')),
          0);
    });
  });
}
