// P2-12 (PR-G, 2026-08-28 workflows deferred): the server sends a
// KYC push discriminator + structured data instead of pre-formatted
// English. The Flutter client's NotificationService.renderKycPushFromData
// resolves the discriminator to a localized (title, body) pair using
// the ARB bundle. These tests verify the lookup for each of the 3
// KYC types, in both en and hi.
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/services/notification_service.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

void main() {
  Future<AppLocalizations> _l10nFor(Locale locale) async {
    return AppLocalizations.delegate.load(locale);
  }

  group('P2-12: renderKycPushFromData', () {
    test('returns null for non-KYC data', () async {
      final l10n = await _l10nFor(const Locale('en'));
      expect(
          NotificationService.renderKycPushFromData(
              {'type': 'PAYMENT_DUE'}, l10n),
          isNull);
      expect(NotificationService.renderKycPushFromData({}, l10n), isNull);
    });

    test('KYC_APPROVED → English title + body', () async {
      final l10n = await _l10nFor(const Locale('en'));
      final result = NotificationService.renderKycPushFromData(
        {'type': 'KYC_APPROVED', 'screen': 'KYC_STATUS'},
        l10n,
      );
      expect(result, isNotNull);
      expect(result!.title, 'KYC Approved');
      expect(result.body, contains('verified'));
    });

    test('KYC_APPROVED → Hindi title + body', () async {
      final l10n = await _l10nFor(const Locale('hi'));
      final result = NotificationService.renderKycPushFromData(
        {'type': 'KYC_APPROVED'},
        l10n,
      );
      expect(result, isNotNull);
      // The Hindi strings contain Devanagari; we just verify they're
      // not the English fallback.
      expect(result!.title, isNot('KYC Approved'));
      expect(result.body, isNot(contains('verified')));
      expect(result.title.isNotEmpty, isTrue);
      expect(result.body.isNotEmpty, isTrue);
    });

    test('KYC_REJECTED with reason → uses reason placeholder', () async {
      final l10n = await _l10nFor(const Locale('en'));
      final result = NotificationService.renderKycPushFromData(
        {'type': 'KYC_REJECTED', 'reason': 'Photo too blurry'},
        l10n,
      );
      expect(result, isNotNull);
      expect(result!.body, 'Your KYC was rejected: Photo too blurry');
    });

    test('KYC_REJECTED without reason → uses fallback body', () async {
      final l10n = await _l10nFor(const Locale('en'));
      final result = NotificationService.renderKycPushFromData(
        {'type': 'KYC_REJECTED'},
        l10n,
      );
      expect(result, isNotNull);
      expect(result!.body, 'Please re-upload your documents.');
    });

    test('KYC_INFO_REQUESTED → title + body in both locales', () async {
      for (final locale in [const Locale('en'), const Locale('hi')]) {
        final l10n = await _l10nFor(locale);
        final result = NotificationService.renderKycPushFromData(
          {'type': 'KYC_INFO_REQUESTED'},
          l10n,
        );
        expect(result, isNotNull);
        expect(result!.title, isNotEmpty);
        expect(result.body, isNotEmpty);
      }
    });
  });
}
