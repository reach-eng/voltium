/**
 * Rider Lifecycle State Machine
 *
 * Controls the full rider onboarding-to-active lifecycle.
 *
 * NEW → PHONE_VERIFIED → PROFILE_SUBMITTED → KYC_SUBMITTED → KYC_APPROVED →
 * GUARANTOR_SUBMITTED → GUARANTOR_APPROVED → DEPOSIT_PENDING → DEPOSIT_APPROVED →
 * PLAN_SELECTED → PICKUP_SCHEDULED → ACTIVE
 *
 * ACTIVE → SUSPENDED | RETURN_PENDING
 * SUSPENDED → ACTIVE | CLOSED
 * RETURN_PENDING → CLOSED
 */

export type RiderLifecycleStatus =
  | 'NEW'
  | 'PHONE_VERIFIED'
  | 'PROFILE_SUBMITTED'
  | 'KYC_SUBMITTED'
  | 'KYC_APPROVED'
  | 'GUARANTOR_SUBMITTED'
  | 'GUARANTOR_APPROVED'
  | 'DEPOSIT_PENDING'
  | 'DEPOSIT_APPROVED'
  | 'PLAN_SELECTED'
  | 'PICKUP_SCHEDULED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'RETURN_PENDING'
  | 'CLOSED';

type TransitionMap = Record<RiderLifecycleStatus, RiderLifecycleStatus[]>;

const VALID_TRANSITIONS: TransitionMap = {
  NEW: ['PHONE_VERIFIED'],
  PHONE_VERIFIED: ['PROFILE_SUBMITTED'],
  PROFILE_SUBMITTED: ['KYC_SUBMITTED'],
  KYC_SUBMITTED: ['KYC_APPROVED'],
  KYC_APPROVED: ['GUARANTOR_SUBMITTED'],
  GUARANTOR_SUBMITTED: ['GUARANTOR_APPROVED'],
  GUARANTOR_APPROVED: ['DEPOSIT_PENDING'],
  DEPOSIT_PENDING: ['DEPOSIT_APPROVED'],
  DEPOSIT_APPROVED: ['PLAN_SELECTED'],
  PLAN_SELECTED: ['PICKUP_SCHEDULED'],
  PICKUP_SCHEDULED: ['ACTIVE'],
  ACTIVE: ['SUSPENDED', 'RETURN_PENDING'],
  SUSPENDED: ['ACTIVE', 'CLOSED'],
  RETURN_PENDING: ['CLOSED'],
  CLOSED: [],
};

export class RiderLifecycleError extends Error {
  constructor(
    message: string,
    public readonly currentStatus: RiderLifecycleStatus,
    public readonly targetStatus: RiderLifecycleStatus
  ) {
    super(message);
    this.name = 'RiderLifecycleError';
  }
}

export function validateRiderTransition(
  current: RiderLifecycleStatus,
  target: RiderLifecycleStatus
): void {
  if (current === target) return;

  const allowed = VALID_TRANSITIONS[current];
  if (!allowed?.includes(target)) {
    throw new RiderLifecycleError(
      `Invalid rider transition: "${current}" → "${target}". ` +
        `Allowed: ${allowed?.join(', ') || 'none'}.`,
      current,
      target
    );
  }
}

export function canTransitionRider(
  current: RiderLifecycleStatus,
  target: RiderLifecycleStatus
): boolean {
  try {
    validateRiderTransition(current, target);
    return true;
  } catch {
    return false;
  }
}

export function getValidNextRiderStates(status: RiderLifecycleStatus): RiderLifecycleStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}
