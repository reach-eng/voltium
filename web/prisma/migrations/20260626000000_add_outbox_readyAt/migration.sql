-- Migration: add_outbox_readyAt
-- Adds exponential-backoff support to the job queue.
--
-- readyAt (nullable DateTime):
--   NULL  = eligible immediately (new jobs, first attempts)
--   value = earliest time the job may be claimed again after a failure
--
-- The composite index on (status, "eventType", "readyAt") is used by the
-- claim query in job-queue.ts to efficiently find jobs that are both
-- PENDING for a given type AND past their backoff window.

ALTER TABLE "OutboxEvent"
  ADD COLUMN IF NOT EXISTS "readyAt" TIMESTAMP(3);

-- Existing rows: treat as immediately eligible (NULL = ready now sentinel)

-- Composite index for the claim query
CREATE INDEX IF NOT EXISTS "OutboxEvent_status_eventType_readyAt_idx"
  ON "OutboxEvent" (status, "eventType", "readyAt");
