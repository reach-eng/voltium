-- PostgreSQL CHECK constraints for data integrity

DO $$ 
BEGIN
    -- 1. Rider.batteryLevel 0-100
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rider_battery_level_range') THEN
        ALTER TABLE "Rider" ADD CONSTRAINT rider_battery_level_range
          CHECK ("batteryLevel" >= 0 AND "batteryLevel" <= 100);
    END IF;

    -- 2. Rider.phone format
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rider_phone_format') THEN
        ALTER TABLE "Rider" ADD CONSTRAINT rider_phone_format
          CHECK ("phone" ~ '^\+?\d{10,15}$');
    END IF;

    -- 3. Rider.email format
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rider_email_format') THEN
        ALTER TABLE "Rider" ADD CONSTRAINT rider_email_format
          CHECK ("email" IS NULL OR "email" ~* '^[^@]+@[^@]+\.[^@]+$');
    END IF;

    -- 4. KycProfile.aadhaarNumber format (or encrypted string length > 30)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kyc_aadhaar_format') THEN
        ALTER TABLE "KycProfile" ADD CONSTRAINT kyc_aadhaar_format
          CHECK ("aadhaarNumber" IS NULL OR "aadhaarNumber" ~ '^\d{12}$' OR LENGTH("aadhaarNumber") > 30);
    END IF;

    -- 5. KycProfile.panNumber format (or encrypted string length > 30)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kyc_pan_format') THEN
        ALTER TABLE "KycProfile" ADD CONSTRAINT kyc_pan_format
          CHECK ("panNumber" IS NULL OR "panNumber" ~ '^[A-Z]{5}\d{4}[A-Z]$' OR LENGTH("panNumber") > 30);
    END IF;

    -- 6. KycProfile.ifscCode format (or encrypted string length > 30)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kyc_ifsc_format') THEN
        ALTER TABLE "KycProfile" ADD CONSTRAINT kyc_ifsc_format
          CHECK ("ifscCode" IS NULL OR "ifscCode" ~ '^[A-Z]{4}0[A-Z0-9]{6}$' OR LENGTH("ifscCode") > 30);
    END IF;

    -- 7. Wallet.balanceInPaise >= 0
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_balance_nonnegative') THEN
        ALTER TABLE "wallets" ADD CONSTRAINT wallet_balance_nonnegative
          CHECK ("balanceInPaise" >= 0);
    END IF;

    -- 8. OutboxEvent.attempts <= maxAttempts
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outbox_attempts_cap') THEN
        ALTER TABLE "outbox_events" ADD CONSTRAINT outbox_attempts_cap
          CHECK ("attempts" <= "maxAttempts");
    END IF;

    -- 9. RentalPlan.durationDays matches type
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rental_plan_duration_matches_type') THEN
        ALTER TABLE "rental_plans" ADD CONSTRAINT rental_plan_duration_matches_type
          CHECK (
            ("type" = 'DAILY' AND "durationDays" = 1) OR
            ("type" = 'WEEKLY' AND "durationDays" = 7) OR
            ("type" = 'MONTHLY' AND "durationDays" = 30)
          );
    END IF;

    -- 10. BackupSchedule.timeOfDay format
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backup_schedule_time_format') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'backup_schedules') THEN
            ALTER TABLE "backup_schedules" ADD CONSTRAINT backup_schedule_time_format
              CHECK ("timeOfDay" ~ '^([01]\d|2[0-3]):[0-5]\d$');
        END IF;
    END IF;

    -- 11. IdempotencyKey.expiresAt > createdAt
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'idempotency_expiry_after_create') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'idempotency_keys') THEN
            ALTER TABLE "idempotency_keys" ADD CONSTRAINT idempotency_expiry_after_create
              CHECK ("expiresAt" > "createdAt");
        END IF;
    END IF;
END $$;
