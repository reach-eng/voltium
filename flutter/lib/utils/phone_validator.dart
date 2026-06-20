
class PhoneValidator {
  static final RegExp _validPrefix = RegExp(r'^[6-9]');
  static final RegExp _digitsOnly = RegExp(r'^\d+$');

  static bool isValidPhone(String phone) {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    if (digits.length != 10) return false;
    if (!_digitsOnly.hasMatch(digits)) return false;
    if (!_validPrefix.hasMatch(digits)) return false;
    return true;
  }

  static String? validate(String? value) {
    if (value == null || value.isEmpty) {
      return 'Phone number is required';
    }
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (!_digitsOnly.hasMatch(digits)) {
      return 'Only digits are allowed';
    }
    if (digits.length < 10) {
      return 'Phone number must be 10 digits';
    }
    if (digits.length > 10) {
      return 'Phone number cannot exceed 10 digits';
    }
    if (!_validPrefix.hasMatch(digits)) {
      return 'Phone number must start with 6, 7, 8, or 9';
    }
    return null;
  }

  static String? validateOtp(String? value) {
    if (value == null || value.isEmpty) {
      return 'OTP is required';
    }
    if (!RegExp(r'^\d+$').hasMatch(value)) {
      return 'OTP must contain only digits';
    }
    if (value.length < 6) {
      return 'OTP must be 6 digits';
    }
    if (value.length > 6) {
      return 'OTP cannot exceed 6 digits';
    }
    return null;
  }

  static String formatDisplay(String digits) {
    if (digits.length <= 5) return digits;
    return '${digits.substring(0, 5)} ${digits.substring(5)}';
  }
}
