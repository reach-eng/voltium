import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/utils/input_formatters.dart';

void main() {
  group('InputFormatters', () {
    test('phoneFormatter formats phone correctly', () {
      final formatter = InputFormatters.phoneFormatter;
      final oldValue = const TextEditingValue(text: '');

      // Input 10 digits
      var newValue = const TextEditingValue(text: '9876543210');
      var result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, '98765-43210');

      // Input 11 digits (should truncate to 10)
      newValue = const TextEditingValue(text: '98765432101');
      result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, '98765-43210');

      // Input < 5 digits
      newValue = const TextEditingValue(text: '9876');
      result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, '9876');
    });

    test('aadhaarFormatter formats Aadhaar correctly', () {
      final formatter = InputFormatters.aadhaarFormatter;
      final oldValue = const TextEditingValue(text: '');

      // 12 digits
      var newValue = const TextEditingValue(text: '123456789012');
      var result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, '1234-5678-9012');

      // More than 12 digits
      newValue = const TextEditingValue(text: '1234567890123');
      result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, '1234-5678-9012');

      // Less than 4 digits
      newValue = const TextEditingValue(text: '123');
      result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, '123');

      // Less than 8 digits
      newValue = const TextEditingValue(text: '12345');
      result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, '1234-5');
    });

    test('panFormatter formats PAN correctly', () {
      final formatter = InputFormatters.panFormatter;
      final oldValue = const TextEditingValue(text: '');

      // Valid length
      var newValue = const TextEditingValue(text: 'abcde1234f');
      var result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, 'ABCDE1234F'); // Should uppercase

      // Over 10 chars
      newValue = const TextEditingValue(text: 'ABCDE1234F123');
      result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, 'ABCDE1234F'); // Truncated

      // Special chars
      newValue = const TextEditingValue(text: 'A-B.C!D E');
      result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, 'ABCDE'); // Stripped non-alphanumeric
    });

    test('ifscFormatter formats IFSC correctly', () {
      final formatter = InputFormatters.ifscFormatter;
      final oldValue = const TextEditingValue(text: '');

      // Normal
      var newValue = const TextEditingValue(text: 'sbin0123456');
      var result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, 'SBIN0123456');

      // Truncated (max 11)
      newValue = const TextEditingValue(text: 'SBIN01234567');
      result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, 'SBIN0123456');

      // Removes special chars
      newValue = const TextEditingValue(text: 'SBIN-0 123!');
      result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, 'SBIN0123');
    });

    test('bankAccountFormatter formats correctly', () {
      final formatter = InputFormatters.bankAccountFormatter;
      final oldValue = const TextEditingValue(text: '');

      var newValue = const TextEditingValue(text: '1234abc56');
      var result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, '123456'); // Leaves only digits

      newValue = const TextEditingValue(text: '1234567890123456789'); // 19 digits
      result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, '123456789012345678'); // Max 18 digits
    });

    test('pincodeFormatter formats correctly', () {
      final formatter = InputFormatters.pincodeFormatter;
      final oldValue = const TextEditingValue(text: '');

      var newValue = const TextEditingValue(text: '560abc068');
      var result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, '560068');

      newValue = const TextEditingValue(text: '5600681'); // 7 digits
      result = formatter.formatEditUpdate(oldValue, newValue);
      expect(result.text, '560068'); // Max 6 digits
    });
  });
}
