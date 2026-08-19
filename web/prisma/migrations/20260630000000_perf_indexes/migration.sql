-- CreateIndex
-- PR-2026-08-07 (fix): the 0_init baseline was regenerated and now already
-- creates Transaction_createdAt_idx, so this migration must be idempotent to
-- allow fresh deploys (42P07 otherwise). CREATE INDEX IF NOT EXISTS is a no-op
-- for environments that applied the original (non-idempotent) statements.
CREATE INDEX IF NOT EXISTS "RentalLease_createdAt_idx" ON "RentalLease"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RentalLease_status_createdAt_idx" ON "RentalLease"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_status_createdAt_idx" ON "Transaction"("status", "createdAt");
