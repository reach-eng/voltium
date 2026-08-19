/**
 * Deposits module - Types
 *
 * Security deposit management types. PR-ONBOARDING-2026-08-11 (audit 2.19):
 * the previous file diverged from the Prisma `DepositRecord` model — wrong
 * field names (`amountPaise` vs `amountInPaise`, `proofUrl` is not a
 * column), missing columns (transactionId, paidAt, refundedAmountInPaise,
 * forfeitedBy/At, etc.), and the status union was missing `PENDING` which
 * the schema and state machine both emit. Brought back into sync.
 */

export type DepositStatus =
  | 'PENDING'
  | 'PENDING_VERIFICATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED'
  | 'FORFEITED'
  | 'PARTIALLY_REFUNDED'
  | 'NOT_SUBMITTED';

export interface DepositRecord {
  id: string;
  riderId: string;
  transactionId?: string | null;
  amountInPaise: number;
  status: DepositStatus;
  paidAt?: Date | null;
  approvedAt?: Date | null;
  approvedBy?: string | null;
  rejectedAt?: Date | null;
  rejectedBy?: string | null;
  rejectionReason?: string | null;
  refundedAt?: Date | null;
  refundedBy?: string | null;
  refundedAmountInPaise?: number | null;
  forfeitedAt?: Date | null;
  forfeitedBy?: string | null;
  forfeitReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepositReview {
  action: 'APPROVE' | 'REJECT';
  rejectionReason?: string;
}
