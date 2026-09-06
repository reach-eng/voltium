-- PR-KYC-CORRECTION (2026-09-06): widen the KycProfile.editableFields
-- allowlist to the full KYC correction taxonomy.
--
-- The admin "Request Correction" flow now lets the reviewer tick the
-- exact fields that need fixing — including document and bank keys —
-- and the rider app renders orange borders on exactly those fields
-- before resubmitting. The previous constraint
-- (20260730131814_convert_json_columns) only allowed
-- ['name', 'email', 'dob', 'currentAddress', 'emergencyContact'], so
-- any correction touching a document/bank key (aadhaarFront, panCard,
-- accountNumber, …) violated the CHECK and failed the whole update.
--
-- The canonical keys mirror web/src/server/modules/kyc/kyc.types.ts
-- (EditableField) and the rider form's field ids
-- (flutter/lib/features/kyc/data/kyc_fields.dart). Legacy keys
-- ('name', 'emergencyContact') are kept so existing rows stay valid.

ALTER TABLE "kyc_profiles" DROP CONSTRAINT IF EXISTS "kyc_editable_fields_allowlist";

ALTER TABLE "kyc_profiles" ADD CONSTRAINT "kyc_editable_fields_allowlist"
CHECK (
    "editableFields" <@ ARRAY[
        'name', 'email', 'dob', 'currentAddress', 'emergencyContact',
        'fullName', 'fatherName', 'motherName',
        'aadhaarFront', 'aadhaarBack', 'panCard',
        'bankName', 'accountNumber', 'ifscCode',
        'profilePhoto', 'signature'
    ]::text[]
);
