-- CreateTable: rider_permissions (expand phase)
-- Extracts the 7 *Granted boolean columns from the Rider table into a
-- normalized RiderPermission table. Old columns are KEPT for backward
-- compatibility and will be dropped in a follow-up contract migration.

CREATE TABLE "rider_permissions" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "grantedAt" TIMESTAMP(3),
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rider_permissions_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one row per rider per permission type
CREATE UNIQUE INDEX "rider_permissions_riderId_permission_key" ON "rider_permissions"("riderId", "permission");

-- Index for FK lookups
CREATE INDEX "rider_permissions_riderId_idx" ON "rider_permissions"("riderId");

-- FK: cascade delete when rider is deleted
ALTER TABLE "rider_permissions" ADD CONSTRAINT "rider_permissions_riderId_fkey"
    FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: create permission rows from existing Rider boolean columns.
-- For each rider, insert 7 rows (one per permission type).
-- grantedAt is set to createdAt for permissions that were already true
-- (we don't know the real grant time, but createdAt is a safe approximation).
INSERT INTO "rider_permissions" ("id", "riderId", "permission", "granted", "grantedAt", "createdAt", "updatedAt")
SELECT
    gen_random_uuid() || ':' || r."id" || ':LOCATION',
    r."id",
    'LOCATION',
    r."locationGranted",
    CASE WHEN r."locationGranted" THEN r."createdAt" ELSE NULL END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "riders" r
WHERE NOT EXISTS (
    SELECT 1 FROM "rider_permissions" rp WHERE rp."riderId" = r."id" AND rp."permission" = 'LOCATION'
)

UNION ALL

SELECT
    gen_random_uuid() || ':' || r."id" || ':BATTERY',
    r."id",
    'BATTERY',
    r."batteryGranted",
    CASE WHEN r."batteryGranted" THEN r."createdAt" ELSE NULL END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "riders" r
WHERE NOT EXISTS (
    SELECT 1 FROM "rider_permissions" rp WHERE rp."riderId" = r."id" AND rp."permission" = 'BATTERY'
)

UNION ALL

SELECT
    gen_random_uuid() || ':' || r."id" || ':CONTACTS',
    r."id",
    'CONTACTS',
    r."contactsGranted",
    CASE WHEN r."contactsGranted" THEN r."createdAt" ELSE NULL END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "riders" r
WHERE NOT EXISTS (
    SELECT 1 FROM "rider_permissions" rp WHERE rp."riderId" = r."id" AND rp."permission" = 'CONTACTS'
)

UNION ALL

SELECT
    gen_random_uuid() || ':' || r."id" || ':CALL_LOGS',
    r."id",
    'CALL_LOGS',
    r."callLogsGranted",
    CASE WHEN r."callLogsGranted" THEN r."createdAt" ELSE NULL END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "riders" r
WHERE NOT EXISTS (
    SELECT 1 FROM "rider_permissions" rp WHERE rp."riderId" = r."id" AND rp."permission" = 'CALL_LOGS'
)

UNION ALL

SELECT
    gen_random_uuid() || ':' || r."id" || ':MIC',
    r."id",
    'MIC',
    r."micGranted",
    CASE WHEN r."micGranted" THEN r."createdAt" ELSE NULL END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "riders" r
WHERE NOT EXISTS (
    SELECT 1 FROM "rider_permissions" rp WHERE rp."riderId" = r."id" AND rp."permission" = 'MIC'
)

UNION ALL

SELECT
    gen_random_uuid() || ':' || r."id" || ':CAMERA',
    r."id",
    'CAMERA',
    r."cameraGranted",
    CASE WHEN r."cameraGranted" THEN r."createdAt" ELSE NULL END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "riders" r
WHERE NOT EXISTS (
    SELECT 1 FROM "rider_permissions" rp WHERE rp."riderId" = r."id" AND rp."permission" = 'CAMERA'
)

UNION ALL

SELECT
    gen_random_uuid() || ':' || r."id" || ':PHONE',
    r."id",
    'PHONE',
    r."phoneGranted",
    CASE WHEN r."phoneGranted" THEN r."createdAt" ELSE NULL END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "riders" r
WHERE NOT EXISTS (
    SELECT 1 FROM "rider_permissions" rp WHERE rp."riderId" = r."id" AND rp."permission" = 'PHONE'
);
