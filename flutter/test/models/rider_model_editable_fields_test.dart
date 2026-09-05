// PR-KYC-CORRECTION (2026-09-06): RiderModel must parse, compare, and
// cache `kycEditableFields` — the admin-flagged correction fields — so
// HangTight chips re-render live and survive a cold start.

import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/models/rider_model.dart';

RiderModel _rider({List<String>? editableFields}) => RiderModel(
      riderId: 'r1',
      phone: '9876543210',
      name: 'Test Rider',
      lifecycleStatus: 'PICKUP_SCHEDULED',
      kycStatus: KycStatus.infoRequired,
      kycEditableFields: editableFields,
    );

void main() {
  group('RiderModel kycEditableFields', () {
    test('fromJson parses the top-level flattened list', () {
      // flatten-rider.ts exposes kycProfile.editableFields as a
      // top-level `kycEditableFields` array on /api/rider/profile.
      final rider = RiderModel.fromJson({
        'riderId': 'r1',
        'phone': '9876543210',
        'name': 'Test Rider',
        'lifecycleStatus': 'PICKUP_SCHEDULED',
        'kycStatus': 'INFO_REQUIRED',
        'kycEditableFields': ['fullName', 'aadhaarFront', 'panCard'],
      });
      expect(rider.kycEditableFields,
          ['fullName', 'aadhaarFront', 'panCard']);
    });

    test('fromJson is null-safe when the server omits the field', () {
      final rider = RiderModel.fromJson({
        'riderId': 'r1',
        'phone': '9876543210',
        'name': 'Test Rider',
      });
      expect(rider.kycEditableFields, isNull);
    });

    test('equality breaks when the flagged list changes', () {
      // HangTight watches the rider via select((p) => p.rider); the
      // chips must re-render when admin updates the flags without an
      // updatedAt bump.
      final a = _rider(editableFields: ['fullName']);
      final b = _rider(editableFields: ['fullName', 'dob']);
      final same = _rider(editableFields: ['fullName']);
      expect(a == b, isFalse, reason: 'flag change must break equality');
      expect(a == same, isTrue, reason: 'identical flags must be equal');
      expect(_rider(editableFields: null) == _rider(editableFields: null),
          isTrue);
    });

    test('cache round-trip preserves the flagged list', () {
      final rider = _rider(editableFields: ['fullName', 'currentAddress']);
      final restored = RiderModel.fromCacheMap(rider.toCacheMap());
      expect(restored.kycEditableFields, ['fullName', 'currentAddress']);
    });

    test('cache round-trip handles a null flagged list', () {
      final restored = RiderModel.fromCacheMap(_rider().toCacheMap());
      expect(restored.kycEditableFields, isNull);
    });
  });
}
