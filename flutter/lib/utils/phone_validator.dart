class PhoneValidator {
  static final RegExp _validPrefix = RegExp(r'^[6-9]');
  static final RegExp _digitsOnly = RegExp(r'^\d+$');

  /// EDIT-PROFILE-AUDIT P1-2 (2026-09-08): canonical "Indian
  /// mobile" rule used by the client edit-profile flow + OTP
  /// gate. Mirrors the server's `isValidIndianMobile` in
  /// `web/src/lib/phone.ts`. Strips `+91` / spaces / dashes
  /// before the check.
  static bool isValidIndianMobile(String phone) {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    if (digits.length != 10) return false;
    return _validPrefix.hasMatch(digits);
  }

  static bool isValidPhone(String phone) {
    return isValidIndianMobile(phone) &&
        _digitsOnly.hasMatch(phone.replaceAll(RegExp(r'\D'), ''));
  }

  static String? validate(String? value) {
    if (value == null || value.isEmpty) {
      return 'Phone number is required';
    }
    if (!isValidIndianMobile(value)) {
      return 'Enter a valid 10-digit Indian mobile number';
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

  /// P2: build a safe `tel:` URI from a server-provided phone string.
  /// Keeps digits with at most one leading `+` (the old `[^\d+]` filter
  /// preserved embedded `+`, e.g. `12+34` → invalid `tel:12+34`) and
  /// enforces an E.164-plausible 7–15 digit length. Returns null when the
  /// input cannot dial.
  static Uri? toDialUri(String? raw) {
    if (raw == null) return null;
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 7 || digits.length > 15) return null;
    final normalized = raw.trim().startsWith('+') ? '+$digits' : digits;
    return Uri.tryParse('tel:$normalized');
  }
}
