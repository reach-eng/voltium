import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/utils/date_formatters.dart';

/// PR-A (§5.2 / audit #5 P0-3): the server's Zod schemas expect ISO
/// `yyyy-MM-dd` DOB values. Localized `dd-MM-yyyy` strings are silently
/// rejected with a 400, so every DOB sent to the API must be formatted via
/// [formatDobForApi]. [formatDobForDisplay] is the matching input-field
/// format.
void main() {
  group('formatDobForApi', () {
    test('formats a full date as ISO yyyy-MM-dd', () {
      expect(formatDobForApi(DateTime(1985, 6, 5)), '1985-06-05');
    });

    test('zero-pads single-digit month and day', () {
      expect(formatDobForApi(DateTime(1999, 1, 9)), '1999-01-09');
    });

    test('zero-pads single-digit day with a two-digit month', () {
      expect(formatDobForApi(DateTime(2000, 12, 3)), '2000-12-03');
    });
  });

  group('formatDobForDisplay', () {
    test('formats as dd-MM-yyyy for input fields', () {
      expect(formatDobForDisplay(DateTime(1985, 6, 5)), '05-06-1985');
    });

    test('zero-pads single-digit values', () {
      expect(formatDobForDisplay(DateTime(2001, 2, 7)), '07-02-2001');
    });
  });

  test('display and API formats are inverses of each other', () {
    final dob = DateTime(1990, 11, 23);
    final api = formatDobForApi(dob);
    final display = formatDobForDisplay(dob);
    expect(api, '1990-11-23');
    expect(display, '23-11-1990');
    expect(api.split('-').reversed.join('-'), display);
  });
}
