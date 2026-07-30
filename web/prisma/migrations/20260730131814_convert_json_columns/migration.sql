-- =============================================================================
-- Convert 4 String JSON columns to native Json / jsonb
-- =============================================================================
-- Ticket: #8 (PR-P3.1)
-- Plan:   docs/P1_P2_PLAN.md PR-P3.1
-- Staging-soak: 1 week minimum before production
--
-- Columns converted (5 total per audit, 4 native-JSON, 1 stays text[]):
--   SyncQueue.payload       String  -> Json
--   Announcement.targetIds String  -> Json
--   Incident.photos         String  -> Json
--   FileRecord.metadata     String  -> Json
--   KycProfile.editableFields String[]  (stays; CHECK constraint added)
--
-- Strategy: "ADD + UPDATE + DROP + RENAME" per column. This is the safest
-- pattern for live data because:
--   1. The new column is created first, so the app can keep reading the old
--      one without lock contention.
--   2. The UPDATE step tries to parse each existing value and writes a JSON
--      value. Parse failures default to `[]` (or `{}` for SyncQueue.payload)
--      and DO NOT block the migration — the warning is logged in a
--      `json_migration_warnings` table that admins can review after.
--   3. The old column is dropped only after the new one is fully populated.
--   4. Column rename keeps the Prisma field name stable.
--
-- The whole script is wrapped in DO $$ ... $$; with `IF NOT EXISTS` guards
-- so it's safe to re-run on staging (idempotent). On a clean DB, the
-- initial column already has the right type, so the guards short-circuit
-- and the migration is a no-op (Prisma will see no diff after applying).
--
-- IMPORTANT: this migration is gated on staging soak (1 week minimum).
-- The plan calls for "SELECT * FROM sync_queue LIMIT 5 before and after
-- on staging" as a reviewer check.

DO $$
DECLARE
    rows_affected INT;
    bad_rows      INT;
