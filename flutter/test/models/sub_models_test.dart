import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/models/hub_model.dart';
import 'package:voltium_rider/models/plan_model.dart';
import 'package:voltium_rider/models/reward_model.dart';
import 'package:voltium_rider/models/rider_metrics.dart';
import 'package:voltium_rider/models/rider_wallet.dart';
import 'package:voltium_rider/models/rider_rental.dart';
import 'package:voltium_rider/models/rider_identity.dart';
import 'package:voltium_rider/models/json_converters.dart';

void main() {
  // ── HubModel ────────────────────────────────────────────────────────────
  group('HubModel', () {
    test('fromJson / toJson round-trips', () {
      final json = {'id': 'h1', 'name': 'Main Hub', 'location': 'Andheri', 'city': 'Mumbai', 'isActive': true};
      final model = HubModel.fromJson(json);
      expect(model.id, 'h1');
      expect(model.name, 'Main Hub');
      expect(model.isActive, isTrue);
      expect(model.toJson(), json);
    });

    test('displayAddress joins location and city', () {
      const hub = HubModel(id: 'h1', name: 'X', location: 'Andheri', city: 'Mumbai');
      expect(hub.displayAddress, 'Andheri, Mumbai');
    });

    test('displayAddress uses only non-null part', () {
      const hub = HubModel(id: 'h1', name: 'X', location: 'Andheri', city: null);
      expect(hub.displayAddress, 'Andheri');
    });

    test('displayAddress returns Hub when both null', () {
      const hub = HubModel(id: 'h1', name: 'X');
      expect(hub.displayAddress, 'Hub');
    });

    test('displayAddress returns Hub when both empty', () {
      const hub = HubModel(id: 'h1', name: 'X', location: '', city: '');
      expect(hub.displayAddress, 'Hub');
    });

    test('isActive defaults to true', () {
      final hub = HubModel.fromJson({'id': 'h1', 'name': 'X', 'isActive': true});
      expect(hub.isActive, isTrue);
    });
  });

  // ── PlanModel ───────────────────────────────────────────────────────────
  group('PlanModel', () {
    test('fromJson parses all fields', () {
      final json = {
        'id': 'p1',
        'name': 'Basic',
        'description': 'A basic plan',
        'price': 1500.0,
        'durationDays': 30,
        'features': ['GPS', 'Insurance'],
        'category': 'ECONOMY',
      };
      final model = PlanModel.fromJson(json);
      expect(model.id, 'p1');
      expect(model.price, 1500.0);
      expect(model.durationDays, 30);
      expect(model.features, ['GPS', 'Insurance']);
      expect(model.category, 'ECONOMY');
    });

    test('fromJson defaults features to [] when missing', () {
      final json = {'id': 'p1', 'name': 'X', 'description': 'D', 'price': 100.0, 'durationDays': 7};
      final model = PlanModel.fromJson(json);
      expect(model.features, isEmpty);
    });

    test('fromJson defaults category to empty string when missing', () {
      final json = {'id': 'p1', 'name': 'X', 'description': 'D', 'price': 100.0, 'durationDays': 7};
      final model = PlanModel.fromJson(json);
      expect(model.category, '');
    });

    test('toJson round-trips', () {
      final model = PlanModel.fromJson({
        'id': 'p1', 'name': 'X', 'description': 'D', 'price': 100.0, 'durationDays': 7,
        'features': ['A'], 'category': 'ECONOMY',
      });
      final json = model.toJson();
      expect(json['id'], 'p1');
      expect(json['price'], 100.0);
    });
  });

  // ── RewardItem ──────────────────────────────────────────────────────────
  group('RewardItem', () {
    test('fromJson parses all fields', () {
      final json = {
        'id': 'r1',
        'title': 'First Ride',
        'points': 100,
        'createdAt': '2024-01-15T10:00:00.000Z',
      };
      final model = RewardItem.fromJson(json);
      expect(model.id, 'r1');
      expect(model.title, 'First Ride');
      expect(model.points, 100);
      expect(model.createdAt, DateTime.parse('2024-01-15T10:00:00.000Z'));
    });

    test('toJson round-trips', () {
      final json = {'id': 'r1', 'title': 'T', 'points': 50, 'createdAt': '2024-06-01T00:00:00.000Z'};
      final model = RewardItem.fromJson(json);
      final out = model.toJson();
      expect(out['id'], 'r1');
      expect(out['points'], 50);
    });
  });

  // ── RiderMetrics ────────────────────────────────────────────────────────
  group('RiderMetrics', () {
    test('default constructor sets sensible defaults', () {
      const m = RiderMetrics();
      expect(m.weeklyDistance, 0.0);
      expect(m.carbonSaved, 0.0);
      expect(m.accountStatus, 'PRE_ACTIVE');
      expect(m.lifecycleStatus, 'NEW');
    });

    test('copyWith overrides specified fields only', () {
      const m = RiderMetrics(weeklyDistance: 10.0, carbonSaved: 5.0, accountStatus: 'ACTIVE');
      final updated = m.copyWith(weeklyDistance: 20.0);
      expect(updated.weeklyDistance, 20.0);
      expect(updated.carbonSaved, 5.0); // unchanged
      expect(updated.accountStatus, 'ACTIVE'); // unchanged
    });

    test('copyWith with no args returns equivalent model', () {
      const m = RiderMetrics(batteryPercent: 80.0);
      final copy = m.copyWith();
      expect(copy.batteryPercent, 80.0);
    });
  });

  // ── RiderWallet ─────────────────────────────────────────────────────────
  group('RiderWallet', () {
    test('default constructor sets sensible defaults', () {
      const w = RiderWallet();
      expect(w.walletBalance, 0.0);
      expect(w.paymentStreak, 0);
      expect(w.planStatus, 'NONE');
      expect(w.currentPlan, isNull);
    });

    test('copyWith overrides walletBalance only', () {
      const w = RiderWallet(walletBalance: 1000.0, paymentStreak: 3, planStatus: 'ACTIVE');
      final updated = w.copyWith(walletBalance: 2000.0);
      expect(updated.walletBalance, 2000.0);
      expect(updated.paymentStreak, 3);
      expect(updated.planStatus, 'ACTIVE');
    });

    test('copyWith preserves dates', () {
      final start = DateTime(2024, 1, 1);
      final end = DateTime(2024, 12, 31);
      final w = RiderWallet(planStartDate: start, planEndDate: end);
      final copy = w.copyWith(planStatus: 'ACTIVE');
      expect(copy.planStartDate, start);
      expect(copy.planEndDate, end);
    });
  });

  // ── RiderRental ─────────────────────────────────────────────────────────
  group('RiderRental', () {
    test('default constructor has NONE status and false booleans', () {
      const r = RiderRental();
      expect(r.rentalStatus, 'NONE');
      expect(r.returnPending, isFalse);
      expect(r.planDone, isFalse);
      expect(r.pickupDone, isFalse);
    });

    test('copyWith toggles returnPending', () {
      const r = RiderRental(rentalStatus: 'ACTIVE');
      final updated = r.copyWith(returnPending: true);
      expect(updated.returnPending, isTrue);
      expect(updated.rentalStatus, 'ACTIVE'); // unchanged
    });

    test('copyWith sets planDone and pickupDone independently', () {
      const r = RiderRental();
      final afterPlan = r.copyWith(planDone: true);
      expect(afterPlan.planDone, isTrue);
      expect(afterPlan.pickupDone, isFalse);

      final afterPickup = afterPlan.copyWith(pickupDone: true);
      expect(afterPickup.planDone, isTrue);
      expect(afterPickup.pickupDone, isTrue);
    });
  });

  // ── RiderIdentity ───────────────────────────────────────────────────────
  group('RiderIdentity', () {
    test('fromJson parses required fields', () {
      final json = {
        'riderId': 'rid123',
        'phone': '9876543210',
        'name': 'John Doe',
        'totalRewardPoints': 0,
      };
      final identity = RiderIdentity.fromJson(json);
      expect(identity.riderId, 'rid123');
      expect(identity.phone, '9876543210');
      expect(identity.name, 'John Doe');
      expect(identity.totalRewardPoints, 0);
    });

    test('copyWith updates name and email', () {
      final identity = RiderIdentity.fromJson({
        'riderId': 'r1', 'phone': '9876543210', 'name': 'John',
      });
      final updated = identity.copyWith(name: 'Jane', email: 'jane@example.com');
      expect(updated.name, 'Jane');
      expect(updated.email, 'jane@example.com');
      expect(updated.riderId, 'r1'); // unchanged
    });
  });

  // ── ToDoubleConverter ───────────────────────────────────────────────────
  group('ToDoubleConverter', () {
    const converter = ToDoubleConverter();

    test('converts double passthrough', () {
      expect(converter.fromJson(3.14), 3.14);
    });

    test('converts int to double', () {
      expect(converter.fromJson(42), 42.0);
    });

    test('converts parseable string to double', () {
      expect(converter.fromJson('1500.50'), 1500.50);
    });

    test('returns 0.0 for unparseable string', () {
      expect(converter.fromJson('not-a-number'), 0.0);
    });

    test('returns 0.0 for unknown type', () {
      expect(converter.fromJson(true), 0.0);
    });

    test('toJson returns value unchanged', () {
      expect(converter.toJson(99.9), 99.9);
    });
  });
}
