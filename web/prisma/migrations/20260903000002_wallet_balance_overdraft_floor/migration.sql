-- P0 fix 2026-09-03: wallet CHECK vs allowNegative contradiction.
--
-- Migration 20260807000000 (corrected) originally added
--   wallet_balance_nonnegative CHECK (balanceInPaise >= 0)
-- but three code paths intentionally overdraw via allowNegative:true:
--   - POST /api/admin/riders/[id]/wallet-adjust DEBIT (late fees;
--     per-call cap ₹50k, per-day cap ₹2L)
--   - wallet-service reverseWalletEntry (credit-reversal → debit)
--   - admin-riders balance-set debit leg
-- With `>= 0` live, those threw SQLSTATE 23514 mid-$transaction (user 500,
-- stuck lease/reversal). The corrected base migration now declares the floor
-- version; this follow-up repairs databases where the old `>= 0` definition
-- already applied.
--
-- New rule: balanceInPaise >= -20000000 (-₹2,00,000 == MAX_ADMIN_DEBIT_PER_DAY
-- default). Any single day of capped admin debits can land; runaway bugs
-- still trip the constraint. securityDeposit floor (>= 0) is unchanged —
-- deposits never overdraw.
--
-- Idempotent: drops + re-adds only when the definition differs; safe re-run.

DO $$ DECLARE _def TEXT; BEGIN
  SELECT pg_get_constraintdef(oid) INTO _def
    FROM pg_constraint WHERE conname = 'wallet_balance_nonnegative';
  IF _def IS NULL THEN
    -- Constraint missing (base migration never applied it): add floor version.
    ALTER TABLE "wallets" ADD CONSTRAINT wallet_balance_nonnegative
      CHECK ("balanceInPaise" >= -20000000);
    RAISE NOTICE '✓ Added wallet_balance_nonnegative (floor -20000000 paise)';
  ELSIF _def NOT LIKE '%-20000000%' THEN
    -- Old >= 0 definition present: replace with floor version.
    ALTER TABLE "wallets" DROP CONSTRAINT wallet_balance_nonnegative;
    ALTER TABLE "wallets" ADD CONSTRAINT wallet_balance_nonnegative
      CHECK ("balanceInPaise" >= -20000000);
    RAISE NOTICE '✓ Replaced wallet_balance_nonnegative >= 0 with floor -20000000 paise (was: %)', _def;
  ELSE
    RAISE NOTICE 'wallet_balance_nonnegative already at floor definition, no-op.';
  END IF;
END $$;
