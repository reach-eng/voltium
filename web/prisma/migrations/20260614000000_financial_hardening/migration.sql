-- Financial Hardening Migration
-- Adds: WalletLedger, DepositRecord, ReconciliationReport
-- Modifies: Transaction (idempotencyKey, reversedTxnId, ledger relations)
-- Modifies: Wallet (ledgerEntries relation — no SQL change, Prisma-only)

-- ---------------------------------------------------------------------------
-- 1. Add idempotencyKey and reversedTxnId to Transaction
-- ---------------------------------------------------------------------------
ALTER TABLE "Transaction" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "reversedTxnId" TEXT;

CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");
CREATE INDEX "Transaction_idempotencyKey_idx" ON "Transaction"("idempotencyKey");

-- ---------------------------------------------------------------------------
-- 2. WalletLedger — append-only double-entry journal
-- ---------------------------------------------------------------------------
CREATE TABLE "WalletLedger" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "walletId"       TEXT NOT NULL,
    "riderId"        TEXT NOT NULL,
    "txnId"          TEXT,
    "entryType"      TEXT NOT NULL,
    "category"       TEXT NOT NULL,
    "amountInPaise"  INTEGER NOT NULL,
    "balanceAfter"   INTEGER NOT NULL,
    "idempotencyKey" TEXT,
    "note"           TEXT,
    "actorId"        TEXT,
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletLedger_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WalletLedger_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WalletLedger_txnId_fkey"   FOREIGN KEY ("txnId")   REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WalletLedger_idempotencyKey_key" ON "WalletLedger"("idempotencyKey");
CREATE INDEX "WalletLedger_walletId_idx"  ON "WalletLedger"("walletId");
CREATE INDEX "WalletLedger_riderId_idx"   ON "WalletLedger"("riderId");
CREATE INDEX "WalletLedger_txnId_idx"     ON "WalletLedger"("txnId");
CREATE INDEX "WalletLedger_category_idx"  ON "WalletLedger"("category");
CREATE INDEX "WalletLedger_createdAt_idx" ON "WalletLedger"("createdAt");

-- ---------------------------------------------------------------------------
-- 3. DepositRecord — full deposit lifecycle per rider
-- ---------------------------------------------------------------------------
CREATE TABLE "DepositRecord" (
    "id"                    TEXT NOT NULL PRIMARY KEY,
    "riderId"               TEXT NOT NULL,
    "transactionId"         TEXT,
    "amountInPaise"         INTEGER NOT NULL DEFAULT 0,
    "status"                TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt"                DATETIME,
    "approvedAt"            DATETIME,
    "approvedBy"            TEXT,
    "rejectedAt"            DATETIME,
    "rejectedBy"            TEXT,
    "rejectionReason"       TEXT,
    "refundedAt"            DATETIME,
    "refundedBy"            TEXT,
    "refundedAmountInPaise" INTEGER,
    "forfeitedAt"           DATETIME,
    "forfeitedBy"           TEXT,
    "forfeitReason"         TEXT,
    "createdAt"             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             DATETIME NOT NULL,
    CONSTRAINT "DepositRecord_riderId_fkey"       FOREIGN KEY ("riderId")       REFERENCES "Rider" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DepositRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DepositRecord_riderId_key"       ON "DepositRecord"("riderId");
CREATE UNIQUE INDEX "DepositRecord_transactionId_key" ON "DepositRecord"("transactionId");
CREATE INDEX "DepositRecord_status_idx"  ON "DepositRecord"("status");
CREATE INDEX "DepositRecord_riderId_idx" ON "DepositRecord"("riderId");

-- ---------------------------------------------------------------------------
-- 4. ReconciliationReport — daily audit snapshot
-- ---------------------------------------------------------------------------
CREATE TABLE "ReconciliationReport" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "reportDate"     TEXT NOT NULL,
    "totalWallets"   INTEGER NOT NULL,
    "matched"        INTEGER NOT NULL,
    "mismatched"     INTEGER NOT NULL,
    "totalLedgerSum" INTEGER NOT NULL,
    "totalWalletSum" INTEGER NOT NULL,
    "drift"          INTEGER NOT NULL,
    "mismatchDetails" TEXT NOT NULL DEFAULT '[]',
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ReconciliationReport_reportDate_key" ON "ReconciliationReport"("reportDate");
CREATE INDEX "ReconciliationReport_reportDate_idx" ON "ReconciliationReport"("reportDate");
CREATE INDEX "ReconciliationReport_createdAt_idx"  ON "ReconciliationReport"("createdAt");
