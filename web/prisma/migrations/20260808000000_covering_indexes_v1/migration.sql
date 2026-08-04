-- Phase 7D PR-120 (DB-IX-1, P1) — covering indexes for hot query paths
--
-- Pre-fix state (verified 2026-08-04 via web/scripts/inspect-indexes.ts):
--   outbox_events:
--     - outbox_events_status_eventType_readyAt_idx  (good for the per-eventType claim query)
--     - outbox_events_status_createdAt_idx          (good for FIFO)
--     - MISSING: (status, readyAt) — needed for the type-agnostic scheduler
--       sweep (e.g. readyAt<now scan when draining a backlog across all event types)
--   audit_logs:
--     - audit_logs_action_idx
--     - audit_logs_actorId_createdAt_idx
--     - audit_logs_entity_entityId_action_idx
--     - MISSING: (action, createdAt) covering index for the admin audit log
--       screen which orders by createdAt DESC after filtering by action
--       (admin.repository.ts:127-130, audit-log.ts:133-136)
--   support_tickets:
--     - support_tickets_status_idx
--     - support_tickets_riderId_status_idx
--     - MISSING: (status, createdAt) covering index for the admin
--       "tickets by status, newest first" list
--       (support.use-cases.ts:125-128, monitoring.use-cases.ts:21)
--   backup_jobs:
--     - backup_jobs_status_idx
--     - MISSING: (status, createdAt) for the backup admin "recent jobs" list
--   rental_leases:
--     - rental_leases_riderId_status_idx           (good — covers the active-lease lookup)
--     - rental_leases_status_createdAt_idx          (good — covers the per-status list)
--     - MISSING: (riderId, status, createdAt) — used by the rider-side "my
--       leases" timeline (rider.repository.ts:36)
--
-- All CREATE INDEX statements are CONCURRENTLY IF NOT EXISTS so the migration
-- is safe to run on a non-empty table and is fully idempotent. The IF NOT
-- EXISTS also makes the migration re-runnable.
--
-- We deliberately do NOT add a `prisma` declaration in schema.prisma for
-- these indexes because they are not in the Prisma schema's @@index list
-- and adding them there would force `migrate dev` to manage them. The
-- raw-SQL CREATE INDEX pattern is the same one used in
-- 20260802000000_cache_indexes_v2 and 20260630000000_perf_indexes.
--
-- Order matters: each CREATE INDEX is independent. CONCURRENTLY cannot
-- run inside a transaction block, so this file is intentionally a series
-- of standalone statements (no BEGIN/COMMIT).

-- CreateIndex (outbox_events)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "outbox_events_status_readyAt_idx"
  ON "outbox_events"("status", "readyAt");

-- CreateIndex (audit_logs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_action_createdAt_idx"
  ON "audit_logs"("action", "createdAt");

-- CreateIndex (support_tickets)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "support_tickets_status_createdAt_idx"
  ON "support_tickets"("status", "createdAt");

-- CreateIndex (backup_jobs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "backup_jobs_status_createdAt_idx"
  ON "backup_jobs"("status", "createdAt");

-- CreateIndex (rental_leases) — composite for rider-side "my leases" timeline
CREATE INDEX CONCURRENTLY IF NOT EXISTS "rental_leases_riderId_status_createdAt_idx"
  ON "rental_leases"("riderId", "status", "createdAt");
