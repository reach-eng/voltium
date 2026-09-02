-- NET-005 (audit batch 20, 2026-09-02): add `expiresAt` column to
-- KycProfile so the APPROVED -> EXPIRED state-machine transition
-- (defined at kyc-state-machine.ts:23) can be enforced by a
-- scheduled worker (kyc-expiry.job.ts). Without this column there
-- is no field for the worker to compare against `now` to decide
-- which APPROVED rows are past their expiry window.
--
-- Default: 365 days from approval. The 365-day window matches the
-- existing AuditLog retention period for `kyc.*` actions
-- (web/src/lib/audit-log.ts:4-10 RETENTION_PERIODS) so the
-- expiry-policy horizon and the audit-retention horizon are
-- consistent — when the audit trail for a KYC decision expires,
-- the KYC status itself also expires, and the rider must
-- re-submit.
--
-- Backfill: existing APPROVED rows get expiresAt = now() + 365d
-- (the first expiry sweep will hit them at the same time as
-- freshly-approved rows). Rows in non-APPROVED states get NULL
-- — only APPROVED can transition to EXPIRED.
--
-- The KYC approval use-case (kyc.repository.ts:174) writes
-- `expiresAt: now + 365d` on every approve going forward; the
-- backfill below ensures historical rows have a usable value.

ALTER TABLE "kyc_profiles"
  ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Backfill: APPROVED rows get 365 days from now.
UPDATE "kyc_profiles"
  SET "expiresAt" NOW() + INTERVAL '365 days'
  WHERE "status" = 'APPROVED' AND "expiresAt" IS NULL;

-- Index supports the worker's sweep query:
--   WHERE status = 'APPROVED' AND expiresAt < now
CREATE INDEX "kyc_profiles_status_expiresAt_idx"
  ON "kyc_profiles" ("status", "expiresAt");
