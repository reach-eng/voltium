-- PR-KYC-CORRECTION (2026-09-06): kyc_profiles.pendingCorrections
--
-- Holds the rider-resubmitted values for the admin-flagged
-- editableFields, parked here (NOT written to the real columns)
-- until an admin APPROVES the KYC. Shape:
--   { values: { [canonicalFieldKey]: string }, submittedAt: ISO string }
--
-- Promotion (values -> real columns + cleared blob) happens in
-- kyc.repository.applyPendingCorrections, invoked by both
-- approve paths. Cleared when the admin re-rejects or
-- re-requests correction.
--
-- Nullable, no default. Existing rows get NULL; the admin
-- "Request Correction" flow writes a non-null value when a
-- rider resubmits. No backfill needed.

ALTER TABLE "kyc_profiles" ADD COLUMN "pendingCorrections" JSONB;
