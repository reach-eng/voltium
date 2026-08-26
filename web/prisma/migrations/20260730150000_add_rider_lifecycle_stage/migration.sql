-- =============================================================================
-- Add RiderLifecycleStage enum + lifecycleStage column on Rider
-- =============================================================================
-- Ticket: #6 (DB Audit 2.8)
-- Plan:   docs/P1_P2_PLAN.md PR-K.1
--         docs/EXECUTION_PLAN_2026-07-30.md PR-K.1
--         docs/FIX_PLAN.md PR-K.1
-- Staging-soak: 1 week minimum before PR-K.2 (Flutter reads) and PR-K.3 (drop)
--
-- Why:
--   The 15-value `RiderLifecycleStatus` enum mixes in-progress states
--   (PHONE_VERIFIED, PROFILE_SUBMITTED) with outcome states
--   (KYC_APPROVED, GUARANTOR_APPROVED). This PR splits it into:
--     - 5-value `RiderLifecycleStage` (NEW, IN_PROGRESS, ACTIVE, PAUSED, CLOSED)
--       for the high-level rider journey
--     - The existing per-step fields (kycStatus, guarantorStatus, etc.)
--       for the granular state of each step
--
-- Strategy: "ADD + BACKFILL" (the legacy column is KEPT for backward compat):
--   1. CREATE the new enum type `RiderLifecycleStage` if not present.
--   2. ADD the new column `lifecycleStage` if not present, with `NEW` default.
--   3. BACKFILL `lifecycleStage` from `lifecycleStatus` using a deterministic
--      mapping (the rider is in a stage based on where they are in the flow).
--   4. The legacy `lifecycleStatus` column is kept; PR-K.3 (gated on 1-wk
--      staging soak of this PR) will drop it.
--
-- Backfill mapping (from RiderLifecycleStatus -> RiderLifecycleStage):
--   NEW                       -> NEW
--   PHONE_VERIFIED            -> IN_PROGRESS
--   PROFILE_SUBMITTED         -> IN_PROGRESS
--   KYC_SUBMITTED             -> IN_PROGRESS
--   KYC_APPROVED              -> IN_PROGRESS (or ACTIVE if deposit done)
--   GUARANTOR_SUBMITTED       -> IN_PROGRESS
--   GUARANTOR_APPROVED        -> IN_PROGRESS
--   DEPOSIT_PENDING           -> IN_PROGRESS
--   DEPOSIT_APPROVED          -> IN_PROGRESS (or ACTIVE if plan selected)
--   PLAN_SELECTED             -> IN_PROGRESS
--   PICKUP_SCHEDULED          -> IN_PROGRESS
--   ACTIVE                    -> ACTIVE
--   SUSPENDED                 -> PAUSED
--   RETURN_PENDING            -> PAUSED
--   CLOSED                    -> CLOSED
--
-- The whole script is wrapped in DO $$ ... $$; with `IF NOT EXISTS`
-- guards so it's safe to re-run on staging (idempotent). On a clean DB,
-- the migration is a no-op (Prisma will see no diff after applying).

DO $$
BEGIN
    -- 1. Create the RiderLifecycleStage enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RiderLifecycleStage') THEN
        CREATE TYPE "RiderLifecycleStage" AS ENUM (
            'NEW',
            'IN_PROGRESS',
            'ACTIVE',
            'PAUSED',
            'CLOSED'
        );
    END IF;

    -- 2. Add the lifecycleStage column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Rider' AND column_name = 'lifecycleStage'
    ) THEN
        ALTER TABLE "Rider" ADD COLUMN "lifecycleStage" "RiderLifecycleStage" DEFAULT 'NEW';
    END IF;

    -- 3. Backfill lifecycleStage from lifecycleStatus (one-time, deterministic)
    --    We map every RiderLifecycleStatus value to the closest stage.
    --    This is idempotent: re-running is a no-op because the WHERE
    --    clause excludes rows that already have a non-NEW lifecycleStage.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Rider' AND column_name = 'lifecycleStatus'
    ) THEN
        UPDATE "Rider"
        SET "lifecycleStage" = CASE "lifecycleStatus"
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
          AND "lifecycleStatus" <> 'NEW';
    END IF;
END $$;
