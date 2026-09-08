import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/models/upcoming_rent_prompt.dart';

void main() {
  group('RiderModel.copyWith field preservation (dashboard P0)', () {
    RiderModel base() => RiderModel(
          riderId: 'RDR001',
          phone: '9876543210',
          name: 'Test Rider',
          referralCode: 'TEST0001',
          totalRewardPoints: 250,
          upcomingRentPrompt: UpcomingRentPrompt(
            showPrompt: true,
            leaseId: 'lease_1',
            rentAmountInRupees: 500,
            walletBalanceInRupees: 100,
            shortfallInRupees: 400,
            recommendedTopUpRupees: 400,
            dueDate: DateTime(2026, 9, 8),
            dueTimeFormatted: 'Due today at 6:00 AM',
            requiresTopUp: true,
          ),
        );

    test('copyWith(intent) preserves referral, rewards, rent prompt', () {
      final updated = base().copyWith(intent: 'Personal Use');

      expect(updated.intent, 'Personal Use');
      expect(updated.referralCode, 'TEST0001');
      expect(updated.totalRewardPoints, 250);
      expect(updated.upcomingRentPrompt, isNotNull);
      expect(updated.upcomingRentPrompt!.shortfallInRupees, 400);
    });

    test('copyWith can still overwrite those fields explicitly', () {
      final updated = base().copyWith(referralCode: 'NEW0002');

      expect(updated.referralCode, 'NEW0002');
      expect(updated.totalRewardPoints, 250);
    });

    test('fromCacheMap round-trips the cached referral code', () {
      final cached = base().toCacheMap();
      final restored =
          RiderModel.fromCacheMap(Map<String, dynamic>.from(cached));

      expect(restored.referralCode, 'TEST0001');
    });
  });
}
