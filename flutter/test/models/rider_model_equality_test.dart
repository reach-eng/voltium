// Regression test: RiderModel.== should detect activation transitions
//
// The bug: RiderModel.== only compared id + updatedAt. If the API
// returned two responses that happened to share the same id and
// updatedAt but differ in pickupDone (e.g., the server cache served
// the pre-activation response after admin flipped the rider to ACTIVE),
// Riverpod's `select` saw them as equal and the hangTight auto-redirect
// never fired.
//
// This test locks the contract: pickupDone and lifecycleStatus are part
// of the equality contract, so any watch that selects the rider and
// checks those fields re-fires on a real change.
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/models/rider_model.dart';

void main() {
  group('RiderModel equality', () {
    final baseMap = {
      'id': 'rider-1',
      'phone': '+919999999999',
      'lifecycleStatus': 'PICKUP_SCHEDULED',
      'pickupDone': false,
      'kycStatus': 'APPROVED',
      'depositStatus': 'APPROVED',
      'planDone': true,
      'kycDone': true,
      'depositDone': true,
      'updatedAt': '2026-08-12T08:00:00.000Z',
    };

    test('rider with same id+updatedAt but different pickupDone is NOT equal',
        () {
      final a = RiderModel.fromJson(Map<String, dynamic>.from(baseMap));
      final b = RiderModel.fromJson({
        ...baseMap,
        'pickupDone':
            true, // admin flipped to ACTIVE; pickupDone lands via pickedUpAt
        'lifecycleStatus': 'ACTIVE',
      });
      expect(a, isNot(equals(b)),
          reason: 'lifecycleStatus and pickupDone must be part of equality');
    });

    test('rider with truly identical data is equal', () {
      final a = RiderModel.fromJson(Map<String, dynamic>.from(baseMap));
      final b = RiderModel.fromJson(Map<String, dynamic>.from(baseMap));
      expect(a, equals(b));
    });

    test('rider with different updatedAt is NOT equal', () {
      final a = RiderModel.fromJson(Map<String, dynamic>.from(baseMap));
      final b = RiderModel.fromJson({
        ...baseMap,
        'updatedAt': '2026-08-12T09:00:00.000Z',
      });
      expect(a, isNot(equals(b)));
    });

    test('rider with only lifecycleStatus change is NOT equal', () {
      final a = RiderModel.fromJson(Map<String, dynamic>.from(baseMap));
      final b = RiderModel.fromJson({
        ...baseMap,
        'lifecycleStatus': 'ACTIVE',
      });
      expect(a, isNot(equals(b)),
          reason: 'lifecycleStatus must be part of equality (drives routing)');
    });
  });
}
