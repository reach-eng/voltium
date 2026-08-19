/// Money types and conversion helpers.
///
/// All Voltium users are based in India. The backend stores money in
/// **paise** (1/100 of a rupee — integer). The API exposes money in
/// **rupees** (decimal). The Flutter app receives and displays rupees.
///
/// Two values are NEVER interchangeable. To pass a rupee value where a
/// paise value is expected, you must call `rupeesToPaise()` explicitly.
/// The reverse is `paiseToRupees()`.
///
/// ## Why two types
///
/// A naive `num` for both paise and rupees is the classic source of
/// `1.005 → 100` vs `1.005 → 101` bugs (FP imprecision, see
/// `tests/unit/boundary-value-money-conversion.test.ts` on the web side
/// and the matching test on the Flutter side). Wrapping the value in
/// a typed class makes the unit a developer-visible concern: a
/// `Rupees` cannot be passed where a `Paise` is expected, and vice
/// versa. The runtime cost is zero (Dart's tree-shaker erases the
/// wrapper class for typed primitives at compile time in release mode).
///
/// ## Conversion rules
///
/// - `rupeesToPaise(1.50) = 150` (Math.round, half-up for positive)
/// - `paiseToRupees(150) = 1.5` (decimal, may be 1.50 if formatted)
/// - `rupeesToPaise(1.005) = 100` — JS/Dart FP: 1.005 is actually
///   1.00499... in IEEE 754, so Math.round gives 100. This is a
///   known edge case the boundary tests document.
library;

import 'dart:ui' show Locale;

/// Integer paise (1/100 of a rupee). The DB unit, never displayed
/// directly to users.
class Paise {
  final int value;
  const Paise(this.value);

  /// Sum two paise values (integer math, no rounding).
  Paise operator +(Paise other) => Paise(value + other.value);

  /// Subtract paise values. Caller is responsible for ensuring the
  /// result is non-negative (the ledger service enforces this).
  Paise operator -(Paise other) => Paise(value - other.value);

  @override
  String toString() => 'Paise($value)';

  @override
  bool operator ==(Object other) => other is Paise && other.value == value;

  @override
  int get hashCode => value.hashCode;
}

/// Decimal rupees, e.g. 49.95 for ₹49.95. The display unit, the API
/// contract unit, the form input unit.
class Rupees {
  final double value;
  const Rupees(this.value);

  /// Convert decimal rupees to integer paise. Math.round is
  /// half-away-from-zero for positive values and half-toward-zero
  /// for negative values. Since the app never has negative inputs,
  /// this is effectively half-up.
  Paise toPaise() => Paise((value * 100).round());

  /// Add two rupee values. Returns a Rupee (not a Paise) — the
  /// caller is responsible for converting to paise at the storage
  /// boundary if needed.
  Rupees operator +(Rupees other) => Rupees(value + other.value);

  /// Subtract rupee values. Result may be negative (e.g. an overdue
  /// wallet balance); the UI decides how to render it.
  Rupees operator -(Rupees other) => Rupees(value - other.value);

  /// True if the value is exactly zero. Useful for "low balance" or
  /// "empty wallet" gates.
  bool get isZero => value == 0.0;

  /// True if the value is negative.
  bool get isNegative => value < 0.0;

  @override
  String toString() => 'Rupees($value)';

  @override
  bool operator ==(Object other) => other is Rupees && other.value == value;

  @override
  int get hashCode => value.hashCode;
}

/// Convenience: convert integer paise to a Rupees value. Inverse of
/// `Rupees.toPaise()`.
Rupees paiseToRupees(int paise) => Rupees(paise / 100.0);

/// Convenience: convert decimal rupees to integer paise. Inverse of
/// `paiseToRupees()`.
Paise rupeesToPaise(double rupees) => Rupees(rupees).toPaise();

