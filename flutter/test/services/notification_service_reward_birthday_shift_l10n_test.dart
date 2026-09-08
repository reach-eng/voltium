// P1-4 (Stage C): localized push notifications for REWARD, BIRTHDAY_WISH, and SHIFT_REMINDER.
// Tests verify that structured discriminators and parameters are localized into
// English and Hindi using the ARB bundle.

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/services/fcm_service.dart';
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

  group('P1-4 Stage C: renderRewardPushFromData', () {
    test('returns null for non-reward data', () async {
      final l10n = await l10nFor(const Locale('en'));
      expect(
        NotificationService.renderRewardPushFromData(
            {'type': 'PAYMENT_DUE'}, l10n),
        isNull,
      );
      expect(
        NotificationService.renderRewardPushFromData({}, l10n),
        isNull,
      );
    });

    test('REWARD with points and milestoneTitle → English title + body',
        () async {
      final l10n = await l10nFor(const Locale('en'));
      final result = NotificationService.renderRewardPushFromData(
        {
          'type': 'REWARD',
          'points': '150',
          'milestoneTitle': '50 Rides Completed',
        },
        l10n,
      );
      expect(result, isNotNull);
      expect(result!.title, 'Reward Earned! 🏆');
      expect(result.body, "You've earned 150 points for 50 Rides Completed.");
    });

    test('REWARD with points and milestoneTitle → Hindi title + body',
        () async {
      final l10n = await l10nFor(const Locale('hi'));
      final result = NotificationService.renderRewardPushFromData(
        {
          'type': 'REWARD',
          'points': '150',
          'milestoneTitle': '50 Rides Completed',
        },
        l10n,
      );
      expect(result, isNotNull);
      expect(result!.title, 'पुरस्कार प्राप्त हुआ! 🏆');
      expect(result.body,
          'आपने 50 Rides Completed के लिए 150 अंक अर्जित किए हैं।');
    });

    test('REWARD_MILESTONE alias is recognized', () async {
      final l10n = await l10nFor(const Locale('en'));
      final result = NotificationService.renderRewardPushFromData(
        {
          'type': 'REWARD_MILESTONE',
          'points': 50,
          'title': 'First EV Ride',
        },
        l10n,
      );
      expect(result, isNotNull);
      expect(result!.body, "You've earned 50 points for First EV Ride.");
    });

    test('REWARD missing fields → fallback body in English & Hindi', () async {
      final enL10n = await l10nFor(const Locale('en'));
      final enResult = NotificationService.renderRewardPushFromData(
        {'type': 'REWARD'},
        enL10n,
      );
      expect(enResult, isNotNull);
      expect(
          enResult!.body, "You've earned reward points! Check your rewards.");

      final hiL10n = await l10nFor(const Locale('hi'));
      final hiResult = NotificationService.renderRewardPushFromData(
        {'type': 'REWARD'},
        hiL10n,
      );
      expect(hiResult, isNotNull);
      expect(hiResult!.body,
          'आपने पुरस्कार अंक अर्जित किए हैं! अपने पुरस्कार देखें।');
    });
  });

  group('P1-4 Stage C: renderBirthdayPushFromData', () {
    test('returns null for non-birthday data', () async {
      final l10n = await l10nFor(const Locale('en'));
      expect(
        NotificationService.renderBirthdayPushFromData(
            {'type': 'REWARD'}, l10n),
        isNull,
      );
      expect(
        NotificationService.renderBirthdayPushFromData({}, l10n),
        isNull,
      );
    });

    test('BIRTHDAY_WISH with name → English title + body', () async {
      final l10n = await l10nFor(const Locale('en'));
      final result = NotificationService.renderBirthdayPushFromData(
        {'type': 'BIRTHDAY_WISH', 'name': 'Aarav'},
        l10n,
      );
      expect(result, isNotNull);
      expect(result!.title, 'Happy Birthday, Aarav! 🎂');
      expect(
        result.body,
        'Wishing you a fantastic day ahead. Enjoy a special birthday reward on us!',
      );
    });

    test('BIRTHDAY_WISH with name → Hindi title + body', () async {
      final l10n = await l10nFor(const Locale('hi'));
      final result = NotificationService.renderBirthdayPushFromData(
        {'type': 'BIRTHDAY_WISH', 'name': 'Aarav'},
        l10n,
      );
      expect(result, isNotNull);
      expect(result!.title, 'जन्मदिन मुबारक हो, Aarav! 🎂');
      expect(
        result.body,
        'आपका दिन शानदार रहे। हमारी ओर से विशेष जन्मदिन पुरस्कार का आनंद लें!',
      );
    });

    test('BIRTHDAY_WISH without name → fallback title in English & Hindi',
        () async {
      final enL10n = await l10nFor(const Locale('en'));
      final enResult = NotificationService.renderBirthdayPushFromData(
        {'type': 'BIRTHDAY_WISH'},
        enL10n,
      );
      expect(enResult, isNotNull);
      expect(enResult!.title, 'Happy Birthday! 🎂');

      final hiL10n = await l10nFor(const Locale('hi'));
      final hiResult = NotificationService.renderBirthdayPushFromData(
        {'type': 'BIRTHDAY_WISH'},
        hiL10n,
      );
      expect(hiResult, isNotNull);
      expect(hiResult!.title, 'जन्मदिन मुबारक हो! 🎂');
    });
  });

  group('P1-4 Stage C: renderShiftPushFromData', () {
    test('returns null for non-shift data', () async {
      final l10n = await l10nFor(const Locale('en'));
      expect(
        NotificationService.renderShiftPushFromData({'type': 'REWARD'}, l10n),
        isNull,
      );
      expect(
        NotificationService.renderShiftPushFromData({}, l10n),
        isNull,
      );
    });

    test('SHIFT_REMINDER with startTime → English title + body', () async {
      final l10n = await l10nFor(const Locale('en'));
      final result = NotificationService.renderShiftPushFromData(
        {'type': 'SHIFT_REMINDER', 'startTime': '09:00 AM'},
        l10n,
      );
      expect(result, isNotNull);
      expect(result!.title, 'Upcoming Shift ⏰');
      expect(result.body, 'Your shift starts at 09:00 AM. Please be ready!');
    });

    test('SHIFT_REMINDER with startTime → Hindi title + body', () async {
      final l10n = await l10nFor(const Locale('hi'));
      final result = NotificationService.renderShiftPushFromData(
        {'type': 'SHIFT_REMINDER', 'startTime': '09:00 AM'},
        l10n,
      );
      expect(result, isNotNull);
      expect(result!.title, 'आगामी शिफ्ट ⏰');
      expect(result.body,
          'आपकी शिफ्ट 09:00 AM पर शुरू होती है। कृपया तैयार रहें!');
    });

    test('SHIFT_REMINDER without startTime → fallback body in English & Hindi',
        () async {
      final enL10n = await l10nFor(const Locale('en'));
      final enResult = NotificationService.renderShiftPushFromData(
        {'type': 'SHIFT_REMINDER'},
        enL10n,
      );
      expect(enResult, isNotNull);
      expect(enResult!.body, 'Your shift is starting soon. Please be ready!');

      final hiL10n = await l10nFor(const Locale('hi'));
      final hiResult = NotificationService.renderShiftPushFromData(
        {'type': 'SHIFT_REMINDER'},
        hiL10n,
      );
      expect(hiResult, isNotNull);
      expect(hiResult!.body,
          'आपकी शिफ्ट जल्द ही शुरू होने वाली है। कृपया तैयार रहें!');
    });
  });

  group('P1-4 Stage C: FCMService predicates', () {
    test('isRewardPushType matches REWARD and REWARD_MILESTONE', () {
      expect(FCMService.isRewardPushType('REWARD'), isTrue);
      expect(FCMService.isRewardPushType('REWARD_MILESTONE'), isTrue);
      expect(FCMService.isRewardPushType('KYC_APPROVED'), isFalse);
      expect(FCMService.isRewardPushType(null), isFalse);
    });

    test('isBirthdayPushType matches BIRTHDAY_WISH', () {
      expect(FCMService.isBirthdayPushType('BIRTHDAY_WISH'), isTrue);
      expect(FCMService.isBirthdayPushType('REWARD'), isFalse);
      expect(FCMService.isBirthdayPushType(null), isFalse);
    });

    test('isShiftPushType matches SHIFT_REMINDER', () {
      expect(FCMService.isShiftPushType('SHIFT_REMINDER'), isTrue);
      expect(FCMService.isShiftPushType('PAYMENT_DUE'), isFalse);
      expect(FCMService.isShiftPushType(null), isFalse);
    });
  });
}
