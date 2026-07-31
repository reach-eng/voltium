-- PR-K.3 — Drop legacy `Rider.lifecycleStatus` enum column after PR-K.1 + K.2 soaks.
--
-- GATED on 2026-08-06 staging soak (1 week after both PR-K.1 and PR-K.2
-- deployed). By the time this migration applies:
--   - The new `lifecycleStage` (5-value enum) column was added in
--     20260730150000.
--   - PR-K.1 (ADD + BACKFILL) kept the legacy column populated; PR-K.2
--     (Flutter reader) made `lifecycleStage` the primary read.
--   - All Flutter readers have been verified to read `lifecycleStage` first
--     and fall back to `lifecycleStatus` only when stage is NULL.
--   - All server writers have been migrated to write `lifecycleStage`.
--   - 1-week staging soak with no regression has elapsed.
--
-- Pre-flight check (lines 4-22): verify that every rider has a non-null
-- `lifecycleStage`. If any rider is still null, the backfill is incomplete.
-- Also: verify that no row has both `lifecycleStatus` AND a DIFFERENT
-- `lifecycleStage` (would indicate a divergence bug).
--
-- DROP COLUMN is the irreversible step. IF EXISTS makes it idempotent.
-- The `RiderLifecycleStatus` enum type is kept — it's referenced in audit
-- log entries for historical data. The enum removal is a separate
-- follow-up (defer to v2 — needs full audit-log scan to confirm no
-- code path reads it post-drop).

DO $$
DECLARE
  null_stage_count INTEGER;
  divergence_count INTEGER;
BEGIN
  -- Count riders with null lifecycleStage
  SELECT COUNT(*)::INTEGER INTO null_stage_count
    FROM "riders"
   WHERE "lifecycleStage" IS NULL;

  -- Count riders where legacy and new have diverged (non-null on both but
  -- different values would indicate a bug in the reader/writer split)
  SELECT COUNT(*)::INTEGER INTO divergence_count
    FROM "riders"
   WHERE "lifecycleStage" IS NOT NULL
     AND "lifecycleStatus" IS NOT NULL
     AND "lifecycleStage"::text != "lifecycleStatus"::text;

  IF null_stage_count > 0 THEN
    RAISE EXCEPTION 'PR-K.3 ABORTED: % riders have NULL lifecycleStage. Backfill is incomplete.', null_stage_count;
  END IF;

  IF divergence_count > 0 THEN
    RAISE EXCEPTION 'PR-K.3 ABORTED: % riders have legacy and new lifecycle values that diverge. Investigate before dropping.', divergence_count;
  END IF;

  RAISE NOTICE 'PR-K.3 pre-flight OK: all riders have lifecycleStage, no divergences. Proceeding with drop.';
END $$;

-- Drop the legacy column. Idempotent. Enum type intentionally retained.
ALTER TABLE "riders" DROP COLUMN IF EXISTS "lifecycleStatus";
