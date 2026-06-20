/**
 * Deposit Status State Machine
 *
 * PENDING → APPROVED | REJECTED
 * APPROVED → REFUNDED | FORFEITED
 *
 * Refund flow: APPROVED → REFUND_REQUESTED → REFUNDED | PARTIALLY_REFUNDED
 *
 * The actual state transitions are enforced in src/lib/services/deposit-service.ts.
 * This module provides typed validation and query helpers for consistency.
 *
 * See docs/STATE_MACHINES.md for full transition map.
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

type TransitionMap = Record<DepositStatus, DepositStatus[]>;

const VALID_TRANSITIONS: TransitionMap = {
  NOT_SUBMITTED: ['PENDING_VERIFICATION'],
  PENDING_VERIFICATION: ['APPROVED', 'REJECTED'],
  APPROVED: ['REFUND_REQUESTED', 'FORFEITED'],
  REJECTED: ['PENDING_VERIFICATION'],
  REFUND_REQUESTED: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  REFUNDED: [],
  FORFEITED: [],
  PARTIALLY_REFUNDED: [],
};

export class DepositStateMachineError extends Error {
  constructor(
    message: string,
    public readonly currentStatus: DepositStatus,
    public readonly targetStatus: DepositStatus
  ) {
    super(message);
    this.name = 'DepositStateMachineError';
  }
}

export function validateDepositTransition(current: DepositStatus, target: DepositStatus): void {
  if (current === target) return;

  const allowed = VALID_TRANSITIONS[current];
  if (!allowed?.includes(target)) {
    throw new DepositStateMachineError(
      `Invalid deposit transition: "${current}" → "${target}". ` +
        `Allowed: ${allowed?.join(', ') || 'none'}.`,
      current,
      target
    );
  }
}

export function canTransitionDeposit(current: DepositStatus, target: DepositStatus): boolean {
  try {
    validateDepositTransition(current, target);
    return true;
  } catch {
    return false;
  }
}
