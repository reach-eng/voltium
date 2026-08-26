-- Rename IdempotencyStatus enum to lowercase to match @@map("idempotency_status")
ALTER TYPE "IdempotencyStatus" RENAME TO idempotency_status;
