-- Migration to convert Float money fields to Int paise

DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'RiderEarning' AND column_name = 'amount'
    ) THEN
        ALTER TABLE "RiderEarning" ADD COLUMN "amountInPaise_temp" INTEGER;
        UPDATE "RiderEarning" SET "amountInPaise_temp" = ROUND("amount" * 100)::INTEGER;
        ALTER TABLE "RiderEarning" DROP COLUMN "amount";
        ALTER TABLE "RiderEarning" RENAME COLUMN "amountInPaise_temp" TO "amountInPaise";
        ALTER TABLE "RiderEarning" ALTER COLUMN "amountInPaise" SET NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'TrafficFine' AND column_name = 'amount'
    ) THEN
        ALTER TABLE "TrafficFine" ADD COLUMN "amountInPaise_temp" INTEGER;
        UPDATE "TrafficFine" SET "amountInPaise_temp" = ROUND("amount" * 100)::INTEGER;
        ALTER TABLE "TrafficFine" DROP COLUMN "amount";
        ALTER TABLE "TrafficFine" RENAME COLUMN "amountInPaise_temp" TO "amountInPaise";
        ALTER TABLE "TrafficFine" ALTER COLUMN "amountInPaise" SET NOT NULL;
    END IF;
END $$;
