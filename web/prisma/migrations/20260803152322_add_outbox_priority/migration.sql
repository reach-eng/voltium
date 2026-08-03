-- PR-75: add `priority` column to outbox_events for the
-- interactive-vs-background split (Backend N2).
--
-- Background:
-- All 11 background jobs currently share a single queue (the
-- outbox_events table) with FIFO ordering. A 10-minute telemetry
-- cleanup (a PENDING event) sits in front of a 1-second rent-due
-- SMS in the claim order, and the SMS starves. See
-- docs/AUDIT_BACKEND_2026-08-03.md §2.A.N2 and
-- docs/AUDIT_FIX_PLAN_2026-08-03.md PR-75.
--
-- The fix: split events into 'interactive' and 'background'. The
-- worker orchestrator polls interactive first; background workers
-- are gated to run only when no interactive events are PENDING.
--
-- Classification (audit §2.A.N2):
--   interactive (4): rent-due check, referral-reward,
--                    daily-engagement, notification-dispatch
--   background (7):  telemetry-cleanup, audit-cleanup,
--                    scheduled-backup, wallet-reconciliation,
--                    notifications-cleanup, device-compliance,
--                    reconciliation
--
-- Compatibility: the column is added with DEFAULT 'background' so
-- existing rows and any code paths that don't pass a priority keep
-- working. The CHECK constraint rejects values outside the enum
-- (defense in depth — the application uses a TS string union).
--
-- Index: a composite (priority, status, createdAt) index lets the
-- worker poll "next interactive PENDING event" cheaply. The existing
-- (status, eventType, readyAt) index still serves event-type
-- filtering for background events. The CREATE INDEX CONCURRENTLY is
-- wrapped in DO blocks so the migration is safe to re-apply on
-- partially-migrated databases (idempotent).

-- AddColumn
ALTER TABLE "outbox_events"
  ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'background';

-- Add the CHECK constraint separately so we can use IF NOT EXISTS via
-- the pg_constraint lookup. (PostgreSQL < 16 does not support
-- ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'outbox_events_priority_check'
      AND conrelid = '"outbox_events"'::regclass
  ) THEN
    ALTER TABLE "outbox_events"
      ADD CONSTRAINT "outbox_events_priority_check"
      CHECK ("priority" IN ('interactive', 'background'));
  END IF;
END
$$;

-- CreateIndex: composite index for the worker's
--   "oldest interactive PENDING event" query.
--
-- Use CREATE INDEX IF NOT EXISTS (Postgres 9.5+) which is idempotent
-- and safe to re-run.
CREATE INDEX IF NOT EXISTS "outbox_events_priority_status_createdAt_idx"
  ON "outbox_events"("priority", "status", "createdAt");
