-- Migration: add_outbox_readyAt (Phase 3.4: + updatedAt)
-- Adds exponential-backoff support to the job queue, and the
-- auto-managed `updatedAt` column that the reaper needs to
-- find stuck PROCESSING rows.
--
-- readyAt (nullable DateTime):
--   NULL  = eligible immediately (new jobs, first attempts)
--   value = earliest time the job may be claimed again after a failure
--
-- updatedAt:
--   managed by Prisma (`@updatedAt`). The reaper filters on
--   `updatedAt < cutoff` to reclaim rows stuck in PROCESSING.
--
-- The composite index on (status, "eventType", "readyAt") is used by
-- the claim query in job-queue.ts to efficiently find jobs that are
-- both PENDING for a given type AND past their backoff window.

ALTER TABLE "OutboxEvent"
  ADD COLUMN IF NOT EXISTS "readyAt" TIMESTAMP(3);

-- updatedAt with a sane default so existing rows satisfy the
-- NOT NULL default. We also back-fill from processedAt (preferred)
-- or createdAt as a fallback.
ALTER TABLE "OutboxEvent"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

UPDATE "OutboxEvent"
  SET "updatedAt" = COALESCE("processedAt", "createdAt", NOW())
  WHERE "updatedAt" IS NULL;

-- Existing rows: treat as immediately eligible (NULL = ready now sentinel)
-- (no data fix needed; NULL is the sentinel)

-- Composite index for the claim query
CREATE INDEX IF NOT EXISTS "OutboxEvent_status_eventType_readyAt_idx"
  ON "OutboxEvent" (status, "eventType", "readyAt");
