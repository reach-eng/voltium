import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class FormDraftService {
  static const String _prefix = 'form_draft_';

  static Future<void> saveDraft(
      String formKey, Map<String, dynamic> data,) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('$_prefix$formKey', jsonEncode(data));
    } catch (e) {
      // Silent fail for draft saving
    }
  }

  static Future<Map<String, dynamic>?> getDraft(String formKey) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final data = prefs.getString('$_prefix$formKey');
      if (data != null) {
        return jsonDecode(data) as Map<String, dynamic>;
      }
    } catch (e) {
      // Silent fail
    }
    return null;
  }

  static Future<void> clearDraft(String formKey) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('$_prefix$formKey');
    } catch (e) {
      // Silent fail
    }
  }

  static Future<bool> hasDraft(String formKey) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.containsKey('$_prefix$formKey');
    } catch (e) {
      return false;
    }
  }
}

class FormFieldValidator {
  static String? required(String? value, [String fieldName = 'This field']) {
    if (value == null || value.trim().isEmpty) {
      return '$fieldName is required';
    }
    return null;
  }

  static String? phone(String? value) {
    if (value == null || value.isEmpty) {
      return 'Phone number is required';
    }
    final digitsOnly = value.replaceAll(RegExp(r'\D'), '');
    if (digitsOnly.length != 10) {
      return 'Phone must be 10 digits';
    }
    return null;
  }

  static String? email(String? value) {
    if (value == null || value.isEmpty) return null;
    final emailRegex =
        RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
    if (!emailRegex.hasMatch(value)) {
      return 'Please enter a valid email';
    }
    return null;
  }

  static String? aadhaar(String? value) {
    if (value == null || value.isEmpty) return 'Aadhaar is required';
    final digitsOnly = value.replaceAll(RegExp(r'\D'), '');
    if (digitsOnly.length != 12) {
      return 'Aadhaar must be 12 digits';
    }
    return null;
  }

  static String? minLength(String? value, int min,
      [String fieldName = 'Field',]) {
    if (value == null || value.length < min) {
      return '$fieldName must be at least $min characters';
    }
    return null;
  }
}
