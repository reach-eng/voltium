-- Migration: prevent_transaction_and_ledger_delete
-- Adds PostgreSQL triggers to strictly prevent hard-deleting Transaction and WalletLedger records.
-- Financial ledger and transaction records are immutable; corrections must be made via offsetting REVERSAL entries.

CREATE OR REPLACE FUNCTION prevent_transaction_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Hard-deleting a Transaction record is strictly prohibited to preserve financial ledger and accounting audit trails. Use offsetting REVERSAL transactions instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_transaction_delete ON "transactions";
CREATE TRIGGER trg_prevent_transaction_delete
  BEFORE DELETE ON "transactions"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_transaction_delete();

CREATE OR REPLACE FUNCTION prevent_wallet_ledger_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Hard-deleting a WalletLedger entry is strictly prohibited. The financial ledger is strictly append-only.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_wallet_ledger_delete ON "wallet_ledgers";
CREATE TRIGGER trg_prevent_wallet_ledger_delete
  BEFORE DELETE ON "wallet_ledgers"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_wallet_ledger_delete();
