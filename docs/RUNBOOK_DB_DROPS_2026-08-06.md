# Runbook: Post-soak DB drops (2026-08-06)

## Context

Four migrations were deployed on 2026-07-30 and are in a 1-week staging
soak that ends **2026-08-06**:

1. `20260730000000_alter_admin_permissions_type` — `Admin.permissions` changed
   from `String[]` to `String` (degenerate, will be dropped entirely by R6)
2. `20260730140000_add_rider_fk_columns` — `pickupHubId`, `currentPlanId`,
   `teamLeaderId` FK columns added next to the legacy `pickupHub`,
   `currentPlan`, `teamLeader` string columns
3. `20260730150000_add_rider_lifecycle_stage` — `lifecycleStage` (5-value
   enum) added next to the legacy `lifecycleStatus` (RiderLifecycleStatus)
4. `20260730180000_add_admin_has_permissions` — new relation table for
   admin permissions

## Drops ready to apply (2026-08-06)

Once the staging soak completes with no regression, three drop migrations
become eligible to apply:

| Migration | Removes | From table | Gated on soak for |
|---|---|---|---|
| `20260806000000_drop_admin_legacy_permissions` | `permissions String[]` | `admins` | 1 week from PR-20260730180000 |
| `20260806010000_drop_rider_legacy_string_columns` | `pickupHub`, `currentPlan`, `teamLeader` (String) | `riders` | 1 week from PR-20260730140000 |
| `20260806020000_drop_rider_legacy_lifecycle_status` | `lifecycleStatus` (RiderLifecycleStatus) | `riders` | 1 week from PR-20260730150000 |

All three migration files include **pre-flight safety checks** that abort
the migration with `RAISE EXCEPTION` if:
- The new table has fewer rows than the legacy column has values
- A rider has a non-null legacy string but a null FK (backfill gap)
- A rider has both `lifecycleStatus` AND a different `lifecycleStage` (divergence)

## Pre-flight checklist (2026-08-06, before applying drops)

```sql
-- R6.1 sanity: every legacy value has a corresponding new row
SELECT
  (SELECT COUNT(*) FROM "admins"
   WHERE "permissions" IS NOT NULL
     AND array_length("permissions", 1) > 0) AS legacy_value_count,
  (SELECT COUNT(*) FROM "admin_has_permissions") AS new_row_count;
-- legacy_value_count must be <= new_row_count

-- PR-J sanity: every legacy string has a corresponding FK
SELECT
  (SELECT COUNT(*) FROM "riders" WHERE "pickupHub" IS NOT NULL AND "pickupHubId" IS NULL) AS hub_gaps,
  (SELECT COUNT(*) FROM "riders" WHERE "currentPlan" IS NOT NULL AND "currentPlanId" IS NULL) AS plan_gaps,
  (SELECT COUNT(*) FROM "riders" WHERE "teamLeader" IS NOT NULL AND "teamLeaderId" IS NULL) AS tl_gaps;
-- All three must be 0

-- PR-K.3 sanity: every rider has a lifecycleStage
SELECT COUNT(*) FROM "riders" WHERE "lifecycleStage" IS NULL;
-- Must be 0

-- PR-K.3 divergence check
SELECT COUNT(*) FROM "riders"
 WHERE "lifecycleStage" IS NOT NULL
   AND "lifecycleStatus" IS NOT NULL
   AND "lifecycleStage"::text != "lifecycleStatus"::text;
-- Must be 0
```

## Apply drops

```bash
cd web
npx prisma migrate deploy
```

The three drop migrations apply in order. The `RiderLifecycleStatus` enum
type is intentionally retained after the column drop — it's still
referenced in the audit log table for historical data. Removing the
enum is a separate follow-up (defer to v2 — requires a full scan to
confirm no code path reads it post-drop).

## Post-drop verification

```sql
-- R6.1: verify permissions column is gone
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'admins' AND column_name = 'permissions';
-- Should return 0 rows

-- PR-J: verify legacy string columns are gone
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'riders' AND column_name IN ('pickupHub', 'currentPlan', 'teamLeader');
-- Should return 0 rows

-- PR-K.3: verify lifecycleStatus is gone, lifecycleStage remains
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'riders' AND column_name LIKE 'lifecycle%';
-- Should return only `lifecycleStage`
```

## After applying drops

1. Commit the schema.prisma changes (remove the now-deprecated column
   lines from the schema — they're in the `R6 / PR-J / PR-K.3` comments
   that will be cleaned up after this runbook is read)
2. Update `prisma generate` and rebuild the web app
3. Update `FOLLOWUP_TICKETS.md` to mark the relevant tickets as
   `✅ SHIPPED 2026-08-06`
4. Send a release note in the team channel

## Rollback (if a regression is found)

The drop migrations are **NOT** reversible without a backup. If a
regression is found post-drop:

1. Restore the affected table from the most recent backup
2. Investigate the missing data (which new-table row is wrong?)
3. Apply a follow-up migration to fix the new table
4. Re-deploy the legacy column via a manual ALTER TABLE

The pre-flight checks are designed to make this scenario extremely
unlikely (the migration aborts before any drop if data is missing).
