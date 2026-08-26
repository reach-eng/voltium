-- AlterTable: Add check constraints to protect wallet balance integrity
ALTER TABLE "wallets" ADD CONSTRAINT "chk_balance_non_negative" CHECK ("balanceInPaise" >= 0);
ALTER TABLE "wallets" ADD CONSTRAINT "chk_deposit_non_negative" CHECK ("securityDepositInPaise" >= 0);
ALTER TABLE "wallet_ledgers" ADD CONSTRAINT "chk_ledger_amount_positive" CHECK ("amountInPaise" > 0);
