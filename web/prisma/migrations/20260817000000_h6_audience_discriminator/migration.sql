-- H6-2026-08-13: Add TransactionAudience discriminator + audience column.
--
-- Goal: let the rider history endpoint filter to user-initiated flows
-- (top-ups + security deposits) without having to enumerate the 7
-- system-only purposes (RENT_PAYMENT, REWARD, REFUND, REVERSAL,
-- ADMIN_ADJUSTMENT, FORFEITURE, ONBOARDING).
--
-- Strategy: add an `audience` column on transactions, default SYSTEM
-- (safe default for any purpose not explicitly tagged USER). Backfill
-- existing TOP_UP and SECURITY_DEPOSIT rows to USER. Server-side
-- filtering is then a single WHERE clause on the new index.
--
-- Note: a separate pending migration
-- 20260813030000_add_cancelled_to_transaction_status adds 'CANCELLED'
-- to the TransactionStatus enum. That migration is NOT included here
-- because the dev DB is already 16 migrations behind on a different
-- chain; it must be applied separately (see FOLLOWUP_TICKETS.md).

-- CreateEnum
CREATE TYPE "TransactionAudience" AS ENUM ('USER', 'SYSTEM');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "audience" "TransactionAudience" NOT NULL DEFAULT 'SYSTEM';

-- Backfill: existing rider-initiated flows become USER-audience so
-- /api/transaction/history works for riders who already have data.
UPDATE "transactions" SET "audience" = 'USER' WHERE "purpose" IN ('TOP_UP', 'SECURITY_DEPOSIT');

-- CreateIndex: supports the rider history query
-- (WHERE riderId = ? AND audience = ? ORDER BY createdAt DESC)
CREATE INDEX "transactions_riderId_audience_createdAt_idx" ON "transactions"("riderId", "audience", "createdAt");