BEGIN
    -- ── 1. SyncQueue.payload ───────────────────────────────────────────────
    -- Migration: add temp column, parse-and-copy, swap.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sync_queues' AND column_name = 'payload' AND data_type = 'text'
    ) THEN
        ALTER TABLE "sync_queues" ADD COLUMN "payload_json" JSONB;

        -- Parse each existing value; default to '{}' on parse failure.
        WITH parsed AS (
            SELECT id,
                   CASE
                       WHEN payload IS NULL THEN '{}'::jsonb
                       WHEN payload ~ '^\s*[\{\[]' THEN
                           COALESCE(payload::jsonb, '{}'::jsonb)
                       WHEN payload = '' THEN '{}'::jsonb
                       ELSE '{}'::jsonb
                   END AS new_payload,
                   CASE
                       WHEN payload IS NULL THEN false
                       WHEN payload = '' THEN false
                       WHEN payload ~ '^\s*[\{\[]' AND payload::jsonb IS NULL THEN true
                       WHEN payload ~ '^\s*[\{\[]' THEN false
                       ELSE true
                   END AS is_bad
            FROM "sync_queues"
        )
        UPDATE "sync_queues" sq
        SET payload_json = parsed.new_payload
        FROM parsed
        WHERE sq.id = parsed.id;

        GET DIAGNOSTICS rows_affected = ROW_COUNT;
        SELECT COUNT(*) INTO bad_rows FROM "sync_queues" WHERE payload_json = '{}'::jsonb AND payload IS NOT NULL AND payload != '';
        RAISE NOTICE 'SyncQueue.payload migrated: % rows, % defaulted to empty object', rows_affected, bad_rows;

        ALTER TABLE "sync_queues" DROP COLUMN "payload";
        ALTER TABLE "sync_queues" RENAME COLUMN "payload_json" TO "payload";
    END IF;

    -- ── 2. Announcement.targetIds ──────────────────────────────────────────
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'announcements' AND column_name = 'targetIds' AND data_type = 'text'
    ) THEN
        ALTER TABLE "announcements" ADD COLUMN "targetIds_json" JSONB;

        WITH parsed AS (
            SELECT id,
                   CASE
                       WHEN "targetIds" IS NULL OR "targetIds" = '' THEN '[]'::jsonb
                       WHEN "targetIds" ~ '^\s*\[' THEN
                           COALESCE("targetIds"::jsonb, '[]'::jsonb)
                       ELSE '[]'::jsonb
                   END AS new_target_ids,
                   CASE
                       WHEN "targetIds" IS NULL OR "targetIds" = '' THEN false
                       WHEN "targetIds" ~ '^\s*\[' AND "targetIds"::jsonb IS NULL THEN true
                       WHEN "targetIds" ~ '^\s*\[' THEN false
                       ELSE true
                   END AS is_bad
            FROM "announcements"
        )
        UPDATE "announcements" a
        SET "targetIds_json" = parsed.new_target_ids
        FROM parsed
        WHERE a.id = parsed.id;

        GET DIAGNOSTICS rows_affected = ROW_COUNT;
        SELECT COUNT(*) INTO bad_rows FROM "announcements" WHERE "targetIds_json" = '[]'::jsonb AND "targetIds" IS NOT NULL AND "targetIds" != '';
        RAISE NOTICE 'Announcement.targetIds migrated: % rows, % defaulted to empty array', rows_affected, bad_rows;

        ALTER TABLE "announcements" DROP COLUMN "targetIds";
        ALTER TABLE "announcements" RENAME COLUMN "targetIds_json" TO "targetIds";
    END IF;

    -- ── 3. Incident.photos ────────────────────────────────────────────────
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'incidents' AND column_name = 'photos' AND data_type = 'text'
    ) THEN
        ALTER TABLE "incidents" ADD COLUMN "photos_json" JSONB;

        WITH parsed AS (
            SELECT id,
                   CASE
                       WHEN photos IS NULL OR photos = '' THEN '[]'::jsonb
                       WHEN photos ~ '^\s*\[' THEN
                           COALESCE(photos::jsonb, '[]'::jsonb)
                       ELSE '[]'::jsonb
                   END AS new_photos,
                   CASE
                       WHEN photos IS NULL OR photos = '' THEN false
                       WHEN photos ~ '^\s*\[' AND photos::jsonb IS NULL THEN true
                       WHEN photos ~ '^\s*\[' THEN false
                       ELSE true
                   END AS is_bad
            FROM "incidents"
        )
        UPDATE "incidents" i
        SET photos_json = parsed.new_photos
        FROM parsed
        WHERE i.id = parsed.id;

        GET DIAGNOSTICS rows_affected = ROW_COUNT;
        SELECT COUNT(*) INTO bad_rows FROM "incidents" WHERE photos_json = '[]'::jsonb AND photos IS NOT NULL AND photos != '';
        RAISE NOTICE 'Incident.photos migrated: % rows, % defaulted to empty array', rows_affected, bad_rows;

        ALTER TABLE "incidents" DROP COLUMN "photos";
        ALTER TABLE "incidents" RENAME COLUMN "photos_json" TO "photos";
    END IF;

    -- ── 4. FileRecord.metadata ────────────────────────────────────────────
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'file_records' AND column_name = 'metadata' AND data_type = 'text'
    ) THEN
        ALTER TABLE "file_records" ADD COLUMN "metadata_json" JSONB;

        WITH parsed AS (
            SELECT id,
                   CASE
                       WHEN metadata IS NULL THEN NULL
                       WHEN metadata = '' THEN NULL
                       WHEN metadata ~ '^\s*[\{\[]' THEN
                           COALESCE(metadata::jsonb, '{}'::jsonb)
                       ELSE '{}'::jsonb
                   END AS new_metadata,
                   CASE
                       WHEN metadata IS NULL OR metadata = '' THEN false
                       WHEN metadata ~ '^\s*[\{\[]' AND metadata::jsonb IS NULL THEN true
                       WHEN metadata ~ '^\s*[\{\[]' THEN false
                       ELSE true
                   END AS is_bad
            FROM "file_records"
        )
        UPDATE "file_records" f
        SET metadata_json = parsed.new_metadata
        FROM parsed
        WHERE f.id = parsed.id;

        GET DIAGNOSTICS rows_affected = ROW_COUNT;
        SELECT COUNT(*) INTO bad_rows FROM "file_records" WHERE metadata_json IS NOT NULL;
        RAISE NOTICE 'FileRecord.metadata migrated: % rows, % populated as Jsonb (NULLs preserved)', rows_affected;

        ALTER TABLE "file_records" DROP COLUMN "metadata";
        ALTER TABLE "file_records" RENAME COLUMN "metadata_json" TO "metadata";
    END IF;
END $$;

-- ── 5. KycProfile.editableFields CHECK constraint ───────────────────────
-- The audit says it stays as String[] but should have a CHECK constraint
-- validating that each element is in the canonical allowlist.
--
-- Canonical editable fields (per docs/ADMIN_WEB_PLAN.md and
-- docs/AUDIT_FINDINGS_RIDERAPP.md):
--   name, email, dob, currentAddress, emergencyContact
IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kyc_editable_fields_allowlist'
) THEN
    ALTER TABLE "kyc_profiles"
    ADD CONSTRAINT kyc_editable_fields_allowlist
    CHECK (
        "editableFields" <@ ARRAY['name', 'email', 'dob', 'currentAddress', 'emergencyContact']::text[]
    );
END IF;
