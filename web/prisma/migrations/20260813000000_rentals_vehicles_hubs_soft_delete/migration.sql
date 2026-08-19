-- 2026-08-05 rentals/vehicles/hubs audit
-- P1.5: Hub soft delete — deleted hubs are hidden (deletedAt: null) but retained.
ALTER TABLE "hubs" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "hubs_deletedAt_idx" ON "hubs"("deletedAt");

-- P1.8: hub-scoped team leaders — TeamLeader.hubId FK (SetNull on hub delete).
ALTER TABLE "team_leaders" ADD COLUMN "hubId" TEXT;
CREATE INDEX "team_leaders_hubId_idx" ON "team_leaders"("hubId");
ALTER TABLE "team_leaders"
  ADD CONSTRAINT "team_leaders_hubId_fkey"
  FOREIGN KEY ("hubId") REFERENCES "hubs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
