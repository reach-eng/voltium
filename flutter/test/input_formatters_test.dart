import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/services.dart';

void main() {
  group('InputFormatters', () {
    test('phone formatter limits to 10 digits', () {
      final formatter = TextInputFormatter.withFunction((oldValue, newValue) {
        String text = newValue.text.replaceAll(RegExp(r'\D'), '');
        if (text.length > 10) text = text.substring(0, 10);
        return TextEditingValue(text: text);
      });

      final result = formatter.formatEditUpdate(
        const TextEditingValue(text: ''),
        const TextEditingValue(text: '98765432101'),
      );
      expect(result.text.length, 10);
    });

    test('aadhaar formatter limits to 12 digits', () {
      final formatter = TextInputFormatter.withFunction((oldValue, newValue) {
        String text = newValue.text.replaceAll(RegExp(r'\D'), '');
        if (text.length > 12) text = text.substring(0, 12);
        return TextEditingValue(text: text);
      });

      final result = formatter.formatEditUpdate(
        const TextEditingValue(text: ''),
        const TextEditingValue(text: '1234567890123'),
      );
      expect(result.text.length, 12);
    });

    test('pan formatter limits to 10 characters', () {
      final formatter = TextInputFormatter.withFunction((oldValue, newValue) {
        String text =
            newValue.text.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
        if (text.length > 10) text = text.substring(0, 10);
        return TextEditingValue(text: text);
      });

      final result = formatter.formatEditUpdate(
        const TextEditingValue(text: ''),
        const TextEditingValue(text: 'abcde1234fghij'),
      );
      expect(result.text.length, 10);
    });
  });
}
