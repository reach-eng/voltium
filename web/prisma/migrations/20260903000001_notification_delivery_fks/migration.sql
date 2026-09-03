-- P0 fix 2026-09-03: NotificationDelivery had zero FKs — deletes of
-- Notification/Rider left orphans. Add Cascade FKs + dedupe-safe unique key.
--
-- Steps are idempotent and ordered for existing data:
--   1. Delete orphan deliveries (no parent notification or rider).
--   2. Dedupe (notificationId, riderId, channel) keeping the earliest row,
--      so the UNIQUE constraint below can apply on dirty data.
--   3. Add FK constraints (CASCADE) + UNIQUE, IF NOT EXISTS guarded.

-- 1. Orphan cleanup
DELETE FROM "notification_deliveries" nd
WHERE NOT EXISTS (SELECT 1 FROM "notifications" n WHERE n."id" = nd."notificationId")
   OR NOT EXISTS (SELECT 1 FROM "riders" r WHERE r."id" = nd."riderId");

-- 2. Dedupe on (notificationId, riderId, channel), keep earliest createdAt/id
DELETE FROM "notification_deliveries" a
USING "notification_deliveries" b
WHERE a."notificationId" = b."notificationId"
  AND a."riderId" = b."riderId"
  AND a."channel" = b."channel"
  AND (a."createdAt" > b."createdAt" OR (a."createdAt" = b."createdAt" AND a."id" > b."id"));

-- 3. FKs + unique (guarded so re-runs no-op)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_deliveries_notificationId_fkey') THEN
    ALTER TABLE "notification_deliveries"
      ADD CONSTRAINT "notification_deliveries_notificationId_fkey"
      FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_deliveries_riderId_fkey') THEN
    ALTER TABLE "notification_deliveries"
      ADD CONSTRAINT "notification_deliveries_riderId_fkey"
      FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_deliveries_notificationId_riderId_channel_key') THEN
    ALTER TABLE "notification_deliveries"
      ADD CONSTRAINT "notification_deliveries_notificationId_riderId_channel_key"
      UNIQUE ("notificationId", "riderId", "channel");
  END IF;
END $$;
