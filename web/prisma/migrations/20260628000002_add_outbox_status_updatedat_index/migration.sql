-- Add index on OutboxEvent(status, updatedAt) for reaper query performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS "OutboxEvent_status_updatedAt_idx"
  ON "OutboxEvent"("status", "updatedAt");
