-- Rename lockPassword to lockPasswordHash
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Rider' AND column_name = 'lockPassword'
    ) THEN
        ALTER TABLE "Rider" RENAME COLUMN "lockPassword" TO "lockPasswordHash";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rider_admin_locks' AND column_name = 'lockPassword'
    ) THEN
        ALTER TABLE "rider_admin_locks" RENAME COLUMN "lockPassword" TO "lockPasswordHash";
    END IF;
END $$;
