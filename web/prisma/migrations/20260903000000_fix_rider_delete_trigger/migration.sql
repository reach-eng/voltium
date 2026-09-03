-- P0 fix 2026-09-03: `prevent_rider_delete` trigger targeted the wrong relation.
--
-- Migration 20260626000002_prevent_rider_delete created the trigger on "Rider"
-- (Prisma model name), but migration 20260712000002_standardize_table_naming
-- renamed the physical table to "riders" (@@map("riders")). The old trigger
-- guards a non-existent relation — hard deletes of riders are unprotected at
-- the DB layer (the only working financial guard is
-- 20260810000001_prevent_transaction_and_ledger_delete).
--
-- This migration re-points the trigger at "riders". Idempotent: safe to
-- re-run. The function body is unchanged (hard-delete is prohibited; use
-- soft-delete via deletedAt / lifecycleStatus=CLOSED).

CREATE OR REPLACE FUNCTION prevent_rider_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Hard-deleting a Rider is strictly prohibited to preserve financial and audit records. Use soft-delete (lifecycleStatus = CLOSED) instead.';
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger on the old (non-existent) relation if the name survived,
-- then ensure exactly one trigger on the real table. The first DROP is
-- wrapped so it no-ops when the "Rider" relation does not exist.
DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_prevent_rider_delete ON "Rider";
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'fix_rider_delete_trigger: relation "Rider" does not exist, skipping legacy drop (expected after table rename).';
END $$;
DROP TRIGGER IF EXISTS trg_prevent_rider_delete ON "riders";
CREATE TRIGGER trg_prevent_rider_delete
  BEFORE DELETE ON "riders"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_rider_delete();
