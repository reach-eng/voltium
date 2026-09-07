/**
 * KYC-CORRECTION-P0-2026-09-08 (P0-1): canonical KYC correction-field
 * taxonomy — single source of truth for the admin panel.
 *
 * Mirrors `flutter/lib/features/kyc/data/kyc_fields.dart`. The order
 * matches the onboarding form (step 1: personal details, step 2:
 * identity & bank, step 3: selfie & signature) so the rider app's
 * `firstFlaggedKycStep` aligns with the admin's field picker.
 *
 * Used by:
 *  - `useKyc.ts` (KYC admin hook) — populates the editableFields array
 *    sent to the server when an admin clicks Reject / Request
 *    Correction
 *  - `KycDialogs.tsx` (admin reject dialog) — renders the field
 *    picker checkboxes
 *  - `rider.use-cases.ts` (server) — the editableFields allowlist
 *    gates which fields a rider can resubmit
 */

export type KycCorrectionField =
  | 'fullName'
  | 'fatherName'
  | 'motherName'
  | 'dob'
  | 'email'
  | 'currentAddress'
  | 'aadhaarFront'
  | 'aadhaarBack'
  | 'panCard'
  | 'bankName'
  | 'accountNumber'
  | 'ifscCode'
  | 'profilePhoto'
  | 'signature';

/** Canonical field keys in onboarding-form order. */
export const KYC_CORRECTION_FIELDS: ReadonlyArray<{
  key: KycCorrectionField;
  label: string;
  group: 'personal' | 'identity' | 'media';
}> = [
  { key: 'fullName', label: 'Full name', group: 'personal' },
  { key: 'fatherName', label: "Father's name", group: 'personal' },
  { key: 'motherName', label: "Mother's name", group: 'personal' },
  { key: 'dob', label: 'Date of birth', group: 'personal' },
  { key: 'email', label: 'Email', group: 'personal' },
  { key: 'currentAddress', label: 'Current address', group: 'personal' },
  { key: 'aadhaarFront', label: 'Aadhaar (front)', group: 'identity' },
  { key: 'aadhaarBack', label: 'Aadhaar (back)', group: 'identity' },
  { key: 'panCard', label: 'PAN card', group: 'identity' },
  { key: 'bankName', label: 'Bank name', group: 'identity' },
  { key: 'accountNumber', label: 'Account number', group: 'identity' },
  { key: 'ifscCode', label: 'IFSC code', group: 'identity' },
  { key: 'profilePhoto', label: 'Profile photo', group: 'media' },
  { key: 'signature', label: 'Signature', group: 'media' },
] as const;

/** All valid editable-field keys (server-side allowlist reference). */
export const KYC_CORRECTION_FIELD_KEYS: ReadonlyArray<KycCorrectionField> =
  KYC_CORRECTION_FIELDS.map((f) => f.key);

/** Human-friendly label for a field key. Falls back to the raw key. */
export function kycFieldLabel(key: string): string {
  const found = KYC_CORRECTION_FIELDS.find((f) => f.key === key);
  return found?.label ?? key;
}
