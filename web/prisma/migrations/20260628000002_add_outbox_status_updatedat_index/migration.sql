-- Add index on OutboxEvent(status, updatedAt) for reaper query performance
-- P0 fix 2026-09-03: plain CREATE INDEX (no CONCURRENTLY) — Prisma migrate
-- deploy runs inside a transaction where CONCURRENTLY is forbidden.
CREATE INDEX IF NOT EXISTS "OutboxEvent_status_updatedAt_idx"
  ON "OutboxEvent"("status", "updatedAt");
