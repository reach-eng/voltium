import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/utils/phone_validator.dart';

void main() {
  group('PhoneValidator', () {
    group('isValidPhone', () {
      test('returns true for valid phone numbers', () {
        expect(PhoneValidator.isValidPhone('9876543210'), isTrue);
        expect(PhoneValidator.isValidPhone('6123456789'), isTrue);
        expect(PhoneValidator.isValidPhone('7123456789'), isTrue);
        expect(PhoneValidator.isValidPhone('8123456789'), isTrue);
        expect(PhoneValidator.isValidPhone('98765 43210'),
            isTrue); // Strips non-digits
      });

      test('returns false for invalid prefix', () {
        expect(PhoneValidator.isValidPhone('1234567890'), isFalse);
        expect(PhoneValidator.isValidPhone('5234567890'), isFalse);
      });

      test('returns false for invalid length', () {
        expect(PhoneValidator.isValidPhone('987654321'), isFalse); // 9 digits
        expect(
            PhoneValidator.isValidPhone('98765432101'), isFalse); // 11 digits
      });
    });

    group('validate', () {
      test('returns error when empty or null', () {
        expect(PhoneValidator.validate(''), 'Phone number is required');
        expect(PhoneValidator.validate(null), 'Phone number is required');
      });

      test('returns error for invalid length', () {
        // EDIT-PROFILE-AUDIT P1-2 (2026-09-08): the validator
        // now returns a single canonical message via
        // `isValidIndianMobile` (10 digits, prefix 6–9). The
        // old split messages ("must be 10 digits" / "cannot
        // exceed 10 digits" / "must start with 6,7,8,9") were
        // collapsed into one string to match the server's
        // Zod `.refine` + the `RiderValidationError` thrown by
        // the use-case layer.
        expect(PhoneValidator.validate('987654321'),
            'Enter a valid 10-digit Indian mobile number');
        expect(PhoneValidator.validate('98765432101'),
            'Enter a valid 10-digit Indian mobile number');
      });

      test('returns error for invalid prefix', () {
        expect(PhoneValidator.validate('1234567890'),
            'Enter a valid 10-digit Indian mobile number');
      });

      test('returns null for valid phone', () {
        expect(PhoneValidator.validate('9876543210'), isNull);
        expect(PhoneValidator.validate('98765-43210'), isNull);
      });
    });

    group('validateOtp', () {
      test('returns error when empty or null', () {
        expect(PhoneValidator.validateOtp(''), 'OTP is required');
        expect(PhoneValidator.validateOtp(null), 'OTP is required');
      });

      test('returns error for non-digits', () {
        expect(PhoneValidator.validateOtp('123abc'),
            'OTP must contain only digits');
      });

      test('returns error for invalid length', () {
        expect(PhoneValidator.validateOtp('12345'), 'OTP must be 6 digits');
        expect(PhoneValidator.validateOtp('1234567'),
            'OTP cannot exceed 6 digits');
      });

      test('returns null for valid OTP', () {
        expect(PhoneValidator.validateOtp('123456'), isNull);
      });
    });

    group('formatDisplay', () {
      test('formats less than or equal to 5 digits correctly', () {
        expect(PhoneValidator.formatDisplay('1234'), '1234');
        expect(PhoneValidator.formatDisplay('12345'), '12345');
      });

      test('formats more than 5 digits correctly', () {
        expect(PhoneValidator.formatDisplay('1234567890'), '12345 67890');
      });
    });
  });
}
