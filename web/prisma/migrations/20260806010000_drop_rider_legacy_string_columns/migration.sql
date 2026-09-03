-- PR-J (PR-P3.3) — Drop legacy Rider string columns after PR-P3.2 staging soak.
--
-- GATED on 2026-08-06 staging soak (1 week after PR-P3.2 deployed). By the
-- time this migration applies:
--   - The new FK columns `pickupHubId`, `currentPlanId`, `teamLeaderId`
--     (added in 20260730140000) have been backfilled.
--   - All writers have been migrated to the FK columns.
--   - All readers have been verified to prefer the FK columns when set,
--     with a fallback to the legacy string for backfill gaps.
--   - 1-week staging soak with no regression has elapsed.
--
-- Three legacy string columns to drop:
--   - `pickupHub` (String, free-text)  →  replaced by `pickupHubId` (FK to Hub)
--   - `currentPlan` (String, free-text) →  replaced by `currentPlanId` (FK to RentalPlan)
--   - `teamLeader` (String, free-text)  →  replaced by `teamLeaderId` (FK to Admin)
--
-- Pre-flight check (lines 4-30): count riders with non-null legacy strings
-- but null FK. These riders need manual review — either backfill their FK
-- or accept the legacy loss. The migration aborts if the count is > 0.
--
-- DROP COLUMN is the irreversible step. IF EXISTS makes it idempotent.

DO $$
DECLARE
  unbackfilled_hub   INTEGER;
  unbackfilled_plan  INTEGER;
  unbackfilled_tl    INTEGER;
BEGIN
  -- Count riders with non-null legacy string but null FK (backfill gaps)
  SELECT COUNT(*)::INTEGER INTO unbackfilled_hub
    FROM "riders"
   WHERE "pickupHub" IS NOT NULL
     AND "pickupHubId" IS NULL;

  SELECT COUNT(*)::INTEGER INTO unbackfilled_plan
    FROM "riders"
   WHERE "currentPlan" IS NOT NULL
     AND "currentPlanId" IS NULL;

  SELECT COUNT(*)::INTEGER INTO unbackfilled_tl
    FROM "riders"
   WHERE "teamLeader" IS NOT NULL
     AND "teamLeaderId" IS NULL;

  IF unbackfilled_hub > 0 OR unbackfilled_plan > 0 OR unbackfilled_tl > 0 THEN
    RAISE EXCEPTION 'PR-J ABORTED: unbackfilled riders: pickupHub=%, currentPlan=%, teamLeader=%. Backfill or accept-loss before dropping.', unbackfilled_hub, unbackfilled_plan, unbackfilled_tl;
  END IF;

  RAISE NOTICE 'PR-J pre-flight OK: all 3 FK columns fully backfilled. Proceeding with drops.';
END $$;

-- Drop the legacy columns. Idempotent.
-- P0 fix 2026-09-03: DROPs DISABLED. Application code still reads the legacy
-- strings (admin-riders.use-cases.ts:1010 pickupHub + :1048 currentPlan,
-- listFleet hub filter, flatten-rider.ts, rent-reminders.job.ts) and
-- schema.prisma still declares them, so dropping now breaks `db:deploy`
-- consumers with `Unknown column` errors. The pre-flight above still runs
-- (backfill health signal). Re-enable these three ALTERs only after the
-- D-P2-4 code migration moves every reader to pickupHubId/currentPlanId/
-- teamLeaderId AND schema.prisma drops the String fields in the same deploy.
-- ALTER TABLE "riders" DROP COLUMN IF EXISTS "pickupHub";
-- ALTER TABLE "riders" DROP COLUMN IF EXISTS "currentPlan";
-- ALTER TABLE "riders" DROP COLUMN IF EXISTS "teamLeader";
DO $$ BEGIN
  RAISE NOTICE 'PR-J SKIPPED: legacy string columns retained — code still reads them (see D-P2-4). No columns dropped.';
END $$;
