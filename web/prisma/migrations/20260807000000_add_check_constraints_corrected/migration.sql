-- =============================================================================
-- PR-97 (DB-C-1) — Corrected CHECK constraints migration
-- =============================================================================
-- Ticket: #6 (DB Audit 2.8) — Phase 7A
-- Plan:   docs/AUDIT_PHASE7_PLAN_2026-08-04.md PR-97
--         docs/DEEP_AUDIT_DATABASE_2026-08-03.md
--
-- Why this exists:
--   The original `20260729160000_add_check_constraints` migration targeted
--   PascalCase tables (`"Rider"`, `"KycProfile"`, `"wallets"`). After the
--   20260712000002_standardize_table_naming rename, the lowercase tables
--   (`"riders"`, `"kyc_profiles"`) became the source of truth, so the
--   `ALTER TABLE "Rider"` inside that migration's `DO $$ ... $$;` block
--   threw "relation Rider does not exist" on every constraint it tried
--   to add. The DO block failed atomically and the migration was never
--   recorded in `_prisma_migrations`. As a result, ZERO CHECK constraints
--   were ever applied to the live DB.
--
--   Verified via `web/scripts/inspect-constraints.ts` on 2026-08-04:
--     Found 0 CHECK constraints: (rider_*, kyc_*, wallet_*, outbox_*,
--                                 rental_plan_*, backup_*, idempotency_*)
--
-- This migration:
--   1. Re-creates the original 11 constraints with correct (lowercase)
--      table names from the standardized schema.
--   2. Wraps each ALTER in a `IF NOT EXISTS (pg_constraint)` guard so
--      re-running on a partial DB is idempotent and safe.
--   3. Uses `DO $$ ... $$;` with per-constraint exception handling so a
--      single bad constraint does not abort the whole migration.
--
-- Scope (11 constraints):
--   riders:     batteryLevel 0-100, phone format, email format
--   kyc_profiles: aadhaar/pan/ifsc format (with encrypted-string fallback)
--   wallets:    balanceInPaise >= -20000000 (overdraft floor, NOT >= 0 —
--               admin late-fee debits + reversals intentionally overdraw via
--               allowNegative:true; see P0 fix 2026-09-03),
--               securityDepositInPaise >= 0
--   outbox_events: attempts <= maxAttempts
--   rental_plans: durationDays matches type (DAILY=1, WEEKLY=7, MONTHLY=30)
--   backup_schedules: timeOfDay HH:MM format
--   idempotency_keys: expiresAt > createdAt
--
-- Acceptance:
--   - SELECT conname FROM pg_constraint WHERE conname IN (...11 names...);
--     returns 11 rows
--   - Re-running the migration is a no-op (each ALTER is guarded)
--   - Application inserts that violate a constraint now get a SQLSTATE
--     23514 error from the database (proving the constraint is active)

DO $$
DECLARE
    _failed BOOLEAN := FALSE;
    _errmsg TEXT;
