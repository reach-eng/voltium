-- 2026-09-08 system-settings section audit — P1-4: add a
-- `requiresRestart` flag to `system_settings` so the operator can
-- tell which edits need a process restart to take effect on all
-- workers. The audit's specific concern: storage roots are memoized
-- in `StoragePathBuilder` (no TTL), so an edit changes nothing until
-- `invalidateCache()` runs, and even then it only resets the LOCAL
-- process — sibling workers in PM2 cluster mode keep the old value
-- until they restart. The header subtitle ("some settings require a
-- server restart") never said WHICH. The fix: a column that the UI
-- can read and surface inline, plus a per-write `invalidateCache()`
-- call so the LOCAL process is correct immediately.

ALTER TABLE "system_settings" ADD COLUMN "requiresRestart" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: the 3 storage roots genuinely need a restart to propagate
-- across all workers (the in-memory module cache is per-process). The
-- 2 maintenance keys are reflected instantly via middleware cache
-- invalidation (PR-3 already shipped that), so they do NOT need a
-- restart. Everything else is read fresh from the DB on every read,
-- so the default (false) is correct.
UPDATE "system_settings"
SET    "requiresRestart" = true
WHERE  "key" IN ('LOCAL_STORAGE_ROOT', 'BACKUP_ROOT', 'BACKUP_SECONDARY_ROOT');
