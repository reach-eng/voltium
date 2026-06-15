/**
 * Rider Lifecycle State Machine
 *
 * Governs the primary rider journey from NEW to CLOSED.
 * Every state transition must be validated here before execution.
 *
 * See docs/STATE_MACHINES.md for full transition map.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── State Definition ─────────────────────────────────────────────────────

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

// ── Transition Map ──────────────────────────────────────────────────────

type TransitionMap = Record<RiderLifecycleStatus, RiderLifecycleStatus[]>;

const VALID_TRANSITIONS: TransitionMap = {
  NEW: ['PHONE_VERIFIED'],
  PHONE_VERIFIED: ['PROFILE_SUBMITTED'],
  PROFILE_SUBMITTED: ['KYC_SUBMITTED'],
  KYC_SUBMITTED: ['KYC_APPROVED', 'SUSPENDED'], // SUSPENDED for rejected KYC transition
  KYC_APPROVED: ['GUARANTOR_SUBMITTED'],
  GUARANTOR_SUBMITTED: ['GUARANTOR_APPROVED', 'SUSPENDED'],
  GUARANTOR_APPROVED: ['DEPOSIT_PENDING'],
  DEPOSIT_PENDING: ['DEPOSIT_APPROVED', 'SUSPENDED'],
  DEPOSIT_APPROVED: ['PLAN_SELECTED'],
  PLAN_SELECTED: ['PICKUP_SCHEDULED'],
  PICKUP_SCHEDULED: ['ACTIVE'],
  ACTIVE: ['SUSPENDED', 'RETURN_PENDING'],
  SUSPENDED: ['ACTIVE', 'CLOSED'], // Reinstatement or terminal
  RETURN_PENDING: ['CLOSED'],
  CLOSED: [],
};

// ── Public API ──────────────────────────────────────────────────────────

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

/**
 * Validates that a transition from `current` to `target` is legal.
 * Throws RiderLifecycleError if the transition is not allowed.
 */
export function validateTransition(
  current: RiderLifecycleStatus,
  target: RiderLifecycleStatus
): void {
  if (current === target) {
    return; // No-op transition is allowed
  }

  const allowed = VALID_TRANSITIONS[current];
  if (!allowed) {
    throw new RiderLifecycleError(
      `Rider in status "${current}" cannot transition — no transitions defined.`,
      current,
      target
    );
  }

  if (!allowed.includes(target)) {
    throw new RiderLifecycleError(
      `Invalid rider lifecycle transition: "${current}" → "${target}". ` +
        `Allowed transitions from "${current}": ${allowed.join(', ') || 'none'}.`,
      current,
      target
    );
  }
}

/**
 * Returns the list of valid next states from the given status.
 */
export function getValidNextStates(status: RiderLifecycleStatus): RiderLifecycleStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}

/**
 * Checks if a transition is legal without throwing.
 */
export function canTransition(
  current: RiderLifecycleStatus,
  target: RiderLifecycleStatus
): boolean {
  try {
    validateTransition(current, target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempts to transition a rider's lifecycle status in the database.
 * Validates the transition before applying it. Returns the updated rider.
 *
 * This is the primary function to use in use-cases/repositories.
 */
export async function transitionRiderStatus(
  riderDbId: string,
  currentStatus: RiderLifecycleStatus,
  targetStatus: RiderLifecycleStatus
) {
  validateTransition(currentStatus, targetStatus);

  const rider = await db.rider.update({
    where: { id: riderDbId },
    data: { state: targetStatus },
    select: { id: true, riderId: true, state: true },
  });

  logger.info('[RiderLifecycle] Status transitioned', {
    riderId: rider.riderId,
    from: currentStatus,
    to: targetStatus,
  });

  return rider;
}