/// Format a rupee value as Indian-locale currency.
///
/// The output is "₹1,234.56" for typical amounts (with the rupee
/// symbol, no trailing space). The Indian number format uses the
/// lakh/crore grouping: 1,00,000 instead of 100,000.
///
/// **LANGUAGE-AUDIT (2026-08-16) #2:** this function does NOT call
/// `NumberFormat.currency(locale: 'en_IN')` (the previous doc
/// comment was wrong) — the implementation does manual Indian
/// grouping via [_groupIndian] and emits the U+20B9 "₹" symbol
/// directly. The rupee symbol is hard-coded to U+20B9 regardless of
/// the rider's chosen language because the brand is
/// Indian-rupee-first; the symbol is the same in both en and hi
/// locales. A non-null [locale] switches the grouping style
/// (Indian lakh/crore for `*_IN`, Western thousands for everything
/// else) so future Western-locale riders see `1,234,567` instead of
/// `12,34,567`. Defaults to `null` (Indian grouping, brand rupee).
///
/// Pass `includeDecimals: false` to drop the paise (e.g. for headlines
/// like "₹50 off" where the decimals are noise). Pass `compact: true`
/// for large amounts ("₹1.2L" instead of "₹1,20,000").
String formatRupees(
  num value, {
  bool includeDecimals = true,
  bool compact = false,
  bool signed = false,
  Locale? locale,
}) {
  if (compact) {
    return _formatCompact(value.toDouble(),
        includeDecimals: includeDecimals, signed: signed, locale: locale);
  }
  // The rupee symbol is U+20B9. We use it directly instead of the
  // locale-default "Rs." because the brand is Indian-rupee-first.
  // The sign (if any) goes BEFORE the rupee symbol in the standard
  // accounting format: "-₹50.00", "+₹50.00", "₹50.00".
  final isNeg = value < 0;
  final absValue = value.abs();
  final sign = isNeg ? '-' : (signed && value > 0 ? '+' : '');
  final decimals = includeDecimals ? 2 : 0;
  // LANGUAGE-AUDIT (2026-08-16) #2: when an explicit non-IN locale
  // is passed, switch to Western thousands grouping
  // (1,234,567 instead of 12,34,567). Default is Indian grouping
  // because the brand is Indian-rupee-first.
  final useIndian = locale == null || locale.countryCode == 'IN';
  final s = absValue.toStringAsFixed(decimals);
  final parts = s.split('.');
  final grouped = useIndian ? _groupIndian(parts[0]) : _groupWestern(parts[0]);
  final decPart = parts.length > 1 ? '.${parts[1]}' : '';
  return '$sign\u20B9$grouped$decPart';
}

String _formatCompact(double value,
    {required bool includeDecimals, required bool signed, Locale? locale}) {
  final isNeg = value < 0;
  final abs = value.abs();
  final sign = isNeg ? '-' : (signed && value > 0 ? '+' : '');
  // Compact form uses 1 decimal (e.g. "1.2K", not "1.20K") so the
  // abbreviation stays compact. includeDecimals: true keeps the
  // decimal; false drops it entirely.
  final decimals = includeDecimals ? 1 : 0;
  String body;
  if (abs >= 10000000) {
    // 1 crore = 1,00,00,000
    body = '${(abs / 10000000).toStringAsFixed(decimals)}Cr';
  } else if (abs >= 100000) {
    // 1 lakh = 1,00,000
    body = '${(abs / 100000).toStringAsFixed(decimals)}L';
  } else if (abs >= 1000) {
    body = '${(abs / 1000).toStringAsFixed(decimals)}K';
  } else {
    body = abs.toStringAsFixed(includeDecimals ? 2 : 0);
  }
  return '$sign\u20B9$body';
}

String _groupIndian(String digits) {
  // Indian number format: last 3 digits, then groups of 2.
  // e.g. 1234567 → 12,34,567
  // e.g. 100000000 → 1,00,00,000
  // (NOT 100,0,00,000 — the Western format would group by 3)
  if (digits.length <= 3) return digits;
  final last3 = digits.substring(digits.length - 3);
  final rest = digits.substring(0, digits.length - 3);
  if (rest.isEmpty) return last3;
  // Split `rest` into chunks of up to 2 digits from the right.
  // The leftmost chunk may be 1 or 2 digits.
  final buf = StringBuffer();
  var i = rest.length;
  // Take the leading chunk (1 or 2 digits).
  final leadingLen = i % 2 == 0 ? 2 : 1;
  buf.write(rest.substring(0, leadingLen));
  i = leadingLen;
  while (i < rest.length) {
    buf.write(',');
    buf.write(rest.substring(i, i + 2));
    i += 2;
  }
  buf.write(',');
  buf.write(last3);
  return buf.toString();
}

/// Western thousands grouping: 1234567 → 1,234,567.
/// LANGUAGE-AUDIT (2026-08-16) #2: only used when an explicit
/// non-IN locale is passed to [formatRupees]. The brand default is
/// Indian grouping.
String _groupWestern(String digits) {
  if (digits.length <= 3) return digits;
  final buf = StringBuffer();
  var i = digits.length % 3;
  if (i == 0) i = 3;
  buf.write(digits.substring(0, i));
  while (i < digits.length) {
    buf.write(',');
    buf.write(digits.substring(i, i + 3));
    i += 3;
  }
  return buf.toString();
}
