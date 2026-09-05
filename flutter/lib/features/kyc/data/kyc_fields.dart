// PR-KYC-CORRECTION (2026-09-06): canonical KYC correction-field taxonomy
// — single source of truth for the rider app.
//
// Values mirror the admin checklist
// (web/src/components/admin/screens/kyc-management/correction-fields.ts)
// and the `kyc_editable_fields_allowlist` DB constraint. The ORDER below
// matches the onboarding form, so "first flagged field" routes the rider
// to the right step:
//   step 1 — Personal details   (fullName … currentAddress)
//   step 2 — Identity & bank    (aadhaarFront … ifscCode)
//   step 3 — Selfie & signature (profilePhoto, signature)

/// Canonical field keys in onboarding-form order.
const List<String> kycCorrectionFieldOrder = <String>[
  'fullName',
  'fatherName',
  'motherName',
  'dob',
  'email',
  'currentAddress',
  'aadhaarFront',
  'aadhaarBack',
  'panCard',
  'bankName',
  'accountNumber',
  'ifscCode',
  'profilePhoto',
  'signature',
];

/// Legacy / alternate server keys mapped onto the canonical ones
/// (the server's EditableField enum historically used 'name' and
/// 'address'; 'pan'/'selfie' are defensive aliases).
const Map<String, String> _kycFieldAliases = <String, String>{
  'name': 'fullName',
  'address': 'currentAddress',
  'pan': 'panCard',
  'selfie': 'profilePhoto',
};

/// Maps a raw flagged-field key onto its canonical form key
/// (aliases resolved; unknown keys pass through unchanged).
String normalizeKycFieldKey(String raw) {
  final trimmed = raw.trim();
  return _kycFieldAliases[trimmed] ?? trimmed;
}

/// Normalizes a raw flagged-field list: aliases resolved, unknown keys
/// dropped, de-duplicated, and ordered per the onboarding form.
List<String> normalizeKycEditableFields(List<String>? raw) {
  if (raw == null || raw.isEmpty) return const <String>[];
  final seen = raw
      .map((f) => _kycFieldAliases[f.trim()] ?? f.trim())
      .where(kycCorrectionFieldOrder.contains)
      .toSet();
  return kycCorrectionFieldOrder.where(seen.contains).toList();
}

/// The onboarding step (1-3) that owns the FIRST flagged field — the
/// step the "Correct the details" button deep-links to. Defaults to 1
/// when nothing is flagged.
int firstFlaggedKycStep(List<String>? raw) {
  final fields = normalizeKycEditableFields(raw);
  if (fields.isEmpty) return 1;
  final first = fields.first;
  if (first == 'profilePhoto' || first == 'signature') return 3;
  if (kycCorrectionFieldOrder.indexOf(first) >=
      kycCorrectionFieldOrder.indexOf('aadhaarFront')) {
    return 2;
  }
  return 1;
}

/// English labels for the flagged-field chips. Localized labels are
/// resolved through AppLocalizations by the caller where available;
/// these are the fallbacks.
const Map<String, String> kycCorrectionFieldLabels = <String, String>{
  'fullName': 'Full name',
  'name': 'Full name',
  'fatherName': "Father's name",
  'motherName': "Mother's name",
  'dob': 'Date of birth',
  'email': 'Email',
  'currentAddress': 'Address',
  'address': 'Address',
  'aadhaarFront': 'Aadhaar card (front)',
  'aadhaarBack': 'Aadhaar card (back)',
  'panCard': 'PAN card',
  'pan': 'PAN card',
  'bankName': 'Bank details',
  'accountNumber': 'Bank details',
  'ifscCode': 'Bank details',
  'profilePhoto': 'Profile photo',
  'selfie': 'Profile photo',
  'signature': 'Signature',
};

/// Label for a raw (un-normalized) key, with fallback to the key itself.
String kycCorrectionFieldLabel(String rawKey) =>
    kycCorrectionFieldLabels[rawKey] ?? kycCorrectionFieldLabels[_kycFieldAliases[rawKey]] ?? rawKey;
