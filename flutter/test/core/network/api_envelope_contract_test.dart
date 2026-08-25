import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/models/hub_model.dart';
import 'package:voltium_rider/models/support_model.dart';

void main() {
  group('Phase F1: API Envelope & Data Contract Tests', () {
    group('FL-22: Odd-paise balance parsing resilience', () {
      test(
          'VerifyOtpResponse correctly parses odd-paise decimal balance (e.g. 1999.5)',
          () {
        final json = {
          'riderId': 'rider-123',
          'phone': '+919876543210',
          'walletBalance': 1999.5,
          'accountStatus': 'ACTIVE',
        };

        final response = VerifyOtpResponse.fromJson(json);
        expect(response.walletBalance, equals(1999.5));
        expect(response.riderId, equals('rider-123'));
      });

      test(
          'VerifyOtpResponse correctly parses whole integer balance (e.g. 1000)',
          () {
        final json = {
          'riderId': 'rider-123',
          'walletBalance': 1000,
        };

        final response = VerifyOtpResponse.fromJson(json);
        expect(response.walletBalance, equals(1000.0));
      });

      test('VerifyOtpResponse correctly parses wrapped envelope response', () {
        final json = {
          'success': true,
          'data': {
            'riderId': 'rider-456',
            'walletBalance': 249.75,
            'isNewRider': false,
          },
        };

        final response = VerifyOtpResponse.fromJson(json);
        expect(response.riderId, equals('rider-456'));
        expect(response.walletBalance, equals(249.75));
        expect(response.isNewRider, isFalse);
      });

      test(
          'RiderProfileResponse correctly parses odd-paise balance without TypeError',
          () {
        final json = {
          'riderId': 'rider-789',
          'fullName': 'Test Rider',
          'walletBalance': 49.95,
          'kycStatus': 'APPROVED',
        };

        final profile = RiderProfileResponse.fromJson(json);
        expect(profile.walletBalance, equals(49.95));
        expect(profile.fullName, equals('Test Rider'));
      });

      test('RiderProfileResponse correctly parses wrapped envelope payload',
          () {
        final json = {
          'success': true,
          'data': {
            'riderId': 'rider-999',
            'walletBalance': 1500.5,
            'kycStatus': 'APPROVED',
          },
        };

        final profile = RiderProfileResponse.fromJson(json);
        expect(profile.riderId, equals('rider-999'));
        expect(profile.walletBalance, equals(1500.5));
      });

      test('RiderModel correctly converts integer and decimal wallet balances',
          () {
        final modelDecimal = RiderModel.fromJson({
          'riderId': 'r-1',
          'phone': '+919999999999',
          'fullName': 'Rider One',
          'walletBalance': 1999.5,
        });
        expect(modelDecimal.walletBalance, equals(1999.5));

        final modelInt = RiderModel.fromJson({
          'riderId': 'r-2',
          'phone': '+919999999998',
          'fullName': 'Rider Two',
          'walletBalance': 500,
        });
        expect(modelInt.walletBalance, equals(500.0));
      });
    });

    group('FL-1: Envelope unwrap resilience across models', () {
      test('ListNotificationsResponse parses unwrapped and wrapped payloads',
          () {
        final unwrapped = {
          'notifications': [
            {
              'id': 'n-1',
              'title': 'Test Notification',
              'message': 'Hello rider',
              'isRead': false,
            }
          ],
          'unreadCount': 1,
          'total': 1,
        };

        final resp1 = ListNotificationsResponse.fromJson(unwrapped);
        expect(resp1.unreadCount, equals(1));
        expect(resp1.notifications?.length, equals(1));

        final wrapped = {
          'success': true,
          'data': {
            'notifications': [
              {
                'id': 'n-2',
                'title': 'Wrapped Notification',
                'message': 'Payload inside data',
                'isRead': true,
              }
            ],
            'unreadCount': 0,
            'total': 1,
          },
        };

        final resp2 = ListNotificationsResponse.fromJson(wrapped);
        expect(resp2.unreadCount, equals(0));
        expect(resp2.notifications?.length, equals(1));
        expect(resp2.notifications?.first.id, equals('n-2'));
      });

      test('HubModel parses real backend array response item', () {
        final hubJson = {
          'id': 'hub-bengaluru-1',
          'name': 'Indiranagar Hub',
          'location': '100 Feet Road, Bengaluru',
          'city': 'Bengaluru',
          'isActive': true,
        };

        final hub = HubModel.fromJson(hubJson);
        expect(hub.id, equals('hub-bengaluru-1'));
        expect(hub.name, equals('Indiranagar Hub'));
      });
    });

    group('FL-23: FAQ data shape contracts', () {
      test('FaqItem parses backend response using category key', () {
        final backendFaq = {
          'id': 'faq-1',
          'category': 'Technical Issues',
          'question': 'How do I start my rental?',
          'answer': 'Perform the pre-ride check and tap Start Ride.',
        };

        final faq = FaqItem.fromJson(backendFaq);
        expect(faq.id, equals('faq-1'));
        expect(faq.category, equals('Technical Issues'));
        expect(faq.question, equals('How do I start my rental?'));
      });

      test('FaqItem parses legacy categoryId format', () {
        final legacyFaq = {
          'id': 'faq-2',
          'categoryId': 'Payments',
          'question': 'What payment methods are supported?',
          'answer': 'UPI, Cards, NetBanking.',
        };

        final faq = FaqItem.fromJson(legacyFaq);
        expect(faq.id, equals('faq-2'));
        expect(faq.categoryId, equals('Payments'));
      });
    });
  });
}
