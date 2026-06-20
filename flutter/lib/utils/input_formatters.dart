import 'package:flutter/services.dart';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class InputFormatters {
  static final phoneFormatter =
      TextInputFormatter.withFunction((oldValue, newValue) {
    String text = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (text.length > 10) text = text.substring(0, 10);

    String formatted = text;
    if (text.length >= 5) {
      formatted = '${text.substring(0, 5)}-${text.substring(5)}';
    }
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  });

  static final aadhaarFormatter =
      TextInputFormatter.withFunction((oldValue, newValue) {
    String text = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (text.length > 12) text = text.substring(0, 12);

    String formatted = text;
    if (text.length >= 4) {
      formatted = '${text.substring(0, 4)}-${text.substring(4)}';
    }
    if (text.length >= 8) {
      formatted = '${formatted.substring(0, 9)}-${formatted.substring(9)}';
    }

    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  });

  static final panFormatter =
      TextInputFormatter.withFunction((oldValue, newValue) {
    String text =
        newValue.text.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
    if (text.length > 10) text = text.substring(0, 10);
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  });

  static final ifscFormatter =
      TextInputFormatter.withFunction((oldValue, newValue) {
    String text =
        newValue.text.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
    if (text.length > 11) text = text.substring(0, 11);
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  });

  static final bankAccountFormatter =
      TextInputFormatter.withFunction((oldValue, newValue) {
    String text = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (text.length > 18) text = text.substring(0, 18);
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  });

  static final pincodeFormatter =
      TextInputFormatter.withFunction((oldValue, newValue) {
    String text = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (text.length > 6) text = text.substring(0, 6);
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  });
}

class FocusDecorations {
  static InputDecoration withFocus(
    InputDecoration decoration, {
    Color focusColor = AppColors.primary,
    Color errorColor = const Color(0xFFD92D20),
    bool hasError = false,
  }) {
    return decoration.copyWith(
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color: hasError ? errorColor : focusColor,
          width: 2,
        ),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color: hasError ? errorColor : AppColors.outline,
        ),
      ),
    );
  }
}
