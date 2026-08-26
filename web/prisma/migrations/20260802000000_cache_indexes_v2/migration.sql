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
-- PR-72 audit fix (N2): of the 5 indexes originally in this file, 2
-- were redundant:
--   - `riders_updatedAt_idx`            → already declared as
--                                          `@@index([updatedAt])` in
--                                          schema.prisma (Rider model).
--   - `kyc_profiles_updatedAt_idx`      → already declared as
--                                          `@@index([updatedAt])` in
--                                          schema.prisma (KycProfile
--                                          model).
-- Both removed — Prisma will create them from the schema on next
-- `migrate dev`. The lifecycleStatus composite was renamed to use
-- `lifecycleStage` (the column that replaced `lifecycleStatus` per
-- PR-71); the column itself was added in
-- 20260730150000_add_rider_lifecycle_stage, which runs before this
-- migration, so the CREATE INDEX is valid at apply time.
--
-- Index breakdown (post-PR-72):
-- - riders.lifecycleStage + updatedAt: active-rider list (R4 cache)
-- - notifications.riderId + createdAt: notification timeline
-- - notifications.riderId + isRead + createdAt: unread badge query
--
-- The `riders.updatedAt` and `kyc_profiles.updatedAt` indexes are
-- handled by the `@@index([updatedAt])` declarations in schema.prisma
-- (Rider line 279, KycProfile line 341) and are NOT created here.
--
-- Safe to apply on a non-empty table: these are CREATE INDEX
-- statements, no DDL that takes ACCESS EXCLUSIVE.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "riders_lifecycleStage_updatedAt_idx" ON "riders"("lifecycleStage", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_riderId_createdAt_idx" ON "notifications"("riderId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_riderId_isRead_createdAt_idx" ON "notifications"("riderId", "isRead", "createdAt");
