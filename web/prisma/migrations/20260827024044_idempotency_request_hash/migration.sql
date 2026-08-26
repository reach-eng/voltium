-- 9.5+ Hardening §10 (T-9P0-7): idempotency request fingerprint.
-- Same Idempotency-Key with a different request body must surface as
-- 409 IDEMPOTENCY_CONFLICT instead of silently replaying the cached
-- response. The hash is SHA-256 of a normalized JSON-canonical form
-- of the request body; it is nullable so existing rows from before
-- this migration continue to work (a missing hash on a completed row
-- means "trust the cached response" — the legacy behavior is the
-- safer fallback for the brief overlap during rollout).

ALTER TABLE "idempotency_keys"
  ADD COLUMN "requestHash" TEXT;
