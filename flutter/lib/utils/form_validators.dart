class FormValidators {
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
    if (value == null || value.isEmpty) {
      return null; // Email is optional
    }
    final emailRegex =
        RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
    if (!emailRegex.hasMatch(value)) {
      return 'Please enter a valid email';
    }
    return null;
  }

  static String? aadhaar(String? value) {
    if (value == null || value.isEmpty) {
      return 'Aadhaar number is required';
    }
    final digitsOnly = value.replaceAll(RegExp(r'\D'), '');
    if (digitsOnly.length != 12) {
      return 'Aadhaar must be 12 digits';
    }
    return null;
  }

  static String? pan(String? value) {
    if (value == null || value.isEmpty) {
      return 'PAN is required';
    }
    final panRegex = RegExp(r'^[A-Z]{5}\d{4}[A-Z]$');
    if (!panRegex.hasMatch(value.toUpperCase())) {
      return 'Please enter a valid PAN (e.g., ABCDE1234F)';
    }
    return null;
  }

  static String? bankAccount(String? value) {
    if (value == null || value.isEmpty) {
      return 'Account number is required';
    }
    final digitsOnly = value.replaceAll(RegExp(r'\D'), '');
    if (digitsOnly.length < 8 || digitsOnly.length > 18) {
      return 'Account number must be 8-18 digits';
    }
    return null;
  }

  static String? ifsc(String? value) {
    if (value == null || value.isEmpty) {
      return 'IFSC code is required';
    }
    if (value.trim().isEmpty) {
      return 'IFSC code is required';
    }
    return null;
  }

  static String? minLength(String? value, int min,
      [String fieldName = 'This field']) {
    if (value == null || value.length < min) {
      return '$fieldName must be at least $min characters';
    }
    return null;
  }

  static String? maxLength(String? value, int max,
      [String fieldName = 'This field']) {
    if (value != null && value.length > max) {
      return '$fieldName must be at most $max characters';
    }
    return null;
  }

  static String? combine(List<String? Function()> validators) {
    for (final validator in validators) {
      final error = validator();
      if (error != null) return error;
    }
    return null;
  }
}
