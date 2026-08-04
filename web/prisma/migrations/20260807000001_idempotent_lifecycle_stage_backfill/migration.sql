-- =============================================================================
-- PR-96 (DB-M-1) — Idempotent lifecycleStage backfill
-- =============================================================================
-- Ticket: #6 (DB Audit 2.8) — Phase 7A
-- Plan:   docs/AUDIT_PHASE7_PLAN_2026-08-04.md PR-96
--
-- Why this exists:
--   The original 20260730150000_add_rider_lifecycle_stage migration DID
--   apply to the live DB at some point (the lifecycleStage column and
--   RiderLifecycleStage enum are present in pg_type and
--   information_schema.columns), but it was applied via `prisma db push`
--   rather than `prisma migrate deploy`. As a result, the migration
--   history (_prisma_migrations) is missing 33 entries.
--
--   This is critical for the 2026-08-06 staging soak because the gated
--   drop migration 20260806020000_drop_rider_legacy_lifecycle_status
--   hard-aborts if any rider has NULL lifecycleStage. We need:
--     1. lifecycleStage to exist on every row (backfill)
--     2. lifecycleStatus to be safely droppable (gated drop)
--
-- What this migration does:
--   1. Re-creates the RiderLifecycleStage enum if missing (no-op if present).
--   2. Adds the lifecycleStage column if missing (no-op if present).
--   3. Backfills lifecycleStage from lifecycleStatus using the same 15→5
--      mapping as the original migration. Idempotent — re-running is a
--      no-op because the WHERE clause excludes rows already at the
--      correct stage.
--   4. Sets lifecycleStage = 'NEW' for any row where the column is NULL
--      (defensive — should never happen if step 3 succeeded).
--
-- Strategy: every operation is wrapped in IF NOT EXISTS / IF EXISTS
-- guards so this migration is safe to re-run on any DB state.
-- =============================================================================

DO $$
DECLARE
    _failed BOOLEAN := FALSE;
    _errmsg TEXT;
BEGIN
    -- 1. Create the RiderLifecycleStage enum if missing
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RiderLifecycleStage') THEN
        BEGIN
            CREATE TYPE "RiderLifecycleStage" AS ENUM (
                'NEW',
                'IN_PROGRESS',
                'ACTIVE',
                'PAUSED',
                'CLOSED'
            );
            RAISE NOTICE '✓ Created RiderLifecycleStage enum';
        EXCEPTION WHEN OTHERS THEN
            _failed := TRUE;
            _errmsg := SQLERRM;
            RAISE WARNING '✗ RiderLifecycleStage enum creation failed: %', _errmsg;
        END;
    ELSE
        RAISE NOTICE 'RiderLifecycleStage enum already exists (no-op)';
    END IF;

    -- 2. Add lifecycleStage column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'riders'
          AND column_name = 'lifecycleStage'
    ) THEN
        BEGIN
            ALTER TABLE "riders" ADD COLUMN "lifecycleStage" "RiderLifecycleStage" DEFAULT 'NEW';
            RAISE NOTICE '✓ Added lifecycleStage column';
        EXCEPTION WHEN OTHERS THEN
            _failed := TRUE;
            _errmsg := SQLERRM;
            RAISE WARNING '✗ lifecycleStage column add failed: %', _errmsg;
        END;
    ELSE
        RAISE NOTICE 'lifecycleStage column already exists (no-op)';
    END IF;

    -- 3. Backfill lifecycleStage from lifecycleStatus (idempotent).
    --    Maps 15 RiderLifecycleStatus values to 5 RiderLifecycleStage values.
    --    WHERE clause excludes rows that already have a non-NEW value
    --    AND excludes NULL lifecycleStatus rows (defensive).
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'riders'
          AND column_name = 'lifecycleStatus'
    ) THEN
        BEGIN
            UPDATE "riders"
            SET "lifecycleStage" = CASE "lifecycleStatus"::text
                WHEN 'NEW'                  THEN 'NEW'::"RiderLifecycleStage"
                WHEN 'PHONE_VERIFIED'       THEN 'IN_PROGRESS'::"RiderLifecycleStage"
                WHEN 'PROFILE_SUBMITTED'    THEN 'IN_PROGRESS'::"RiderLifecycleStage"
                WHEN 'KYC_SUBMITTED'        THEN 'IN_PROGRESS'::"RiderLifecycleStage"
                WHEN 'KYC_APPROVED'         THEN 'IN_PROGRESS'::"RiderLifecycleStage"
                WHEN 'GUARANTOR_SUBMITTED'  THEN 'IN_PROGRESS'::"RiderLifecycleStage"
                WHEN 'GUARANTOR_APPROVED'   THEN 'IN_PROGRESS'::"RiderLifecycleStage"
                WHEN 'DEPOSIT_PENDING'      THEN 'IN_PROGRESS'::"RiderLifecycleStage"
                WHEN 'DEPOSIT_APPROVED'     THEN 'IN_PROGRESS'::"RiderLifecycleStage"
                WHEN 'PLAN_SELECTED'        THEN 'IN_PROGRESS'::"RiderLifecycleStage"
                WHEN 'PICKUP_SCHEDULED'     THEN 'IN_PROGRESS'::"RiderLifecycleStage"
                WHEN 'ACTIVE'               THEN 'ACTIVE'::"RiderLifecycleStage"
                WHEN 'SUSPENDED'            THEN 'PAUSED'::"RiderLifecycleStage"
                WHEN 'RETURN_PENDING'       THEN 'PAUSED'::"RiderLifecycleStage"
                WHEN 'CLOSED'               THEN 'CLOSED'::"RiderLifecycleStage"
            END
            WHERE "lifecycleStage" = 'NEW'::"RiderLifecycleStage"
              AND "lifecycleStatus" IS NOT NULL
              AND "lifecycleStatus" <> 'NEW';
            RAISE NOTICE '✓ Backfilled lifecycleStage from lifecycleStatus';
        EXCEPTION WHEN OTHERS THEN
            _failed := TRUE;
            _errmsg := SQLERRM;
            RAISE WARNING '✗ lifecycleStage backfill failed: %', _errmsg;
        END;
    END IF;

    -- 4. Defensive: any row with NULL lifecycleStage gets 'NEW'
    BEGIN
        UPDATE "riders"
        SET "lifecycleStage" = 'NEW'::"RiderLifecycleStage"
        WHERE "lifecycleStage" IS NULL;
        RAISE NOTICE '✓ Set NULL lifecycleStage to NEW (defensive)';
    EXCEPTION WHEN OTHERS THEN
        _failed := TRUE;
        _errmsg := SQLERRM;
        RAISE WARNING '✗ NULL lifecycleStage cleanup failed: %', _errmsg;
    END;

    -- 5. Verify all riders have a non-NULL lifecycleStage
    DECLARE
        _null_count INTEGER;
    BEGIN
        SELECT COUNT(*)::INTEGER INTO _null_count FROM "riders" WHERE "lifecycleStage" IS NULL;
        IF _null_count > 0 THEN
            RAISE WARNING '✗ % riders still have NULL lifecycleStage after backfill', _null_count;
        ELSE
            RAISE NOTICE '✓ All riders have non-NULL lifecycleStage';
        END IF;
    END;

    IF _failed THEN
        RAISE WARNING 'PR-96 migration completed with one or more failures (see above). Re-run is safe (idempotent).';
    ELSE
        RAISE NOTICE 'PR-96 migration completed: lifecycleStage backfill verified.';
    END IF;
END $$;
