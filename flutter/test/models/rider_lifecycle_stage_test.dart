// PR-K.2 — Rider lifecycle stage enum + mapping tests.
//
// Validates the Flutter `RiderLifecycleStage` enum and the
// `lifecycleStageFromStatus` mapping. Mirrors the PR-K.1 migration
// (5-value stage; 15-value legacy status maps to 5-value stage).
//
// Run: flutter test test/models/rider_lifecycle_stage_test.dart

import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/models/rider_lifecycle_stage.dart';

void main() {
  group('RiderLifecycleStage enum', () {
    test('has exactly 5 values', () {
      expect(RiderLifecycleStage.values.length, 5);
    });

    test('enum names match the Prisma backend values', () {
      expect(RiderLifecycleStage.newRider.name, 'newRider');
      expect(RiderLifecycleStage.inProgress.name, 'inProgress');
      expect(RiderLifecycleStage.active.name, 'active');
      expect(RiderLifecycleStage.paused.name, 'paused');
      expect(RiderLifecycleStage.closed.name, 'closed');
    });
  });

  group('parseRiderLifecycleStage', () {
    test('parses all 5 backend stage values', () {
      expect(parseRiderLifecycleStage('NEW'), RiderLifecycleStage.newRider);
      expect(parseRiderLifecycleStage('IN_PROGRESS'),
          RiderLifecycleStage.inProgress);
      expect(parseRiderLifecycleStage('ACTIVE'), RiderLifecycleStage.active);
      expect(parseRiderLifecycleStage('PAUSED'), RiderLifecycleStage.paused);
      expect(parseRiderLifecycleStage('CLOSED'), RiderLifecycleStage.closed);
    });

    test('null returns newRider (defensive default)', () {
      expect(parseRiderLifecycleStage(null), RiderLifecycleStage.newRider);
    });

    test('empty string returns newRider', () {
      expect(parseRiderLifecycleStage(''), RiderLifecycleStage.newRider);
    });

    test('unknown value returns newRider (does NOT throw)', () {
      expect(parseRiderLifecycleStage('UNKNOWN_VALUE'),
          RiderLifecycleStage.newRider);
    });
  });

  group('riderLifecycleStageToString (round-trip)', () {
    test('every enum value round-trips through parseRiderLifecycleStage', () {
      for (final stage in RiderLifecycleStage.values) {
        final str = riderLifecycleStageToString(stage);
        final back = parseRiderLifecycleStage(str);
        expect(back, stage, reason: '$stage -> $str -> $back');
      }
    });

    test('serialized strings match the Prisma enum values', () {
      expect(riderLifecycleStageToString(RiderLifecycleStage.newRider), 'NEW');
      expect(riderLifecycleStageToString(RiderLifecycleStage.inProgress),
          'IN_PROGRESS');
      expect(riderLifecycleStageToString(RiderLifecycleStage.active), 'ACTIVE');
      expect(riderLifecycleStageToString(RiderLifecycleStage.paused), 'PAUSED');
      expect(riderLifecycleStageToString(RiderLifecycleStage.closed), 'CLOSED');
    });
  });

  group('lifecycleStageFromStatus (legacy 15-value mapping)', () {
    test('NEW maps to newRider', () {
      expect(lifecycleStageFromStatus('NEW'), RiderLifecycleStage.newRider);
    });

    test('all in-progress states map to inProgress', () {
      const inProgressStates = [
        'PHONE_VERIFIED',
        'PROFILE_SUBMITTED',
        'KYC_SUBMITTED',
        'KYC_APPROVED',
        'GUARANTOR_SUBMITTED',
        'GUARANTOR_APPROVED',
        'DEPOSIT_PENDING',
        'DEPOSIT_APPROVED',
        'PLAN_SELECTED',
        'PICKUP_SCHEDULED',
      ];
      for (final s in inProgressStates) {
        expect(
          lifecycleStageFromStatus(s),
          RiderLifecycleStage.inProgress,
          reason: '$s should map to inProgress',
        );
      }
    });

    test('ACTIVE maps to active', () {
      expect(lifecycleStageFromStatus('ACTIVE'), RiderLifecycleStage.active);
    });

    test('paused states map to paused', () {
      expect(lifecycleStageFromStatus('SUSPENDED'), RiderLifecycleStage.paused);
      expect(lifecycleStageFromStatus('RETURN_PENDING'),
          RiderLifecycleStage.paused);
    });

    test('CLOSED maps to closed', () {
      expect(lifecycleStageFromStatus('CLOSED'), RiderLifecycleStage.closed);
    });

    test('null and empty return newRider', () {
      expect(lifecycleStageFromStatus(null), RiderLifecycleStage.newRider);
      expect(lifecycleStageFromStatus(''), RiderLifecycleStage.newRider);
    });

    test('unknown status returns newRider (defensive)', () {
      expect(lifecycleStageFromStatus('FOO_BAR'), RiderLifecycleStage.newRider);
    });
  });

  group('consistency with PR-K.1 migration', () {
    test('all 15 lifecycleStatus values are mapped (no gaps)', () {
      const allStatuses = [
        'NEW',
        'PHONE_VERIFIED',
        'PROFILE_SUBMITTED',
        'KYC_SUBMITTED',
        'KYC_APPROVED',
        'GUARANTOR_SUBMITTED',
        'GUARANTOR_APPROVED',
        'DEPOSIT_PENDING',
        'DEPOSIT_APPROVED',
        'PLAN_SELECTED',
        'PICKUP_SCHEDULED',
        'ACTIVE',
        'SUSPENDED',
        'RETURN_PENDING',
        'CLOSED',
      ];
      for (final s in allStatuses) {
        final stage = lifecycleStageFromStatus(s);
        expect(
          stage,
          isA<RiderLifecycleStage>(),
          reason: '$s should map to a valid stage',
        );
      }
    });
  });
}
