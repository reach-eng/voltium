import 'package:intl/intl.dart';

/// Unified money formatting for all rider-facing rupee amounts.
///
/// Audit 2026-08-22: three incompatible formatters coexisted across wallet,
/// history, rentals and earnings (truncate via `.toInt()`, round via
/// `toStringAsFixed(0)`, regex grouping). Every screen must format through
/// this helper so the same transaction renders identically everywhere.
class MoneyFormat {
  MoneyFormat._();

  /// Groups digits with Indian-style comma separators, e.g. `12,34,567`.
  static final NumberFormat _grouped = NumberFormat.decimalPattern('en_IN');

  /// Formats an amount in rupees with digit grouping and no decimals.
  ///
  /// Paise are ROUNDED (banker-consistent with server display rounding),
  /// e.g. `99.60 -> ₹100`, `499.49 -> ₹499`.
  static String rupees(num amount) => '₹${_grouped.format(amount.round())}';

  /// Formats an amount in rupees keeping paise when present.
  ///
  /// e.g. `99 -> ₹99`, `499.5 -> ₹499.50`, `1234.56 -> ₹1,234.56`.
  static String rupeesExact(num amount) {
    final hasPaise = amount % 1 != 0;
    final pattern = hasPaise ? '#,##0.00' : '#,##0';
    return '₹${NumberFormat(pattern, 'en_IN').format(amount)}';
  }

  /// Digit-grouped number without the currency symbol (for counters).
  static String grouped(num amount) => _grouped.format(amount.round());
}
