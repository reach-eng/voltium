-- DEPOSIT-FIX-2026-08-30: persist the security deposit amount on the
-- rider at subscribe time so admin edits to a plan's deposit do not
-- retroactively change what an existing rider owes. Mirrors the
-- `currentPlanPrice` column added in a prior migration.
--
-- Backfill: copy the joined `rental_plans.securityDepositInPaise` into
-- `riders.currentPlanSecurityDepositInPaise` for any rider with an
-- active currentPlanId, so existing subscribed riders immediately see
-- the deposit they were promised on their next top-up. Riders with
-- no currentPlanId keep NULL (no subscription → no owed amount).
--
-- The plan-subscribe use-case (`plan.use-cases.ts`) writes this column
-- on every subscribe, so new subscriptions also stay consistent.

ALTER TABLE "riders"
  ADD COLUMN "currentPlanSecurityDepositInPaise" INTEGER;

-- Backfill: copy the plan's deposit into the rider's row for any rider
-- with a non-NULL currentPlanId. Uses the joined rental_plans table.
UPDATE "riders" AS r
SET "currentPlanSecurityDepositInPaise" = p."securityDepositInPaise"
FROM "rental_plans" AS p
WHERE r."currentPlanId" = p.id
  AND r."currentPlanId" IS NOT NULL
  AND r."currentPlanSecurityDepositInPaise" IS NULL;
