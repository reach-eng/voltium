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
        expect(PhoneValidator.isValidPhone('98765 43210'), isTrue); // Strips non-digits
      });

      test('returns false for invalid prefix', () {
        expect(PhoneValidator.isValidPhone('1234567890'), isFalse);
        expect(PhoneValidator.isValidPhone('5234567890'), isFalse);
      });

      test('returns false for invalid length', () {
        expect(PhoneValidator.isValidPhone('987654321'), isFalse); // 9 digits
        expect(PhoneValidator.isValidPhone('98765432101'), isFalse); // 11 digits
      });
    });

    group('validate', () {
      test('returns error when empty or null', () {
        expect(PhoneValidator.validate(''), 'Phone number is required');
        expect(PhoneValidator.validate(null), 'Phone number is required');
      });

      test('returns error for invalid length', () {
        expect(PhoneValidator.validate('987654321'), 'Phone number must be 10 digits');
        expect(PhoneValidator.validate('98765432101'), 'Phone number cannot exceed 10 digits');
      });

      test('returns error for invalid prefix', () {
        expect(PhoneValidator.validate('1234567890'), 'Phone number must start with 6, 7, 8, or 9');
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
        expect(PhoneValidator.validateOtp('123abc'), 'OTP must contain only digits');
      });

      test('returns error for invalid length', () {
        expect(PhoneValidator.validateOtp('12345'), 'OTP must be 6 digits');
        expect(PhoneValidator.validateOtp('1234567'), 'OTP cannot exceed 6 digits');
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
