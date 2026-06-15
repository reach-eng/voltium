/**
 * Deposits module - Types
 *
 * Security deposit management types.
 */

export type DepositStatus =
  | 'NOT_SUBMITTED'
  | 'PENDING_VERIFICATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED'
  | 'FORFEITED'
  | 'PARTIALLY_REFUNDED';

export interface DepositRecord {
  id: string;
  riderId: string;
  amountPaise: number;
  status: DepositStatus;
  proofUrl?: string;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  refundedAt?: Date;
}

export interface DepositReview {
  action: 'APPROVE' | 'REJECT';
  rejectionReason?: string;
}
