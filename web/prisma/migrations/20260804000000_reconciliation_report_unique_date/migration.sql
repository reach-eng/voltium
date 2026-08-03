-- PR-90 (API N10) — guarantee uniqueness of `reconciliation_reports.reportDate`.
--
-- The current schema already declares `reportDate String @unique` and
-- the initial migration `0_init` already created the underlying
-- `ReconciliationReport_reportDate_key` unique index. The
-- `checkReconciliationToday → runWalletReconciliation → recordReconciliation`
-- sequence in `cron/reconciliation/route.ts` therefore races: if two
-- cron ticks fire concurrently, both can pass the existence check and
-- the second `recordReconciliation` then attempts a unique-constraint
-- violation.
--
-- This migration is a defensive idempotent re-add of the same unique
-- index, wrapped in `IF NOT EXISTS`, so:
--   1. Any DB that lost the index in a manual cleanup gets it back.
--   2. Any DB that already has it (the standard case) sees a no-op.
--   3. The route can now rely on `P2002` to detect the race instead
--      of a check-then-act that is inherently racy.
--
-- The constraint is on the renamed snake_case table created by
-- `20260712000002_standardize_table_naming`.

CREATE UNIQUE INDEX IF NOT EXISTS "reconciliation_report_date_unique"
  ON "reconciliation_reports" ("reportDate");
