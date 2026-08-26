-- Migration: convert all DateTime columns from `timestamp without time
-- zone` (naive) to `timestamptz` (timezone-aware).
--
-- WHY:
--   Prisma's `DateTime` type maps to `timestamp(3)` in Postgres by default,
--   which stores values without timezone information. Prisma reads/writes
--   these columns by converting JS Date values (which are UTC) to/from
--   the Postgres session's local timezone. When the session timezone is
--   not UTC, the conversion produces values in the wrong reference frame
--   and time comparisons (e.g. `readyAt <= now` for job-queue backoff)
--   evaluate incorrectly.
--
--   This migration converts all 135 columns to `timestamptz`. The
--   conversion interprets each existing value as Asia/Calcutta local
--   time (the dev/seed timezone) and stores it as UTC. When read back in
--   a session whose timezone is also Asia/Calcutta, the displayed value
--   is unchanged. Combined with setting the connection-string timezone
--   to Asia/Calcutta, this preserves the current user-visible times.
--
-- SAFETY:
--   - The conversion is one-way (naive → timezone-aware). The reverse
--     is not possible without data loss.
--   - Backup the database before applying this migration.
--   - Run `scripts/check-datetime-shift.sql` after applying to verify
--     no user-visible time shift.
--
-- PRISMA:
--   The Prisma schema does not need to change because Prisma's `DateTime`
--   type is timezone-aware by default. The `timestamp(3)` mapping is a
--   legacy default that this migration corrects.
--
-- APPLIES TO:
--   Both the `public` schema (production / dev) and the `test` schema
--   (used by vitest with `?schema=test`). The test schema is a separate
--   Postgres schema that prisma db push creates in parallel to `public`.

DO $$
DECLARE
  col_record RECORD;
  target_schema TEXT;
BEGIN
  FOR target_schema IN SELECT unnest(ARRAY['public', 'test'])
  LOOP
    FOR col_record IN
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = target_schema
        AND data_type = 'timestamp without time zone'
    LOOP
      EXECUTE format(
        'ALTER TABLE %I.%I ALTER COLUMN %I TYPE TIMESTAMPTZ USING (%I AT TIME ZONE %L)',
        target_schema,
        col_record.table_name,
        col_record.column_name,
        col_record.column_name,
        'Asia/Calcutta'
      );
    END LOOP;
  END LOOP;
END $$;
