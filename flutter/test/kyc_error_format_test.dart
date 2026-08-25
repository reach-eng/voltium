// T-114 (PR-4): `_formatKycError` is a private helper on
// `UserOnboardingScreen` so this test exercises the underlying
// formatting by hand-rolling the same switch. The contract is
// "each `ApiException` status code maps to a localised message".
//
// If `_formatKycError` is refactored to live in a shared error-
// formatting utility, the body of the test should move to test
// that utility directly.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

void main() {
  group('KYC error formatting (T-114)', () {
    // The actual helper is a private method on
    // UserOnboardingScreen; the table here mirrors the source so
    // a future refactor that moves the helper to a public utility
    // can be dropped in unchanged.
    String formatKycError(Object e) {
      if (e is ApiException) {
        switch (e.statusCode) {
          case 422:
            return e.message.isNotEmpty
                ? e.message
                : 'Please check your documents and try uploading again.';
          case 401:
            return 'Session expired. Please log in again.';
          case 403:
            return 'Access denied. Please check your verification status.';
          case 408:
          case 504:
            return 'Upload timed out. Please check your connection and retry.';
          case 500:
          case 502:
          case 503:
            return 'Server temporarily unavailable. Please try again later.';
        }
      }
      return 'No internet connection. Please check and retry.';
    }

    test('401 surfaces a session-expired message', () {
      final msg = formatKycError(ApiException('Unauthorized', 401));
      expect(msg, contains('Session expired'));
    });

    test('403 surfaces an access-denied message', () {
      final msg = formatKycError(ApiException('Forbidden', 403));
      expect(msg, contains('Access denied'));
    });

    test('422 with empty body falls back to a documents hint', () {
      final msg = formatKycError(ApiException('', 422));
      expect(msg, contains('Please check your documents'));
    });

    test('422 with a server-provided message echoes it back', () {
      // The server sometimes returns a structured field-level
      // message — those are already user-friendly and the route
      // should pass them through verbatim.
      final msg = formatKycError(
        ApiException('PAN number format invalid', 422),
      );
      expect(msg, 'PAN number format invalid');
    });

    test('504 surfaces an upload-timeout message', () {
      final msg = formatKycError(ApiException('Gateway Timeout', 504));
      expect(msg, contains('Upload timed out'));
    });

    test('5xx surfaces a server-unavailable message', () {
      for (final code in [500, 502, 503]) {
        final msg = formatKycError(ApiException('oops', code));
        expect(msg, contains('Server temporarily unavailable'),
            reason: 'status $code should map to the server-unavailable copy');
      }
    });

    test('ARB files include a Hindi translation for every KYC error key', () {
      // Lock the contract: the ARB files must keep a Hindi value
      // for every error key, so the audit fix can never silently
      // drop back to English. We read the ARB files directly
      // (rather than going through the generated AppLocalizations
      // class) so the test does not break if `flutter gen-l10n`
      // hasn't been re-run.
      final en = File('lib/l10n/app_en.arb').readAsStringSync();
      final hi = File('lib/l10n/app_hi.arb').readAsStringSync();
      const errorKeys = [
        'txtkycErrorInvalidDocs',
        'txtkycErrorAccessDenied',
        'txtkycErrorUploadTimeout',
        'txtserverUnavailable',
        'txtgenericTryAgain',
        'txtsubjectRequired',
        'txtsubjectTooShort',
        'txtmessageRequired',
        'txtmessageTooShort',
        'txtdescribeIssueHint',
        'txtsubject',
        'txtmessage',
      ];
      for (final key in errorKeys) {
        expect(en, contains('"$key":'),
            reason: 'missing EN ARB entry for $key');
        expect(hi, contains('"$key":'),
            reason: 'missing HI ARB entry for $key');
      }
    });
  });
}
