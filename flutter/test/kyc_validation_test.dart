/// Tests for KYC validation logic — FormValidators.
///
/// These test the existing form_validators.dart Aadhaar/PAN/IFSC validation.
library;
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/utils/form_validators.dart';

void main() {
  group('FormValidators.aadhaar', () {
    test('accepts valid 12-digit Aadhaar', () {
      expect(FormValidators.aadhaar('123456789010'), isNull);
    });

    test('accepts Aadhaar with spaces', () {
      expect(FormValidators.aadhaar('1234 5678 9010'), isNull);
    });

    test('rejects Aadhaar with less than 12 digits', () {
      expect(FormValidators.aadhaar('12345678901'), isNotNull);
    });

    test('rejects Aadhaar with non-numeric characters', () {
      expect(FormValidators.aadhaar('12345678901a'), isNotNull);
    });

    test('rejects empty Aadhaar', () {
      expect(FormValidators.aadhaar(''), isNotNull);
    });

    test('rejects null Aadhaar', () {
      expect(FormValidators.aadhaar(null), isNotNull);
    });
  });

  group('FormValidators.pan', () {
    test('accepts valid PAN format', () {
      expect(FormValidators.pan('ABCDE1234F'), isNull);
    });

    test('accepts lowercase PAN and normalizes', () {
      expect(FormValidators.pan('abcde1234f'), isNull);
    });

    test('rejects PAN with wrong format (too short)', () {
      expect(FormValidators.pan('ABCDE1234'), isNotNull);
    });

    test('rejects PAN with numbers in first 5 chars', () {
      expect(FormValidators.pan('ABC1E1234F'), isNotNull);
    });

    test('rejects PAN with letters in position 6-9', () {
      expect(FormValidators.pan('ABCDE1234F'), isNull); // valid
      expect(FormValidators.pan('ABCDEABCD'),
          isNotNull,); // letters in digit positions
    });

    test('rejects empty PAN', () {
      expect(FormValidators.pan(''), isNotNull);
    });

    test('rejects null PAN', () {
      expect(FormValidators.pan(null), isNotNull);
    });
  });

  group('FormValidators.ifsc', () {
    test('accepts non-empty IFSC', () {
      expect(FormValidators.ifsc('SBIN0001234'), isNull);
    });

    test('rejects empty IFSC', () {
      expect(FormValidators.ifsc(''), isNotNull);
    });

    test('rejects null IFSC', () {
      expect(FormValidators.ifsc(null), isNotNull);
    });

    test('rejects whitespace-only IFSC', () {
      expect(FormValidators.ifsc('   '), isNotNull);
    });
  });

  group('FormValidators.bankAccount', () {
    test('accepts valid 10-digit account', () {
      expect(FormValidators.bankAccount('1234567890'), isNull);
    });

    test('accepts 8-digit account (minimum)', () {
      expect(FormValidators.bankAccount('12345678'), isNull);
    });

    test('accepts 18-digit account (maximum)', () {
      expect(FormValidators.bankAccount('123456789012345678'), isNull);
    });

    test('rejects account with less than 8 digits', () {
      expect(FormValidators.bankAccount('1234567'), isNotNull);
    });

    test('rejects account with more than 18 digits', () {
      expect(FormValidators.bankAccount('1234567890123456789'), isNotNull);
    });

    test('rejects empty account', () {
      expect(FormValidators.bankAccount(''), isNotNull);
    });
  });

  group('FormValidators.phone', () {
    test('accepts valid 10-digit phone', () {
      expect(FormValidators.phone('9876543210'), isNull);
    });

    test('rejects phone with less than 10 digits', () {
      expect(FormValidators.phone('987654321'), isNotNull);
    });

    test('rejects empty phone', () {
      expect(FormValidators.phone(''), isNotNull);
    });
  });

  group('FormValidators.required', () {
    test('accepts non-empty value', () {
      expect(FormValidators.required('hello'), isNull);
    });

    test('rejects empty value', () {
      expect(FormValidators.required(''), isNotNull);
    });

    test('rejects null value', () {
      expect(FormValidators.required(null), isNotNull);
    });

    test('rejects whitespace-only value', () {
      expect(FormValidators.required('   '), isNotNull);
    });
  });

  group('FormValidators.combine', () {
    test('returns first error from validators', () {
      final error = FormValidators.combine([
        () => FormValidators.required(''),
        () => FormValidators.phone('123'),
      ]);
      expect(error, contains('required'));
    });

    test('returns null when all validators pass', () {
      final error = FormValidators.combine([
        () => FormValidators.required('hello'),
        () => FormValidators.phone('9876543210'),
      ]);
      expect(error, isNull);
    });
  });
}
