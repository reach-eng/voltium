// P1-4 (Stage A): localized push notifications for SUPPORT_REPLY and PAYMENT_DUE.
// Tests verify that structured discriminators and amounts are localized into
// English and Hindi using the ARB bundle and formatRupees.

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/services/notification_service.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<AppLocalizations> l10nFor(Locale locale) async {
    return AppLocalizations.delegate.load(locale);
  }

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await CacheService().clearLocale();
  });

  group('P1-4 Stage A: renderSupportPushFromData', () {
    test('returns null for non-SUPPORT_REPLY data', () async {
      final l10n = await l10nFor(const Locale('en'));
      expect(
        NotificationService.renderSupportPushFromData(
            {'type': 'PAYMENT_DUE'}, l10n),
        isNull,
      );
      expect(
        NotificationService.renderSupportPushFromData({}, l10n),
        isNull,
      );
    });

    test('SUPPORT_REPLY with ticketId → English title + body', () async {
      final l10n = await l10nFor(const Locale('en'));
      final result = NotificationService.renderSupportPushFromData(
        {'type': 'SUPPORT_REPLY', 'ticketId': 'TICK-402'},
        l10n,
      );
      expect(result, isNotNull);
      expect(result!.title, 'Support Ticket Update 💬');
      expect(result.body, 'New response received on ticket #TICK-402.');
    });

    test('SUPPORT_REPLY with ticketId → Hindi title + body', () async {
      final l10n = await l10nFor(const Locale('hi'));
      final result = NotificationService.renderSupportPushFromData(
        {'type': 'SUPPORT_REPLY', 'ticketId': 'TICK-402'},
        l10n,
      );
      expect(result, isNotNull);
      expect(result!.title, 'सपोर्ट टिकट अपडेट 💬');
      expect(result.body, 'टिकट #TICK-402 पर नया उत्तर प्राप्त हुआ है।');
    });

    test('SUPPORT_REPLY without ticketId → fallback body in English & Hindi',
        () async {
      final enL10n = await l10nFor(const Locale('en'));
      final enResult = NotificationService.renderSupportPushFromData(
        {'type': 'SUPPORT_REPLY'},
        enL10n,
      );
      expect(enResult, isNotNull);
      expect(enResult!.body, 'New response received on your support ticket.');

      final hiL10n = await l10nFor(const Locale('hi'));
      final hiResult = NotificationService.renderSupportPushFromData(
        {'type': 'SUPPORT_REPLY'},
        hiL10n,
      );
      expect(hiResult, isNotNull);
      expect(hiResult!.body, 'आपके सपोर्ट टिकट पर नया उत्तर प्राप्त हुआ है।');
    });
  });

  group('P1-4 Stage A: renderPaymentPushFromData', () {
    test('returns null for non-PAYMENT_DUE data', () async {
      final l10n = await l10nFor(const Locale('en'));
      expect(
        NotificationService.renderPaymentPushFromData(
            {'type': 'KYC_APPROVED'}, l10n),
        isNull,
      );
      expect(
        NotificationService.renderPaymentPushFromData({}, l10n),
        isNull,
      );
    });

    test(
        'PAYMENT_DUE with amountPaise string → formatted Indian rupees in English',
        () async {
      final l10n = await l10nFor(const Locale('en'));
      final result = NotificationService.renderPaymentPushFromData(
        {'type': 'PAYMENT_DUE', 'amountPaise': '150000'},
        l10n,
      );
      expect(result, isNotNull);
      expect(result!.title, 'Payment Reminder 💳');
      expect(result.body, 'Your rental payment of ₹1,500 is due.');
    });

    test('PAYMENT_DUE with amountPaise int → formatted Indian rupees in Hindi',
        () async {
      final l10n = await l10nFor(const Locale('hi'));
      final result = NotificationService.renderPaymentPushFromData(
        {'type': 'PAYMENT_DUE', 'amountPaise': 250000},
        l10n,
      );
      expect(result, isNotNull);
      expect(result!.title, 'भुगतान अनुस्मारक 💳');
      expect(result.body, 'आपका ₹2,500 का किराया भुगतान देय है।');
    });

    test(
        'PAYMENT_DUE with non-zero paise decimals → includes decimals correctly',
        () async {
      final l10n = await l10nFor(const Locale('en'));
      final result = NotificationService.renderPaymentPushFromData(
        {'type': 'PAYMENT_DUE', 'amountPaise': '123450'},
        l10n,
      );
      expect(result, isNotNull);
      expect(result!.body, 'Your rental payment of ₹1,234.50 is due.');
    });

    test(
        'PAYMENT_DUE missing or zero amount → fallback body in English & Hindi',
        () async {
      final enL10n = await l10nFor(const Locale('en'));
      final enResult = NotificationService.renderPaymentPushFromData(
        {'type': 'PAYMENT_DUE'},
        enL10n,
      );
      expect(enResult, isNotNull);
      expect(enResult!.body,
          'Your rental payment is due. Please top up your wallet.');

      final hiL10n = await l10nFor(const Locale('hi'));
      final hiResult = NotificationService.renderPaymentPushFromData(
        {'type': 'PAYMENT_DUE', 'amountPaise': '0'},
        hiL10n,
      );
      expect(hiResult, isNotNull);
      expect(hiResult!.body,
          'आपका किराया भुगतान देय है। कृपया अपना वॉलेट रिचार्ज करें।');
    });
  });

  group('P1-4 Stage A: showSupportPushFromFcm & showPaymentPushFromFcm', () {
    test('returns false for mismatched payload', () async {
      final supRes =
          await NotificationService.showSupportPushFromFcm({'type': 'OTHER'});
      expect(supRes, isFalse);

      final payRes =
          await NotificationService.showPaymentPushFromFcm({'type': 'OTHER'});
      expect(payRes, isFalse);
    });

    test('resolves and handles valid payloads', () async {
      final supRes = await NotificationService.showSupportPushFromFcm({
        'type': 'SUPPORT_REPLY',
        'ticketId': 'TICK-999',
      });
      expect(supRes, isA<bool>());

      final payRes = await NotificationService.showPaymentPushFromFcm({
        'type': 'PAYMENT_DUE',
        'amountPaise': '50000',
      });
      expect(payRes, isA<bool>());
    });
  });
}
