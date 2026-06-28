-- Drop NOT NULL from IdempotencyKey.response to match schema (response String?)
ALTER TABLE "IdempotencyKey" ALTER COLUMN "response" DROP NOT NULL;
