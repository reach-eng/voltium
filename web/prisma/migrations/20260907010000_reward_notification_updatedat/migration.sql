-- P2022 drift repair (2026-09-07): add the missing updatedAt columns.
--
-- Background: commit 8e2354ea (2026-09-04, "test(web): add ~40 unit and
-- integration tests") added `updatedAt DateTime? @updatedAt` to the
-- Reward and Notification models in prisma/schema.prisma WITHOUT a
-- migration. Consequences:
--   * `prisma db push` environments (the vitest ?schema=test schema,
--     synced by scripts/sync-test-schema.sh) only got the columns when
--     the sync script was re-run — a stale test schema made every
--     tx.reward.create() / db.notification.create() fail with
--     PrismaClientKnownRequestError P2022 "column updatedAt does not
--     exist" (workers + money test suites).
--   * `prisma migrate deploy` from zero (a fresh production DB) would
--     have created these tables WITHOUT the columns while the client
--     expected them — a latent prod break.
--
-- This migration closes both gaps. It is idempotent: dev machines that
-- already received the columns via an out-of-band `prisma db push` skip
-- the ALTERs instead of failing with "column already exists"; fresh
-- environments replaying 0_init + this migration get them.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rewards' AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "rewards" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "notifications" ADD COLUMN "updatedAt" TIMESTAMP(3);
  END IF;
END $$;
