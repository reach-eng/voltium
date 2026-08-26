-- 1. Add the new model (guarded)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admin_has_permissions') THEN
    CREATE TABLE "admin_has_permissions" (
      "id" TEXT PRIMARY KEY,
      "adminId" TEXT NOT NULL,
      "permission" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "admin_has_permissions_adminId_fkey" FOREIGN KEY ("adminId")
        REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE UNIQUE INDEX "admin_has_permissions_adminId_permission_key"
      ON "admin_has_permissions"("adminId", "permission");
    CREATE INDEX "admin_has_permissions_adminId_idx" ON "admin_has_permissions"("adminId");
    CREATE INDEX "admin_has_permissions_permission_idx" ON "admin_has_permissions"("permission");
  END IF;
END $$;

-- 2. Backfill from legacy array column
INSERT INTO "admin_has_permissions" ("id", "adminId", "permission", "createdAt")
SELECT
  gen_random_uuid()::text || '-' || row_number() OVER ()::text,
  "id",
  unnest("permissions"),
  NOW()
FROM "admins"
WHERE "permissions" IS NOT NULL
  AND array_length("permissions", 1) > 0
ON CONFLICT DO NOTHING;
