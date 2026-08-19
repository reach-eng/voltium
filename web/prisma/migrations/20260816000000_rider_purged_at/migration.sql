-- PR-2026-08-16: purgedAt marker. Set by data-deletion-purge.job.ts when the
-- 7-day appeal window passes and rider PII is destroyed (lifecycleStatus
-- CLOSED + deletedAt already set, fullName → '[PURGED]', PII nulled/sentinelled).
-- The admin data-deletion queue uses this column to distinguish
--   • "pending" — deletedAt set, purgedAt null (still restorable), and
--   • "purged"  — purgedAt set (PII destroyed; restore is no longer possible).

ALTER TABLE "riders"
  ADD COLUMN "purgedAt" TIMESTAMPTZ;
