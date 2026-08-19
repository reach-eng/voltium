-- PR-4 (2026-08-06 fix-plan; 9th audit P0): make the background announcement
-- fanout idempotent. The outbox gives at-least-once delivery; without a
-- unique constraint on (announcementId, riderId), a mid-batch crash + retry
-- would insert duplicate delivery rows and inflate deliveredCount/readCount
-- in the admin announcements list. createMany(skipDuplicates: true) in
-- announcement-broadcast.job.ts now relies on this constraint.

-- Guard: any pre-existing duplicates (from the old synchronous fanout or a
-- partial async run) must be collapsed before the constraint can be added.
-- Keep the earliest row (lowest id) per (announcement, rider); delete later
-- duplicates.
DELETE FROM "announcement_deliveries" a
USING "announcement_deliveries" b
WHERE a."announcementId" = b."announcementId"
  AND a."riderId" = b."riderId"
  AND a.id > b.id;

CREATE UNIQUE INDEX "announcement_deliveries_announcementId_riderId_key"
  ON "announcement_deliveries"("announcementId", "riderId");
