-- Migration: idempotency_status
-- Adds a status column to IdempotencyKey so rows can represent an in-flight
-- lock ('processing') before the response is known, enabling atomic
-- check-and-lock semantics via INSERT ... ON CONFLICT DO NOTHING.

ALTER TABLE "IdempotencyKey"
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';

-- Back-fill: all existing rows are already completed
UPDATE "IdempotencyKey" SET status = 'completed' WHERE status IS NULL;

-- Allow response to be empty string for in-flight rows
ALTER TABLE "IdempotencyKey"
  ALTER COLUMN response SET DEFAULT '';
