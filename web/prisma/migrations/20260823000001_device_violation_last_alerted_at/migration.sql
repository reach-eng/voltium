-- T-96 (PR-6, 2026-08-23): 24h alerted-marker on device_violations.
-- The previous code fired a Slack page + DEVICE_VIOLATION outbox
-- emit every minute the violation was active, because the emit sat
-- OUTSIDE the new-violation guard at
-- device-compliance.job.ts:70-73. The marker is set when a real
-- new violation is created (in the same `if (!existing)` branch
-- that already gates the `db.deviceViolation.create`).
ALTER TABLE "device_violations"
  ADD COLUMN "lastAlertedAt" TIMESTAMPTZ NULL;
