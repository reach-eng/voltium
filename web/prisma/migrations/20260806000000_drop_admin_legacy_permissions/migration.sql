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
  -- Count distinct permissions in the legacy column
  SELECT COALESCE(SUM(CASE WHEN "permissions" IS NOT NULL
                            THEN array_length("permissions", 1)
                          ELSE 0 END), 0)
    INTO legacy_count
    FROM "admins";

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
ALTER TABLE "admins" DROP COLUMN IF EXISTS "permissions";
