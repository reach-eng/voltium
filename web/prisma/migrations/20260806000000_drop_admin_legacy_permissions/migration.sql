-- R6.1 — Drop legacy `Admin.permissions` String[] column.
--
-- GATED on 2026-08-06 staging soak. By the time this migration applies:
--   - The new `admin_has_permissions` table (added in 20260730180000) has
--     been backfilled and all writers are using it.
--   - All readers have been verified to use the new table.
--   - 1-week staging soak with no regression has elapsed.
--
-- Pre-flight check (lines 4-15): abort if the new table has fewer rows than
-- the legacy column has values. This is a safety net — if a backfill bug
-- is found at the last minute, this migration will refuse to apply.
--
-- DROP COLUMN is the irreversible step. We use IF EXISTS to make the
-- migration idempotent (safe to re-run on a partial-apply system).
--
-- After this migration applies, the schema.prisma line for `permissions
-- String[] @default([])` on the Admin model is also removed (in the
-- follow-up commit alongside this file).

DO $$
DECLARE
  legacy_count INTEGER;
  new_count INTEGER;
BEGIN
  -- W5: idempotency guard. If admins.permissions no longer exists
  -- (e.g. it was hand-dropped between the prior failed run and a
  -- future re-run), the pre-flight can't query the column. Skip
  -- the safety-net pre-flight and let the no-op DROP block run.
  -- The drop is intentionally a no-op today; this only affects
  -- whether the file aborts on re-apply.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admins' AND column_name = 'permissions'
  ) THEN
    RAISE NOTICE 'R6.1: admins.permissions no longer present; pre-flight skipped. The actual DROP is a no-op (see lines 47-52).';
    legacy_count := 0;
  ELSE
    -- Count distinct permissions in the legacy column
    SELECT COALESCE(SUM(CASE WHEN "permissions" IS NOT NULL
                              THEN array_length("permissions", 1)
                            ELSE 0 END), 0)
      INTO legacy_count
      FROM "admins";
  END IF;

  -- Count rows in the new table
  SELECT COUNT(*)::INTEGER
    INTO new_count
    FROM "admin_has_permissions";

  -- Sanity: new table should have AT LEAST as many rows as the legacy
  -- (each legacy value becomes one row). If not, abort.
  IF new_count < legacy_count THEN
    RAISE EXCEPTION 'R6.1 ABORTED: admin_has_permissions has % rows but legacy column has % values. Backfill is incomplete — investigate before dropping.', new_count, legacy_count;
  END IF;

  RAISE NOTICE 'R6.1 pre-flight OK: legacy=% new=%. Proceeding with drop.', legacy_count, new_count;
END $$;

-- Drop the legacy column. Idempotent.
-- P0 fix 2026-09-03: DROP DISABLED until every reader is verified on the new
-- admin_has_permissions table AND schema.prisma removes `Admin.permissions`
-- in the same deploy. Dropping while the Prisma schema still declares the
-- field breaks all Admin reads with `Unknown column`. Pre-flight above still
-- runs as a backfill signal.
-- ALTER TABLE "admins" DROP COLUMN IF EXISTS "permissions";
DO $$ BEGIN
  RAISE NOTICE 'R6.1 SKIPPED: Admin.permissions retained — schema still declares it. No column dropped.';
END $$;
