import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
import 'package:voltium_rider/utils/date_utils.dart';

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    // Required for DateFormat('dd-MM-yyyy', 'en_IN') to work.
    await initializeDateFormatting('en_IN', null);
    Intl.defaultLocale = 'en_IN';
  });

  group('DateUtils (DD-MM-YYYY)', () {
    test('formatDateDDMMYYYY formats correctly', () {
      final date = DateTime(2026, 3, 15);
      expect(DateUtils.formatDateDDMMYYYY(date), '15-03-2026');
    });

    test('formatDateDDMMYYYY pads single-digit day and month', () {
      final date = DateTime(2026, 1, 5);
      expect(DateUtils.formatDateDDMMYYYY(date), '05-01-2026');
    });

    test('formatDateDDMMYYYY returns empty for null', () {
      expect(DateUtils.formatDateDDMMYYYY(null), '');
    });

    test('formatDateTimeDDMMYYYY includes time', () {
      final date = DateTime(2026, 3, 15, 14, 30, 45);
      expect(DateUtils.formatDateTimeDDMMYYYY(date), '15-03-2026 14:30:45');
    });

    test('formatDateTimeShortDDMMYYYY omits seconds', () {
      final date = DateTime(2026, 3, 15, 14, 30, 45);
      expect(DateUtils.formatDateTimeShortDDMMYYYY(date), '15-03-2026 14:30');
    });

    test('parseDDMMYYYY parses valid input', () {
      final date = DateUtils.parseDDMMYYYY('15-03-2026');
      expect(date, isNotNull);
      expect(date!.year, 2026);
      expect(date.month, 3);
      expect(date.day, 15);
    });

    test('parseDDMMYYYY accepts ISO fallback', () {
      final date = DateUtils.parseDDMMYYYY('2026-03-15');
      expect(date, isNotNull);
      expect(date!.year, 2026);
    });

    test('parseDDMMYYYY returns null for invalid', () {
      expect(DateUtils.parseDDMMYYYY('not-a-date'), isNull);
      expect(DateUtils.parseDDMMYYYY('32-01-2026'), isNull);
      expect(DateUtils.parseDDMMYYYY(null), isNull);
      expect(DateUtils.parseDDMMYYYY(''), isNull);
    });

    test('isValidDDMMYYYY strict check', () {
      expect(DateUtils.isValidDDMMYYYY('15-03-2026'), isTrue);
      expect(DateUtils.isValidDDMMYYYY('2026-03-15'), isFalse);
      expect(DateUtils.isValidDDMMYYYY('invalid'), isFalse);
      expect(DateUtils.isValidDDMMYYYY(null), isFalse);
    });
  });
}
