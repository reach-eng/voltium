/// RIDER-FORMAT-2026-09-07 (P3-4): unit tests for the shared
/// `formatRiderPhone` helper. Verifies the four canonical inputs:
///   - `+91XXXXXXXXXX` (full E.164) → `+91 XXXXX XXXXX`
///   - `91XXXXXXXXXX` (no +91 prefix) → same
///   - `XXXXXXXXXX` (raw 10 digits) → same
///   - too-short or empty → returned unchanged
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/utils/phone_formatter.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('formatRiderPhone', () {
    test('+91XXXXXXXXXX → +91 XXXXX XXXXX', () {
      expect(formatRiderPhone('+919876543210'), '+91 98765 43210');
    });

    test('91XXXXXXXXXX (no +) → +91 XXXXX XXXXX', () {
      expect(formatRiderPhone('919876543210'), '+91 98765 43210');
    });

    test('XXXXXXXXXX (raw 10 digits) → +91 XXXXX XXXXX', () {
      expect(formatRiderPhone('9876543210'), '+91 98765 43210');
    });

    test('too short → returned unchanged', () {
      expect(formatRiderPhone('12345'), '12345');
    });

    test('empty → returned unchanged', () {
      expect(formatRiderPhone(''), '');
    });
  });
}
