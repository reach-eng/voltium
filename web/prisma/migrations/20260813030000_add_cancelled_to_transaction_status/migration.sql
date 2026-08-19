-- PR-ONBOARDING-FLOW-2026-08-13: add CANCELLED to TransactionStatus enum.
--
-- A rider can cancel their own pending transaction by retrying with a
-- different amount in the same 5-min idempotency window (e.g., tapping
-- "Change amount" on the Enter Amount screen). The old behavior threw
-- a hard error and stranded the rider. The new behavior supersedes
-- the stale PENDING row with a CANCELLED row and creates the new
-- transaction.
--
-- Semantically distinct from REJECTED (admin rejected the proof) and
-- REVERSED (admin reversed a prior approval) — the rider changed
-- their mind, no admin involvement.

ALTER TYPE "TransactionStatus" ADD VALUE 'CANCELLED' BEFORE 'REVERSED';
