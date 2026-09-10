-- 2026-09-08 system-settings section audit — P0-2 residue:
-- freeze the 3 legacy BUSINESS rent / deposit rows that have ZERO
-- runtime readers. `dailyRent` is the only live per-day price behind
-- the system-settings backdoor and is promoted to the BUSINESS
-- registry in PR-2 (see `settings.registry.ts`); `weeklyRent`,
-- `monthlyRent`, and `securityDeposit` were seeded as editable rows
-- in 2025 but no production code reads them — every pricing path
-- resolves `dailyRent` or the per-vehicle `Plan` rows. Freezing them
-- closes the business-surface allowlist (their absence from the
-- registry makes the BUSINESS coerce throw "Unknown setting key"
-- already, but the rows were still seeded as `isEditable: true` and
-- visible on the System Settings surface before PR-1's sectioning).

UPDATE "system_settings"
SET    "isEditable" = false,
       "description" =
         'Legacy row preserved for forensic context. Runtime pricing uses ' ||
         '`dailyRent` (now in the BUSINESS settings registry) and per-vehicle ' ||
         '`Plan` rows. This row is read by no production code path.'
WHERE  "key" IN ('weeklyRent', 'monthlyRent', 'securityDeposit');
