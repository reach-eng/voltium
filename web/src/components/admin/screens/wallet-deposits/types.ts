/**
 * R3.7j split — Wallet deposit types.
 *
 * LedgerEntry + WalletStats were inlined inside WalletDepositManagement.tsx.
 * Extracted so the data hook, table, and stats cards can share the same
 * view of a wallet ledger row.
 */

export interface LedgerEntry {
  id: string;
  riderName: string;
  riderId: string;
  type: 'CREDIT' | 'DEBIT';
  purpose: string;
  /** Amount in rupees. */
  amount: number;
  createdAt: string;
}

export interface WalletStats {
  totalBalance: number;
  totalDeposits: number;
  pendingTransactions: number;
}

export const EMPTY_WALLET_STATS: WalletStats = {
  totalBalance: 0,
  totalDeposits: 0,
  pendingTransactions: 0,
};
