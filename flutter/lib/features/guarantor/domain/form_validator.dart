class GuarantorFormValidator {
  /// Validates all Guarantor form fields and returns a list of missing or invalid fields.
  /// If the returned list is empty, the form is valid and complete.
  static List<String> validate({
    required String name,
    required String dob,
    required String phone,
    required bool isPhoneVerified,
    required String fatherName,
    required String motherName,
    required String address,
    required bool aadhaarFrontUploaded,
    required bool aadhaarBackUploaded,
    required bool panUploaded,
    required bool photoUploaded,
    required bool videoUploaded,
    required bool signatureUploaded,
    String? riderPhone,
  }) {
    final missing = <String>[];

    if (name.trim().isEmpty) missing.add('Name');
    if (dob.trim().isEmpty) missing.add('DOB');

    final cleanPhone = phone.replaceAll(RegExp(r'\D'), '');
    if (cleanPhone.isEmpty || cleanPhone.length < 10) {
      missing.add('Phone');
    } else if (!isPhoneVerified) {
      missing.add('Phone Verified');
    }

    if (riderPhone != null && riderPhone.isNotEmpty) {
      final cleanRiderPhone = riderPhone.replaceAll(RegExp(r'\D'), '');
      if (cleanPhone == cleanRiderPhone) {
        missing.add('Guarantor phone cannot be the same as rider phone');
      }
    }

    if (fatherName.trim().isEmpty) missing.add("Father's Name");
    if (motherName.trim().isEmpty) missing.add("Mother's Name");
    if (address.trim().isEmpty) missing.add('Address');

    if (!aadhaarFrontUploaded) missing.add('Aadhaar Front');
    if (!aadhaarBackUploaded) missing.add('Aadhaar Back');
    if (!panUploaded) missing.add('PAN');
    if (!photoUploaded) missing.add('Photo');
    if (!videoUploaded) missing.add('Video');
    if (!signatureUploaded) missing.add('Signature');

    return missing;
  }
}

/// Parses the server's verify-phone verdict (audit #7 P0-2). The API returns
/// `{ verified: bool }` at the top level or nested under `data`; a wrong OTP
/// is `{ verified: false, message: ... }`. The UI must not mark the phone
/// verified unless the server confirms it.
bool verifyPhoneResponseVerified(Map<String, dynamic> response) =>
    response['data']?['verified'] == true || response['verified'] == true;
