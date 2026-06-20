/**
 * Transaction Status State Machine
 *
 * PENDING → APPROVED | REJECTED | FAILED
 * APPROVED → REVERSED | REFUNDED
 * REJECTED → PENDING (re-submit)
 * FAILED → PENDING (retry)
 * REVERSED → []
 * REFUNDED → []
 */

export type TransactionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'FAILED'
  | 'REVERSED'
  | 'REFUNDED';

type TransitionMap = Record<TransactionStatus, TransactionStatus[]>;

const VALID_TRANSITIONS: TransitionMap = {
  PENDING: ['APPROVED', 'REJECTED', 'FAILED'],
  APPROVED: ['REVERSED', 'REFUNDED'],
  REJECTED: ['PENDING'],
  FAILED: ['PENDING'],
  REVERSED: [],
  REFUNDED: [],
};

export class TransactionStateError extends Error {
  constructor(
    message: string,
    public readonly currentStatus: TransactionStatus,
    public readonly targetStatus: TransactionStatus
  ) {
    super(message);
    this.name = 'TransactionStateError';
  }
}

export function validateTransactionTransition(
  current: TransactionStatus,
  target: TransactionStatus
): void {
  if (current === target) return;

  const allowed = VALID_TRANSITIONS[current];
  if (!allowed?.includes(target)) {
    throw new TransactionStateError(
      `Invalid transaction transition: "${current}" → "${target}". ` +
        `Allowed: ${allowed?.join(', ') || 'none'}.`,
      current,
      target
    );
  }
}

export function canTransitionTransaction(
  current: TransactionStatus,
  target: TransactionStatus
): boolean {
  try {
    validateTransactionTransition(current, target);
    return true;
  } catch {
    return false;
  }
}
