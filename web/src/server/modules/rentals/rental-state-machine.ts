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
  | 'BOOKED'
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
  // PR-ONBOARDING-2026-08-11 (audit 2.19): BOOKED is the lease-side
  // initial state set by `bookRental` (Prisma `RentalLease.status`).
  // Transitions to PICKUP_SCHEDULED on the rider side, and the
  // lease-side ACTIVE is set by syncPickup.
  BOOKED: ['PICKUP_SCHEDULED', 'ACTIVE'],
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
