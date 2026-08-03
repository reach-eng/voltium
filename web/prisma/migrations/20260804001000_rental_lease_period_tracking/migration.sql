-- PR-76: rent auto-debit period tracking.
-- Adds nextRentDueAt/lastPaidAt/periodNo to RentalLease so a 7-day
-- tenant is debited once across 7 day-ticks (was: 7 times).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'rental_leases' AND column_name = 'nextRentDueAt'
    ) THEN
        ALTER TABLE "rental_leases" ADD COLUMN "nextRentDueAt" TIMESTAMP(3);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'rental_leases' AND column_name = 'lastPaidAt'
    ) THEN
        ALTER TABLE "rental_leases" ADD COLUMN "lastPaidAt" TIMESTAMP(3);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'rental_leases' AND column_name = 'periodNo'
    ) THEN
        ALTER TABLE "rental_leases" ADD COLUMN "periodNo" INTEGER NOT NULL DEFAULT 0;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "rental_leases_nextRentDueAt_idx"
    ON "rental_leases" ("nextRentDueAt");