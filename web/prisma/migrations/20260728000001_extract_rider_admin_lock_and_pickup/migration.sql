-- CreateTable: rider_admin_locks (expand phase)
-- Extracts admin lock / device control columns from the Rider table.
-- Old columns are KEPT for backward compatibility.

CREATE TABLE "rider_admin_locks" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "isAdminLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockPassword" TEXT,
    "isUninstallBlocked" BOOLEAN NOT NULL DEFAULT true,
    "isLocationMandatory" BOOLEAN NOT NULL DEFAULT true,
    "isAppsControlRestricted" BOOLEAN NOT NULL DEFAULT true,
    "deviceAdminGranted" BOOLEAN NOT NULL DEFAULT false,
    "displayOverlayGranted" BOOLEAN NOT NULL DEFAULT false,
    "lastDeviceViolationAt" TIMESTAMP(3),
    "deviceViolationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rider_admin_locks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rider_admin_locks_riderId_key" ON "rider_admin_locks"("riderId");

ALTER TABLE "rider_admin_locks" ADD CONSTRAINT "rider_admin_locks_riderId_fkey"
    FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from existing Rider columns
INSERT INTO "rider_admin_locks" (
    "id", "riderId", "isAdminLocked", "lockPassword",
    "isUninstallBlocked", "isLocationMandatory", "isAppsControlRestricted",
    "deviceAdminGranted", "displayOverlayGranted",
    "lastDeviceViolationAt", "deviceViolationCount",
    "createdAt", "updatedAt"
)
SELECT
    r."id" || ':adminlock',
    r."id",
    r."isAdminLocked",
    r."lockPassword",
    r."isUninstallBlocked",
    r."isLocationMandatory",
    r."isAppsControlRestricted",
    r."deviceAdminGranted",
    r."displayOverlayGranted",
    r."lastDeviceViolationAt",
    r."deviceViolationCount",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "riders" r
WHERE NOT EXISTS (
    SELECT 1 FROM "rider_admin_locks" l WHERE l."riderId" = r."id"
);


-- CreateTable: rider_pickup_photos (expand phase)
-- Extracts pickup photo columns from the Rider table.
-- Old columns are KEPT for backward compatibility.

CREATE TABLE "rider_pickup_photos" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "pickedAt" TIMESTAMP(3),
    "photoFront" TEXT,
    "photoBack" TEXT,
    "photoLeft" TEXT,
    "photoRight" TEXT,
    "photoWithVehicle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rider_pickup_photos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rider_pickup_photos_riderId_key" ON "rider_pickup_photos"("riderId");

ALTER TABLE "rider_pickup_photos" ADD CONSTRAINT "rider_pickup_photos_riderId_fkey"
    FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from existing Rider columns
INSERT INTO "rider_pickup_photos" (
    "id", "riderId", "pickedAt",
    "photoFront", "photoBack", "photoLeft", "photoRight", "photoWithVehicle",
    "createdAt", "updatedAt"
)
SELECT
    r."id" || ':pickup',
    r."id",
    r."pickedUpAt",
    r."pickupPhotoFront",
    r."pickupPhotoBack",
    r."pickupPhotoLeft",
    r."pickupPhotoRight",
    r."pickupPhotoWithVehicle",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "riders" r
WHERE NOT EXISTS (
    SELECT 1 FROM "rider_pickup_photos" p WHERE p."riderId" = r."id"
);
