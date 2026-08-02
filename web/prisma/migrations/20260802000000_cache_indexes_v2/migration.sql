-- Cache-backed indexes (P2.3 + admin list perf)
--
-- Adds the indexes that the entity-cache layer relies on for the admin
-- list queries (riders, kyc, notifications). These are the same indexes
-- the (now-removed) 20260801000000_cache_indexes migration tried to
-- create; the difference is that this migration goes in as a real
-- schema change with @@index declarations in schema.prisma, so the
-- indexes are part of the canonical model rather than a one-off
-- migration.
--
-- Why the original migration was wrong: the doc assumed the indexes
-- were already declared in schema.prisma, but the declarations had
-- been lost in earlier schema refactors. This migration re-adds them
-- and matches schema.prisma 1:1.
--
-- Index breakdown:
-- - riders.updatedAt: "recently updated" admin rider list
-- - riders.lifecycleStatus + updatedAt: active-rider list
-- - kyc_profiles.updatedAt: pending KYC review queue
-- - notifications.riderId + createdAt: notification timeline
-- - notifications.riderId + isRead + createdAt: unread badge query
--
-- Safe to apply on a non-empty table: these are CREATE INDEX
-- statements, no DDL that takes ACCESS EXCLUSIVE.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "riders_updatedAt_idx" ON "riders"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "riders_lifecycleStatus_updatedAt_idx" ON "riders"("lifecycleStatus", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "kyc_profiles_updatedAt_idx" ON "kyc_profiles"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_riderId_createdAt_idx" ON "notifications"("riderId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_riderId_isRead_createdAt_idx" ON "notifications"("riderId", "isRead", "createdAt");
