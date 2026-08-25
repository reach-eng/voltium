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
  // W6 / M-1: the previous early-return on `current === target` was a
  // double-reversal loophole. A rider who legitimately moves
  // APPROVED → REVERSED (one row in the audit log) and then submits a
  // second REVERSED with the row already at REVERSED status used to
  // pass this validator with a no-op. The CAS predicate at the call
  // site also accepted `expected == target`, so both guards short-
  // circuited and the second call could re-credit the wallet. Now we
  // require an explicit, distinct target — the caller must use the
  // "reverse a reversal" path (a separate admin action) instead of
  // re-applying the same one.
  if (current === target) {
    throw new TransactionStateError(
      `Transaction is already in status "${current}". ` +
        `Re-applying the same transition is not allowed.`,
      current,
      target
    );
  }

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
