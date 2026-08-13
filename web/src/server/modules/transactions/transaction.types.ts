/**
 * Transactions module - Types
 *
 * Transaction records, filters, and bulk operation types.
 */

import type { TransactionStatus } from './transaction-state-machine';

export type { TransactionStatus };

export type TransactionType = 'CREDIT' | 'DEBIT';

export type TransactionPurpose =
  | 'TOP_UP'
  | 'SECURITY_DEPOSIT'
  | 'RENT_PAYMENT'
  | 'REWARD'
  | 'REFUND'
  | 'REVERSAL'
  | 'ADMIN_ADJUSTMENT'
  | 'REFERRAL_REWARD';

export interface TransactionFilter {
  status?: string;
  type?: string;
  purpose?: string;
  // H6-2026-08-13: 'USER' | 'SYSTEM' | 'ALL'. Admin screens default
  // to ALL (no filter); rider history defaults to USER (see repo).
  audience?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  riderId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: string;
}

export interface TransactionListResult {
  transactions: Record<string, unknown>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type TransactionStateAction = 'APPROVE' | 'REJECT' | 'REVERSE';

/**
 * P2-2/P3-21 (financial audit): the single-transaction route historically
 * used UPPERCASE actions ('APPROVE') while the bulk route used lowercase
 * ('approve') — every caller hand-mapped between them with `as` casts and
 * ternaries. `toStateAction` is the single normalization point: both routes
 * run their validated action through it before reaching the use-case, so the
 * module has exactly one internal convention (UPPERCASE).
 */
export function toStateAction(action: string): TransactionStateAction {
  const upper = action.toUpperCase();
  if (upper === 'APPROVE' || upper === 'REJECT' || upper === 'REVERSE') return upper;
  throw new Error(`Invalid transaction action: ${action}`);
}

export interface TransactionApproval {
  transactionId: string;
  /** Callers must pass the canonical UPPERCASE action (normalize via `toStateAction`). */
  action: TransactionStateAction;
  rejectionReason?: string;
  walletCreditAmount?: number;
}

export interface BulkActionInput {
  ids: string[];
  action: string;
  value?: string;
}
