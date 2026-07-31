/**
 * Rental Status State Machine
 *
 * NO_RENTAL → PLAN_SELECTED → PICKUP_SCHEDULED → ACTIVE
 * ACTIVE → OVERDUE | RETURN_PENDING | SUSPENDED | CLOSED
 * OVERDUE → ACTIVE | SUSPENDED
 * RETURN_PENDING → RETURN_APPROVED → CLOSED
 *
 * See docs/STATE_MACHINES.md for full transition map.
 */

export type RentalStatus =
  | 'NO_RENTAL'
  | 'DEPOSIT_APPROVED'
  | 'PLAN_SELECTED'
  | 'PICKUP_SCHEDULED'
  | 'ACTIVE'
  | 'OVERDUE'
  | 'RETURN_PENDING'
  | 'RETURN_APPROVED'
  | 'CLOSED'
  | 'SUSPENDED';

type TransitionMap = Record<RentalStatus, RentalStatus[]>;

const VALID_TRANSITIONS: TransitionMap = {
  NO_RENTAL: ['PLAN_SELECTED', 'DEPOSIT_APPROVED'],
  DEPOSIT_APPROVED: ['PLAN_SELECTED'],
  PLAN_SELECTED: ['PICKUP_SCHEDULED', 'ACTIVE'],
  PICKUP_SCHEDULED: ['ACTIVE'],
  ACTIVE: ['OVERDUE', 'RETURN_PENDING', 'SUSPENDED', 'CLOSED'],
  OVERDUE: ['ACTIVE', 'SUSPENDED'],
  RETURN_PENDING: ['RETURN_APPROVED'],
  RETURN_APPROVED: ['CLOSED'],
  SUSPENDED: ['ACTIVE', 'CLOSED'],
  CLOSED: [],
};

import { DomainError } from '@/lib/domain-error';

export class RentalStateError extends DomainError {
  readonly httpStatus = 409;
  readonly errorCode = 'RENTAL_STATE_CONFLICT';

  constructor(
    message: string,
    public readonly currentStatus: RentalStatus,
    public readonly targetStatus: RentalStatus
  ) {
    super(message);
    this.name = 'RentalStateError';
  }
}

export function validateRentalTransition(current: RentalStatus, target: RentalStatus): void {
  if (current === target) return;

  const allowed = VALID_TRANSITIONS[current];
  if (!allowed?.includes(target)) {
    throw new RentalStateError(
      `Invalid rental transition: "${current}" → "${target}". ` +
        `Allowed: ${allowed?.join(', ') || 'none'}.`,
      current,
      target
    );
  }
}

export function canTransitionRental(current: RentalStatus, target: RentalStatus): boolean {
  try {
    validateRentalTransition(current, target);
    return true;
  } catch {
    return false;
  }
}

export function getValidNextRentalStates(status: RentalStatus): RentalStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}
