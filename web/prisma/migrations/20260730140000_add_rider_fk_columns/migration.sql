-- =============================================================================
-- Add 3 new FK columns on Rider (PR-P3.2 — sub-A of Ticket #7)
-- =============================================================================
-- Ticket: #7 (DB Audit 2.10-2.12)
-- Plan:   docs/P1_P2_PLAN.md PR-P3.2
-- Staging-soak: 1 week minimum before PR-P3.3 (the drop step)
--
-- Columns added (legacy string columns KEPT for backfill compat):
--   Rider.pickupHubId  String?  -> FK -> Hub.id          (onDelete: SetNull)
--   Rider.currentPlanId String? -> FK -> RentalPlan.id   (onDelete: SetNull)
--   Rider.teamLeaderId  String? -> FK -> TeamLeader.id   (onDelete: SetNull)
--
-- Backfill strategy (the "ADD+BACKFILL" half of the migration):
--   The legacy string columns have been used as BOTH names AND IDs across
--   different code paths (see P1_P2_PLAN.md PR-P3.2 verification section).
--   For each row, try the canonical ID first; if no match, try the
--   name; if still no match, set the FK to NULL and log a warning.
--
--   Examples of the mixed-type usage that drove this design:
--     - rental.use-cases.ts:277    writes pickupHub = <hub NAME>
--     - rental.repository.ts:88    writes pickupHub = <hub ID>
--     - plan.use-cases.ts:88       writes currentPlan = <plan NAME>
--     - rental.repository.ts:57    writes currentPlan = <plan ID>
--     - admin-riders-list.use-cases.ts:281-282
--       queries pickupHub = X OR hub.name = X — proves the codebase
--       already KNOWS the column is mixed-type.
--   teamLeader is verified clean (ID-only), so its backfill is a single
--   ID lookup.
--
--   Backfill is silent: rows that don't match anything become NULL. This
--   is the "default to NULL" option from the audit ticket. The DROP
--   column step (PR-P3.3) cannot be done until all readers are migrated,
--   so NULL rows are recoverable by hand if needed.
--
--   The whole script is wrapped in DO $$ ... $$; with information_schema
--   guards so it's safe to re-run on staging (idempotent). On a clean DB
--   the guards short-circuit and the migration is a no-op.
--
-- IMPORTANT: this migration is gated on staging soak (1 week minimum)
-- BEFORE running PR-P3.3 (the drop step). The plan calls for spot-check
-- queries like:
--   SELECT count(*) FROM riders
--    WHERE "pickupHub" IS NOT NULL AND "pickupHubId" IS NULL;
-- to find any unmapped rows before the drop step.

DO $$
DECLARE
    pickup_mapped    INT;
    pickup_unmapped  INT;
    plan_mapped      INT;
    plan_unmapped    INT;
    tl_mapped        INT;
    tl_unmapped      INT;
BEGIN
    -- ── 1. pickupHubId ────────────────────────────────────────────────────
    -- Add column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'riders' AND column_name = 'pickupHubId'
    ) THEN
        ALTER TABLE "riders" ADD COLUMN "pickupHubId" TEXT;
    END IF;

    -- Backfill: try ID match, then name match, else NULL.
    -- Note: a single row is matched by ID if EITHER its legacy string is
    -- exactly a Hub.id OR exactly a Hub.name. The OR is intentional —
    -- a cuid-format string that's also a name (vanishingly rare) would
    -- be ambiguous; we prefer the ID match.
    WITH hub_lookup AS (
        SELECT
            r.id AS rider_id,
            r."pickupHub" AS legacy_value,
            COALESCE(
                (SELECT h.id FROM "hubs" h WHERE h.id = r."pickupHub" LIMIT 1),
                (SELECT h.id FROM "hubs" h WHERE h.name = r."pickupHub" LIMIT 1)
            ) AS resolved_id
        FROM "riders" r
        WHERE r."pickupHub" IS NOT NULL AND r."pickupHub" != ''
    )
    UPDATE "riders" r
    SET "pickupHubId" = hl.resolved_id
    FROM hub_lookup hl
    WHERE r.id = hl.rider_id;

    GET DIAGNOSTICS pickup_mapped = ROW_COUNT;
    SELECT COUNT(*) INTO pickup_unmapped
    FROM "riders"
    WHERE "pickupHub" IS NOT NULL AND "pickupHub" != '' AND "pickupHubId" IS NULL;
    RAISE NOTICE 'pickupHubId backfill: % rows updated, % rows unmapped (will be NULL)',
        pickup_mapped, pickup_unmapped;

    -- FK constraint (idempotent)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'riders_pickupHubId_fkey'
    ) THEN
        ALTER TABLE "riders"
            ADD CONSTRAINT riders_pickupHubId_fkey
            FOREIGN KEY ("pickupHubId") REFERENCES "hubs"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- ── 2. currentPlanId ──────────────────────────────────────────────────
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'riders' AND column_name = 'currentPlanId'
    ) THEN
        ALTER TABLE "riders" ADD COLUMN "currentPlanId" TEXT;
    END IF;

    WITH plan_lookup AS (
        SELECT
            r.id AS rider_id,
            r."currentPlan" AS legacy_value,
            COALESCE(
                (SELECT p.id FROM "rental_plans" p WHERE p.id = r."currentPlan" LIMIT 1),
                (SELECT p.id FROM "rental_plans" p WHERE p.name = r."currentPlan" LIMIT 1)
            ) AS resolved_id
        FROM "riders" r
        WHERE r."currentPlan" IS NOT NULL AND r."currentPlan" != ''
    )
    UPDATE "riders" r
    SET "currentPlanId" = pl.resolved_id
    FROM plan_lookup pl
    WHERE r.id = pl.rider_id;

    GET DIAGNOSTICS plan_mapped = ROW_COUNT;
    SELECT COUNT(*) INTO plan_unmapped
    FROM "riders"
    WHERE "currentPlan" IS NOT NULL AND "currentPlan" != '' AND "currentPlanId" IS NULL;
    RAISE NOTICE 'currentPlanId backfill: % rows updated, % rows unmapped (will be NULL)',
        plan_mapped, plan_unmapped;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'riders_currentPlanId_fkey'
    ) THEN
        ALTER TABLE "riders"
            ADD CONSTRAINT riders_currentPlanId_fkey
            FOREIGN KEY ("currentPlanId") REFERENCES "rental_plans"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- ── 3. teamLeaderId ───────────────────────────────────────────────────
    -- Verified clean: every writer passes a TeamLeader.id (see
    -- server/modules/team-leaders/team-leader.repository.ts:37 which
    -- does `where: { teamLeader: { in: leaderIds, not: null } }`,
    -- confirming the column is queried as an ID list).
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'riders' AND column_name = 'teamLeaderId'
    ) THEN
        ALTER TABLE "riders" ADD COLUMN "teamLeaderId" TEXT;
    END IF;

    WITH tl_lookup AS (
        SELECT
            r.id AS rider_id,
            COALESCE(
                (SELECT t.id FROM "team_leaders" t WHERE t.id = r."teamLeader" LIMIT 1),
                NULL  -- no name fallback: teamLeader is verified ID-only
            ) AS resolved_id
        FROM "riders" r
        WHERE r."teamLeader" IS NOT NULL AND r."teamLeader" != ''
    )
    UPDATE "riders" r
    SET "teamLeaderId" = tl.resolved_id
    FROM tl_lookup tl
    WHERE r.id = tl.rider_id;

    GET DIAGNOSTICS tl_mapped = ROW_COUNT;
    SELECT COUNT(*) INTO tl_unmapped
    FROM "riders"
    WHERE "teamLeader" IS NOT NULL AND "teamLeader" != '' AND "teamLeaderId" IS NULL;
    RAISE NOTICE 'teamLeaderId backfill: % rows updated, % rows unmapped (will be NULL)',
        tl_mapped, tl_unmapped;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'riders_teamLeaderId_fkey'
    ) THEN
        ALTER TABLE "riders"
            ADD CONSTRAINT riders_teamLeaderId_fkey
            FOREIGN KEY ("teamLeaderId") REFERENCES "team_leaders"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- ── 4. Indexes for the new FK columns ─────────────────────────────────
    -- FK columns are queried on rider lists (by hub / by plan / by TL).
    -- Without these indexes, list queries degrade to seq scans after
    -- the legacy column drop in PR-P3.3.
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'riders_pickupHubId_idx') THEN
        CREATE INDEX "riders_pickupHubId_idx" ON "riders" ("pickupHubId");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'riders_currentPlanId_idx') THEN
        CREATE INDEX "riders_currentPlanId_idx" ON "riders" ("currentPlanId");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'riders_teamLeaderId_idx') THEN
        CREATE INDEX "riders_teamLeaderId_idx" ON "riders" ("teamLeaderId");
    END IF;
END $$;