BEGIN
    -- ===========================================================
    -- 1. riders.batteryLevel 0-100
    -- ===========================================================
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rider_battery_level_range') THEN
        BEGIN
            ALTER TABLE "riders" ADD CONSTRAINT rider_battery_level_range
              CHECK ("batteryLevel" >= 0 AND "batteryLevel" <= 100);
            RAISE NOTICE '✓ Added rider_battery_level_range';
        EXCEPTION WHEN OTHERS THEN
            _failed := TRUE;
            _errmsg := SQLERRM;
            RAISE WARNING '✗ rider_battery_level_range failed: %', _errmsg;
        END;
    END IF;

    -- ===========================================================
    -- 2. riders.phone format
    -- ===========================================================
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rider_phone_format') THEN
        BEGIN
            ALTER TABLE "riders" ADD CONSTRAINT rider_phone_format
              CHECK ("phone" ~ '^\+?\d{10,15}$');
            RAISE NOTICE '✓ Added rider_phone_format';
        EXCEPTION WHEN OTHERS THEN
            _failed := TRUE;
            _errmsg := SQLERRM;
            RAISE WARNING '✗ rider_phone_format failed: %', _errmsg;
        END;
    END IF;

    -- ===========================================================
    -- 3. riders.email format (optional)
    -- ===========================================================
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rider_email_format') THEN
        BEGIN
            ALTER TABLE "riders" ADD CONSTRAINT rider_email_format
              CHECK ("email" IS NULL OR "email" ~* '^[^@]+@[^@]+\.[^@]+$');
            RAISE NOTICE '✓ Added rider_email_format';
        EXCEPTION WHEN OTHERS THEN
            _failed := TRUE;
            _errmsg := SQLERRM;
            RAISE WARNING '✗ rider_email_format failed: %', _errmsg;
        END;
    END IF;

    -- ===========================================================
    -- 4. kyc_profiles.aadhaarNumber format
    --    (12 digits OR encrypted blob of >30 chars)
    -- ===========================================================
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kyc_aadhaar_format') THEN
        BEGIN
            ALTER TABLE "kyc_profiles" ADD CONSTRAINT kyc_aadhaar_format
              CHECK ("aadhaarNumber" IS NULL
                     OR "aadhaarNumber" ~ '^\d{12}$'
                     OR LENGTH("aadhaarNumber") > 30);
            RAISE NOTICE '✓ Added kyc_aadhaar_format';
        EXCEPTION WHEN OTHERS THEN
            _failed := TRUE;
            _errmsg := SQLERRM;
            RAISE WARNING '✗ kyc_aadhaar_format failed: %', _errmsg;
        END;
    END IF;

    -- ===========================================================
    -- 5. kyc_profiles.panNumber format
    -- ===========================================================
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kyc_pan_format') THEN
        BEGIN
            ALTER TABLE "kyc_profiles" ADD CONSTRAINT kyc_pan_format
              CHECK ("panNumber" IS NULL
                     OR "panNumber" ~ '^[A-Z]{5}\d{4}[A-Z]$'
                     OR LENGTH("panNumber") > 30);
            RAISE NOTICE '✓ Added kyc_pan_format';
        EXCEPTION WHEN OTHERS THEN
            _failed := TRUE;
            _errmsg := SQLERRM;
            RAISE WARNING '✗ kyc_pan_format failed: %', _errmsg;
        END;
    END IF;

    -- ===========================================================
    -- 6. kyc_profiles.ifscCode format
    -- ===========================================================
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kyc_ifsc_format') THEN
        BEGIN
            ALTER TABLE "kyc_profiles" ADD CONSTRAINT kyc_ifsc_format
              CHECK ("ifscCode" IS NULL
                     OR "ifscCode" ~ '^[A-Z]{4}0[A-Z0-9]{6}$'
                     OR LENGTH("ifscCode") > 30);
            RAISE NOTICE '✓ Added kyc_ifsc_format';
        EXCEPTION WHEN OTHERS THEN
            _failed := TRUE;
            _errmsg := SQLERRM;
            RAISE WARNING '✗ kyc_ifsc_format failed: %', _errmsg;
        END;
    END IF;

    -- ===========================================================
    -- 7. wallets.balanceInPaise >= -20000000 (overdraft floor)
    --    P0 fix 2026-09-03: the old `>= 0` contradicted allowNegative:true
    --    code paths (admin wallet-adjust DEBIT for late fees,
    --    wallet-service reversal debits). With `>= 0` live those threw
    --    23514 mid-$transaction (user-visible 500, stuck leases/reversals).
    --    Floor -20000000 paise (-₹2,00,000) == MAX_ADMIN_DEBIT_PER_DAY_INR
    --    default: any single day of capped admin debits can land, while a
    --    runaway bug (e.g. -₹1Cr) still trips the constraint.
    -- ===========================================================
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_balance_nonnegative') THEN
        BEGIN
            ALTER TABLE "wallets" ADD CONSTRAINT wallet_balance_nonnegative
              CHECK ("balanceInPaise" >= -20000000);
            RAISE NOTICE '✓ Added wallet_balance_nonnegative (floor -20000000 paise)';
        EXCEPTION WHEN OTHERS THEN
            _failed := TRUE;
            _errmsg := SQLERRM;
            RAISE WARNING '✗ wallet_balance_nonnegative failed: %', _errmsg;
        END;
    END IF;

    -- ===========================================================
    -- 8. wallets.securityDepositInPaise >= 0
    --    (PR-97 addition: not in original, but trivially implied)
    -- ===========================================================
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_deposit_nonnegative') THEN
        BEGIN
            ALTER TABLE "wallets" ADD CONSTRAINT wallet_deposit_nonnegative
              CHECK ("securityDepositInPaise" >= 0);
            RAISE NOTICE '✓ Added wallet_deposit_nonnegative';
        EXCEPTION WHEN OTHERS THEN
            _failed := TRUE;
            _errmsg := SQLERRM;
            RAISE WARNING '✗ wallet_deposit_nonnegative failed: %', _errmsg;
        END;
    END IF;

    -- ===========================================================
    -- 9. outbox_events.attempts <= maxAttempts
    -- ===========================================================
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outbox_attempts_cap') THEN
        BEGIN
            ALTER TABLE "outbox_events" ADD CONSTRAINT outbox_attempts_cap
              CHECK ("attempts" <= "maxAttempts");
            RAISE NOTICE '✓ Added outbox_attempts_cap';
        EXCEPTION WHEN OTHERS THEN
            _failed := TRUE;
            _errmsg := SQLERRM;
            RAISE WARNING '✗ outbox_attempts_cap failed: %', _errmsg;
        END;
    END IF;

    -- ===========================================================
    -- 10. rental_plans.durationDays matches type
    --     (DAILY=1, WEEKLY=7, MONTHLY=30 — see Business Logic Rules)
    -- ===========================================================
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rental_plan_duration_matches_type') THEN
        BEGIN
            ALTER TABLE "rental_plans" ADD CONSTRAINT rental_plan_duration_matches_type
              CHECK (
                ("type" = 'DAILY'   AND "durationDays" = 1)  OR
                ("type" = 'WEEKLY'  AND "durationDays" = 7)  OR
                ("type" = 'MONTHLY' AND "durationDays" = 30)
              );
            RAISE NOTICE '✓ Added rental_plan_duration_matches_type';
        EXCEPTION WHEN OTHERS THEN
            _failed := TRUE;
            _errmsg := SQLERRM;
            RAISE WARNING '✗ rental_plan_duration_matches_type failed: %', _errmsg;
        END;
    END IF;

    -- ===========================================================
    -- 11. backup_schedules.timeOfDay HH:MM format
    -- ===========================================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'backup_schedules') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backup_schedule_time_format') THEN
            BEGIN
                ALTER TABLE "backup_schedules" ADD CONSTRAINT backup_schedule_time_format
                  CHECK ("timeOfDay" ~ '^([01]\d|2[0-3]):[0-5]\d$');
                RAISE NOTICE '✓ Added backup_schedule_time_format';
            EXCEPTION WHEN OTHERS THEN
                _failed := TRUE;
                _errmsg := SQLERRM;
                RAISE WARNING '✗ backup_schedule_time_format failed: %', _errmsg;
            END;
        END IF;
    END IF;

    -- ===========================================================
    -- 12. idempotency_keys.expiresAt > createdAt
    -- ===========================================================
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'idempotency_keys') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'idempotency_expiry_after_create') THEN
            BEGIN
                ALTER TABLE "idempotency_keys" ADD CONSTRAINT idempotency_expiry_after_create
                  CHECK ("expiresAt" > "createdAt");
                RAISE NOTICE '✓ Added idempotency_expiry_after_create';
            EXCEPTION WHEN OTHERS THEN
                _failed := TRUE;
                _errmsg := SQLERRM;
                RAISE WARNING '✗ idempotency_expiry_after_create failed: %', _errmsg;
            END;
        END IF;
    END IF;

    IF _failed THEN
        -- P0 fix 2026-09-03: fail LOUDLY. The old WARNING let `db:deploy`
        -- succeed with zero constraints applied (e.g. rental_plan duration
        -- CHECK missing while code assumed it). Re-run is safe (idempotent
        -- guards); fix the violating rows or the DDL, then re-deploy.
        -- Verify live state with:
        --   SELECT conname FROM pg_constraint
        --   WHERE conname IN ('wallet_balance_nonnegative','wallet_deposit_nonnegative',
        --     'rental_plan_duration_matches_type','outbox_attempts_cap', ...);
        RAISE EXCEPTION 'PR-97 migration completed with one or more failures (see warnings above). Fix the cause and re-run (idempotent). Deploy blocked to avoid running without constraints.';
    ELSE
        RAISE NOTICE 'PR-97 migration completed: all CHECK constraints applied or already present.';
    END IF;
END $$;
