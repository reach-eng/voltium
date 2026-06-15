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

import { logger } from '@/lib/logger';

export type RentalStatus =
  | 'NO_RENTAL'
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
  NO_RENTAL: ['PLAN_SELECTED'],
  PLAN_SELECTED: ['PICKUP_SCHEDULED'],
  PICKUP_SCHEDULED: ['ACTIVE'],
  ACTIVE: ['OVERDUE', 'RETURN_PENDING', 'SUSPENDED', 'CLOSED'],
  OVERDUE: ['ACTIVE', 'SUSPENDED'],
  RETURN_PENDING: ['RETURN_APPROVED'],
  RETURN_APPROVED: ['CLOSED'],
  SUSPENDED: ['ACTIVE', 'CLOSED'],
  CLOSED: [],
};

export class RentalStateError extends Error {
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
