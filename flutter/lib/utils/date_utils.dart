import 'package:intl/intl.dart';

import 'app_logger.dart';

/// Date utilities for DD-MM-YYYY formatting on the Flutter rider app.
///
/// The Voltium app standardizes on DD-MM-YYYY (day-month-year) for all
/// user-facing dates, as the primary user base is in India. This module
/// is the single source of truth for formatting, parsing, and
/// validation.
///
/// Conventions (mirror web/src/lib/date-utils.ts):
///   - Display dates: always DD-MM-YYYY (e.g., 15-03-2026)
///   - Display datetimes: DD-MM-YYYY HH:mm:ss (e.g., 15-03-2026 14:30:00)
///   - Internal storage: ISO 8601 UTC (handled by Prisma + TIMESTAMPTZ)
///   - API contracts: ISO 8601 UTC for machine-readable fields
///   - API input: accept both DD-MM-YYYY and ISO 8601
class DateUtils {
  DateUtils._();

  /// Default locale for DD-MM-YYYY formatting. Indian English uses
  /// the same date format as British English but with the Indian
  /// convention DD-MM-YYYY.
  static const String _locale = 'en_IN';

  /// Formatter for DD-MM-YYYY.
  static final DateFormat _dateFormat = DateFormat('dd-MM-yyyy', _locale);

  /// Formatter for DD-MM-YYYY HH:mm:ss.
  static final DateFormat _dateTimeFormat =
      DateFormat('dd-MM-yyyy HH:mm:ss', _locale);

  /// Formatter for DD-MM-YYYY HH:mm.
  static final DateFormat _dateTimeShortFormat =
      DateFormat('dd-MM-yyyy HH:mm', _locale);

  /// Format a Date as DD-MM-YYYY.
  ///
  /// Returns an empty string if [date] is null.
  ///
  /// @example formatDateDDMMYYYY(DateTime(2026, 3, 15))
  ///   // → '15-03-2026'
  static String formatDateDDMMYYYY(DateTime? date) {
    if (date == null) return '';
    return _dateFormat.format(date);
  }

  /// Format a Date as DD-MM-YYYY HH:mm:ss.
  ///
  /// Returns an empty string if [date] is null.
  static String formatDateTimeDDMMYYYY(DateTime? date) {
    if (date == null) return '';
    return _dateTimeFormat.format(date);
  }

  /// Format a Date as DD-MM-YYYY HH:mm (no seconds).
  static String formatDateTimeShortDDMMYYYY(DateTime? date) {
    if (date == null) return '';
    return _dateTimeShortFormat.format(date);
  }

  /// Parse a DD-MM-YYYY string into a DateTime. Returns null for
  /// invalid input. Also accepts ISO 8601 (YYYY-MM-DD or full ISO
  /// datetime) as a fallback.
  ///
  /// @example parseDDMMYYYY('15-03-2026') // → DateTime(2026, 3, 15)
  /// @example parseDDMMYYYY('2026-03-15') // → DateTime(2026, 3, 15) (ISO)
  /// @example parseDDMMYYYY('invalid')    // → null
  static DateTime? parseDDMMYYYY(String? input) {
    if (input == null || input.trim().isEmpty) return null;

    final trimmed = input.trim();

    // Try DD-MM-YYYY first
    try {
      return _dateFormat.parseStrict(trimmed);
    } catch (e) {
      // ONBOARDING-AUDIT 2026-08-14 P3-11: not DD-MM-YYYY; fall
      // through to ISO 8601. Log in debug mode so silent format
      // mismatches (e.g. a rider-typed wrong format) are visible.
      appDebug('[date_utils] DD-MM-YYYY parse failed for "$trimmed": $e');
    }

    // ISO 8601 fallback
    try {
      return DateTime.parse(trimmed);
    } catch (e) {
      // ONBOARDING-AUDIT 2026-08-14 P3-11: both formats failed; the
      // caller treats null as "invalid input". Log so the failure is
      // visible without changing the contract.
      appDebug('[date_utils] ISO 8601 parse also failed for "$trimmed": $e');
      return null;
    }
  }

  /// Check whether a string is a valid DD-MM-YYYY date.
  static bool isValidDDMMYYYY(String? input) {
    if (input == null || input.trim().isEmpty) return false;
    final pattern = RegExp(r'^\d{2}-\d{2}-\d{4}$');
    return pattern.hasMatch(input.trim()) && parseDDMMYYYY(input) != null;
  }
}
