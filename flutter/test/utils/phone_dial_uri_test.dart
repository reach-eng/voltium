import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/utils/phone_validator.dart';

void main() {
  group('PhoneValidator.toDialUri (dashboard P2 tel: hardening)', () {
    test('accepts plain 10-digit numbers', () {
      expect(
          PhoneValidator.toDialUri('9876543210')?.toString(), 'tel:9876543210');
    });

    test('keeps a single leading plus', () {
      expect(PhoneValidator.toDialUri('+919876543210')?.toString(),
          'tel:+919876543210');
    });

    test('rejects embedded plus signs', () {
      expect(PhoneValidator.toDialUri('12+34'), isNull);
    });

    test('rejects too-short and too-long inputs', () {
      expect(PhoneValidator.toDialUri('123'), isNull);
      expect(PhoneValidator.toDialUri('1234567890123456'), isNull);
      expect(PhoneValidator.toDialUri(''), isNull);
      expect(PhoneValidator.toDialUri(null), isNull);
    });

    test('strips formatting characters', () {
      expect(PhoneValidator.toDialUri('+91 98765 43210')?.toString(),
          'tel:+919876543210');
    });
  });
}
