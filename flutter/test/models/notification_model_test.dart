import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/models/notification_model.dart';

void main() {
  AppNotification _make(AppNotificationType type) => AppNotification(
        id: 'n1',
        title: 'Test',
        message: 'msg',
        type: type,
        createdAt: DateTime(2024, 1, 1),
      );

  // ── fromJson fallback behaviour ─────────────────────────────────────────
  group('AppNotification.fromJson', () {
    test('parses full valid json', () {
      final n = AppNotification.fromJson({
        'id': 'n1',
        'title': 'Hello',
        'message': 'World',
        'type': 'payment',
        'createdAt': '2024-06-01T10:00:00.000Z',
        'isRead': false,
      });
      expect(n.id, 'n1');
      expect(n.title, 'Hello');
      expect(n.message, 'World');
      expect(n.type, AppNotificationType.payment);
      expect(n.isRead, isFalse);
    });

    test('falls back message to body when message is absent', () {
      final n = AppNotification.fromJson({
        'id': 'n1',
        'title': 'T',
        'body': 'From body',
        'type': 'info',
        'createdAt': '2024-01-01T00:00:00.000Z',
      });
      expect(n.message, 'From body');
    });

    test('falls back createdAt to timestamp key', () {
      final n = AppNotification.fromJson({
        'id': 'n1',
        'title': 'T',
        'message': 'M',
        'type': 'info',
        'timestamp': '2024-03-15T09:00:00.000Z',
      });
      expect(n.createdAt, DateTime.parse('2024-03-15T09:00:00.000Z'));
    });

    test('defaults id to timestamp string when null', () {
      final before = DateTime.now().millisecondsSinceEpoch;
      final n = AppNotification.fromJson({
        'title': 'T',
        'message': 'M',
        'type': 'info',
        'createdAt': '2024-01-01T00:00:00.000Z',
      });
      final after = DateTime.now().millisecondsSinceEpoch;
      final id = int.tryParse(n.id) ?? 0;
      expect(id, greaterThanOrEqualTo(before));
      expect(id, lessThanOrEqualTo(after));
    });
  });

  // ── _parseType (tested via fromJson) ────────────────────────────────────
  group('AppNotification type parsing', () {
    test('parses server canonical names case-insensitively', () {
      for (final pair in [
        ['INFO', AppNotificationType.info],
        ['PAYMENT', AppNotificationType.payment],
        ['SOS', AppNotificationType.sos],
        ['PROMOTION', AppNotificationType.promotion],
        ['VEHICLE', AppNotificationType.vehicle],
        ['ALERT', AppNotificationType.alert],
        ['SYSTEM', AppNotificationType.system],
      ]) {
        final n = AppNotification.fromJson({
          'id': 'x', 'title': 'T', 'message': 'M',
          'type': pair[0] as String,
          'createdAt': '2024-01-01T00:00:00.000Z',
        });
        expect(n.type, pair[1], reason: 'Failed for ${pair[0]}');
      }
    });

    test('falls back to system for unknown type', () {
      final n = AppNotification.fromJson({
        'id': 'x', 'title': 'T', 'message': 'M',
        'type': 'UNKNOWN_TYPE',
        'createdAt': '2024-01-01T00:00:00.000Z',
      });
      expect(n.type, AppNotificationType.system);
    });
  });

  // ── copyWith ────────────────────────────────────────────────────────────
  group('AppNotification.copyWith', () {
    test('toggles isRead', () {
      final n = _make(AppNotificationType.info);
      expect(n.isRead, isFalse);
      final read = n.copyWith(isRead: true);
      expect(read.isRead, isTrue);
      expect(read.id, n.id);
      expect(read.type, n.type);
    });
  });

  // ── icon getter ─────────────────────────────────────────────────────────
  group('AppNotification.icon', () {
    test('vehicle and rideStarted → electric_moped', () {
      expect(_make(AppNotificationType.vehicle).icon, Icons.electric_moped);
      expect(_make(AppNotificationType.rideStarted).icon, Icons.electric_moped);
    });

    test('payment and paymentSent → arrow_upward', () {
      expect(_make(AppNotificationType.payment).icon, Icons.arrow_upward);
      expect(_make(AppNotificationType.paymentSent).icon, Icons.arrow_upward);
    });

    test('paymentReceived → arrow_downward', () {
      expect(_make(AppNotificationType.paymentReceived).icon, Icons.arrow_downward);
    });

    test('sos, sosAlert, alert → warning', () {
      expect(_make(AppNotificationType.sos).icon, Icons.warning);
      expect(_make(AppNotificationType.alert).icon, Icons.warning);
    });

    test('promotion and promo → celebration', () {
      expect(_make(AppNotificationType.promotion).icon, Icons.celebration);
      expect(_make(AppNotificationType.promo).icon, Icons.celebration);
    });

    test('system and info → info_icon', () {
      expect(_make(AppNotificationType.system).icon, Icons.info);
      expect(_make(AppNotificationType.info).icon, Icons.info);
    });
  });

  // ── iconColor getter ─────────────────────────────────────────────────────
  group('AppNotification.iconColor', () {
    test('vehicle → blue', () => expect(_make(AppNotificationType.vehicle).iconColor, Colors.blue));
    test('payment → orange', () => expect(_make(AppNotificationType.payment).iconColor, Colors.orange));
    test('paymentReceived → green', () => expect(_make(AppNotificationType.paymentReceived).iconColor, Colors.green));
    test('sos → red', () => expect(_make(AppNotificationType.sos).iconColor, Colors.red));
    test('promotion → purple', () => expect(_make(AppNotificationType.promotion).iconColor, Colors.purple));
    test('info → grey', () => expect(_make(AppNotificationType.info).iconColor, Colors.grey));
  });
}
