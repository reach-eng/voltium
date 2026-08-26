-- Migration: idempotency_status
-- Adds a status column to IdempotencyKey so rows can represent an in-flight
-- lock ('PROCESSING') before the response is known, enabling atomic
-- check-and-lock semantics via INSERT ... ON CONFLICT DO NOTHING.
--
-- Phase 3.3 fix: the previous migration declared the column as TEXT
-- with a lowercase 'completed' default. The Prisma schema (and the
-- generated client) types the column as the IdempotencyStatus enum
-- (PROCESSING / COMPLETED / FAILED). Use the enum and uppercase
-- values so the column matches the model.

-- Create the enum if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IdempotencyStatus') THEN
    CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');
  END IF;
END$$;

-- Add the column as the enum type, default PROCESSING (matches
-- @default(PROCESSING) in schema.prisma). Use IF NOT EXISTS so
-- re-running this migration on a DB that already has the column
-- is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'IdempotencyKey' AND column_name = 'status'
  ) THEN
    ALTER TABLE "IdempotencyKey"
      ADD COLUMN status "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING';
  END IF;
END$$;

-- Back-fill: any pre-existing rows that used the old lowercase
-- text values are normalised to the enum. (Future rows are written
-- by the Prisma client using the enum, so this only matters for
-- DBs that were upgraded from a prior state.)
UPDATE "IdempotencyKey"
  SET status = 'COMPLETED'
  WHERE status::text = 'completed';

-- Allow response to be empty string for in-flight rows
ALTER TABLE "IdempotencyKey"
  ALTER COLUMN response SET DEFAULT '';

-- Add the @@index([status]) declared in schema.prisma (if not
-- already present).
CREATE INDEX IF NOT EXISTS "IdempotencyKey_status_idx"
  ON "IdempotencyKey"("status");
