class FormValidators {
  static const _verhoeffD = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  ];

  static const _verhoeffP = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
  ];

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
    if (!_isValidVerhoeff(digitsOnly)) {
      return 'Invalid Aadhaar number';
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
    final ifscRegex = RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$');
    if (!ifscRegex.hasMatch(value.trim().toUpperCase())) {
      return 'Please enter a valid IFSC code';
    }
    return null;
  }

  static String? minLength(
    String? value,
    int min, [
    String fieldName = 'This field',
  ]) {
    if (value == null || value.length < min) {
      return '$fieldName must be at least $min characters';
    }
    return null;
  }

  static String? maxLength(
    String? value,
    int max, [
    String fieldName = 'This field',
  ]) {
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

  static bool _isValidVerhoeff(String digits) {
    var checksum = 0;
    final reversed = digits.split('').reversed.toList();
    for (var i = 0; i < reversed.length; i++) {
      final digit = int.parse(reversed[i]);
      checksum = _verhoeffD[checksum][_verhoeffP[i % 8][digit]];
    }
    return checksum == 0;
  }
}
