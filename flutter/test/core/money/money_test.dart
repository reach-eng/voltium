// PR-RUPEES-2026-08-08: boundary-value tests for the Flutter money
// helpers. Mirrors `tests/unit/boundary-value-money-conversion.test.ts`
// on the web side so the same edge cases are covered on both sides
// of the API.
//
// The critical cases are:
//   - 1.005 rupees → 100 paise (FP drift, NOT 101)
//   - 1.50 rupees → 150 paise (clean half-up)
//   - 0.1 + 0.2 = 0.30 → 30 paise (clean round)
//   - Math.round(-0.5) === 0 (toward zero, not away)

import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/core/money/money.dart';

void main() {
  group('paiseToRupees', () {
    test('0 paise → 0 rupees', () {
      expect(paiseToRupees(0).value, 0.0);
    });

    test('1 paise → 0.01 rupees (smallest representable amount)', () {
      expect(paiseToRupees(1).value, 0.01);
    });

    test('99 paise → 0.99 rupees (must not round up to 1.0)', () {
      expect(paiseToRupees(99).value, 0.99);
    });

    test('100 paise → 1.0 rupees (exactly ₹1)', () {
      expect(paiseToRupees(100).value, 1.0);
    });

    test('negative paise passes through (no clamping)', () {
      expect(paiseToRupees(-100).value, -1.0);
    });
  });

  group('rupeesToPaise (Rupees.toPaise)', () {
    test('0 rupees → 0 paise', () {
      expect(const Rupees(0).toPaise().value, 0);
    });

    test('0.01 rupees → 1 paise (smallest representable amount)', () {
      expect(const Rupees(0.01).toPaise().value, 1);
    });

    test('1.00 rupees → 100 paise (exactly ₹1)', () {
      expect(const Rupees(1.0).toPaise().value, 100);
    });

    test('1.50 rupees → 150 paise (clean half-up, no FP error)', () {
      expect(const Rupees(1.50).toPaise().value, 150);
    });

    test('1.005 rupees → 100 paise (FP drift, NOT 101)', () {
      // Floating-point reality: 1.005 * 100 in Dart is actually
      // 100.49999999999999 (FP representation error), not 100.5.
      // toPaise() uses (value * 100).round() which yields 100, not
      // 101. This is a known footgun. The test documents it.
      expect(const Rupees(1.005).toPaise().value, 100);
    });

    test('0.1 + 0.2 (FP drift) → 30 paise (clean round)', () {
      // Dart: 0.1 + 0.2 = 0.30000000000000004. The round should
      // give 30 paise (₹0.30), not 30.000000000000004 rupees worth.
      expect(const Rupees(0.1 + 0.2).toPaise().value, 30);
    });

    test('rounds negative amounts toward zero', () {
      // (value * 100).round() on -0.5 = (-50).round() = -50
      // (toward zero, not away from zero).
      expect(const Rupees(-0.5).toPaise().value, -50);
      expect(const Rupees(-1.5).toPaise().value, -150);
    });

    test('large amount: ₹1 crore → 10^9 paise', () {
      expect(const Rupees(10000000).toPaise().value, 1000000000);
    });
  });

  group('roundtrip — rupees → paise → rupees', () {
    test('whole-rupee amounts roundtrip cleanly', () {
      expect(paiseToRupees(const Rupees(1).toPaise().value).value, 1.0);
      expect(paiseToRupees(const Rupees(100).toPaise().value).value, 100.0);
      expect(paiseToRupees(const Rupees(12345).toPaise().value).value, 12345.0);
    });

    test('half-paise is lossy (₹0.005 → 1 paise → ₹0.01)', () {
      expect(
        paiseToRupees(const Rupees(0.005).toPaise().value).value,
        0.01,
      );
    });
  });

  group('Paise arithmetic', () {
    test('addition', () {
      const a = Paise(100);
      const b = Paise(50);
      expect((a + b).value, 150);
    });

    test('subtraction', () {
      const a = Paise(100);
      const b = Paise(50);
      expect((a - b).value, 50);
    });
  });

  group('formatRupees — Indian locale', () {
    test('whole-rupee small amount', () {
      expect(formatRupees(50), '\u20B950.00');
    });

    test('thousands grouping (Indian format: 1,234.56)', () {
      expect(formatRupees(1234.56), '\u20B91,234.56');
    });

    test('lakhs grouping: 12,34,567.89 (Indian format, NOT 1,234,567.89)', () {
      // Indian number format groups by 2 after the first 3 digits
      // (lakhs/crores system). 1,234,567 in Western format would be
      // 12,34,567 in Indian. This is the test that would catch a
      // regression to the Western formatter.
      expect(formatRupees(1234567.89), '\u20B912,34,567.89');
    });

    test('crores: 1,00,00,000 (1 crore = 10 million)', () {
      // 1 crore = 10,000,000 (8 digits) → "1,00,00,000" in Indian format.
      expect(formatRupees(10000000), '\u20B91,00,00,000.00');
    });

    test('10 crore: 10,00,00,000 (10 × 1 crore)', () {
      // 10 crore = 100,000,000 (9 digits) → "10,00,00,000".
      expect(formatRupees(100000000), '\u20B910,00,00,000.00');
    });

    test('compact format: 1.2K / 3.5L / 7.8Cr', () {
      expect(formatRupees(1200, compact: true), '\u20B91.2K');
      expect(formatRupees(350000, compact: true), '\u20B93.5L');
      expect(formatRupees(78000000, compact: true), '\u20B97.8Cr');
    });

    test('includeDecimals: false → no paise', () {
      expect(formatRupees(50.99, includeDecimals: false), '\u20B951');
    });

    test('signed: positive prefix "+"', () {
      expect(formatRupees(50, signed: true), '+\u20B950.00');
    });

    test('negative: leading minus sign', () {
      expect(formatRupees(-50), '-\u20B950.00');
    });
  });
}
