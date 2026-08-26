import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/models/notification_model.dart';

void main() {
  group('AppNotification - category parser (PR-N2)', () {
    test('parses category from server JSON', () {
      final json = {
        'id': '1',
        'title': 't',
        'message': 'm',
        'type': 'PAYMENT',
        'category': 'PAYMENT',
        'createdAt': '2026-08-26T10:00:00Z',
        'isRead': false,
      };
      final n = AppNotification.fromJson(json);
      expect(n.category, NotificationCategory.payment);
    });

    test('returns null for missing category (legacy rows)', () {
      final json = {
        'id': '1',
        'title': 't',
        'message': 'm',
        'type': 'INFO',
        'createdAt': '2026-08-26T10:00:00Z',
        'isRead': false,
      };
      final n = AppNotification.fromJson(json);
      expect(n.category, isNull);
    });

    test('returns null for unknown category values', () {
      final json = {
        'id': '1',
        'title': 't',
        'message': 'm',
        'type': 'INFO',
        'category': 'FUTURE_VALUE',
        'createdAt': '2026-08-26T10:00:00Z',
        'isRead': false,
      };
      final n = AppNotification.fromJson(json);
      expect(n.category, isNull);
    });

    test('preserves all 5 server enum values', () {
      final expectedMap = {
        'PAYMENT': NotificationCategory.payment,
        'KYC': NotificationCategory.kyc,
        'MAINTENANCE': NotificationCategory.maintenance,
        'ANNOUNCEMENT': NotificationCategory.announcement,
        'SYSTEM': NotificationCategory.system,
      };

      for (final entry in expectedMap.entries) {
        final json = {
          'id': '1',
          'title': 't',
          'message': 'm',
          'type': 'INFO',
          'category': entry.key,
          'createdAt': '2026-08-26T10:00:00Z',
          'isRead': false,
        };
        final n = AppNotification.fromJson(json);
        expect(n.category, entry.value, reason: 'category  should parse');
      }
    });

    test('serializes category to JSON', () {
      final n = AppNotification(
        id: '1',
        title: 'Title',
        message: 'Message',
        type: AppNotificationType.payment,
        category: NotificationCategory.payment,
        createdAt: DateTime.parse('2026-08-26T10:00:00Z'),
      );
      final json = n.toJson();
      expect(json['category'], 'payment');
    });
  });
}