-- Step 1: create the enum
CREATE TYPE "notification_category" AS ENUM (
  'PAYMENT', 'KYC', 'MAINTENANCE', 'ANNOUNCEMENT', 'SYSTEM'
);

-- Step 2: add the nullable column
ALTER TABLE "notifications"
  ADD COLUMN "category" "notification_category";

-- Step 3: add the composite index
CREATE INDEX "notifications_riderId_category_createdAt_idx"
  ON "notifications"("riderId", "category", "createdAt" DESC);

-- Step 4: backfill from existing data
UPDATE "notifications" SET "category" = 'PAYMENT'
  WHERE "type" = 'PAYMENT';

UPDATE "notifications" SET "category" = 'KYC'
  WHERE "type" = 'SYSTEM'
    AND ("title" ILIKE '%kyc%'
      OR "title" ILIKE '%verification%'
      OR "title" ILIKE '%document%');

UPDATE "notifications" SET "category" = 'MAINTENANCE'
  WHERE "type" IN ('VEHICLE', 'SOS')
    AND ("title" ILIKE '%service%'
      OR "title" ILIKE '%maintenance%'
      OR "title" ILIKE '%vehicle%'
      OR "title" ILIKE '%battery%'
      OR "title" ILIKE '%swap%');

UPDATE "notifications" SET "category" = 'ANNOUNCEMENT'
  WHERE "type" = 'PROMOTION'
     OR "title" ILIKE '%reward%'
     OR "title" ILIKE '%offer%'
     OR "title" ILIKE '%announcement%';

-- Step 5: SYSTEM is the default for anything still NULL.
UPDATE "notifications" SET "category" = 'SYSTEM'
  WHERE "category" IS NULL;