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

type PrismaTransaction = any;

const ALLOWED_INITIAL_STATUSES: RiderLifecycleStatus[] = [
  'NEW',
  'PHONE_VERIFIED',
  'PROFILE_SUBMITTED',
];

export function isValidInitialStatus(status: RiderLifecycleStatus): boolean {
  return ALLOWED_INITIAL_STATUSES.includes(status);
}

/**
 * Attempts to transition a rider's lifecycle status.
 * Fetches the current status internally, validates, then updates.
 * Accepts an optional `tx` for use inside Prisma transactions.
 *
 * This is the primary function to use in use-cases/repositories.
 *
 * For rider creation (no existing rider), use `setInitialStatus()` instead.
 */
export async function transitionRiderStatus(
  riderDbId: string,
  targetStatus: RiderLifecycleStatus,
  tx?: PrismaTransaction
) {
  const rider = await (tx || db).rider.findUnique({
    where: { id: riderDbId },
    select: { id: true, riderId: true, lifecycleStatus: true },
  });
  if (!rider) throw new Error(`Rider not found: ${riderDbId}`);

  validateTransition(rider.lifecycleStatus, targetStatus);

  const result = await (tx || db).rider.updateMany({
    where: { id: riderDbId, lifecycleStatus: rider.lifecycleStatus },
    data: { lifecycleStatus: targetStatus },
  });

  if (result.count === 0) {
    throw new RiderLifecycleError(
      `Rider lifecycle status transition race condition for rider ${riderDbId}`,
      rider.lifecycleStatus,
      targetStatus
    );
  }

  logger.info('[RiderLifecycle] Status transitioned', {
    riderId: rider.riderId,
    from: rider.lifecycleStatus,
    to: targetStatus,
  });

  return { id: rider.id, riderId: rider.riderId, lifecycleStatus: targetStatus };
}

/**
 * Validates and sets initial lifecycleStatus for a newly created rider.
 * Use this instead of transitionRiderStatus for rider creation.
 * Accepts an optional `tx` for use inside Prisma transactions.
 */
export async function setInitialStatus(
  riderDbId: string,
  initialStatus: RiderLifecycleStatus,
  tx?: PrismaTransaction
) {
  const allowedInitial: RiderLifecycleStatus[] = ['NEW', 'PHONE_VERIFIED', 'PROFILE_SUBMITTED'];
  if (!allowedInitial.includes(initialStatus)) {
    throw new RiderLifecycleError(
      `Invalid initial status "${initialStatus}". Allowed: ${allowedInitial.join(', ')}.`,
      'NEW' as RiderLifecycleStatus,
      initialStatus
    );
  }

  const updated = await (tx || db).rider.update({
    where: { id: riderDbId },
    data: { lifecycleStatus: initialStatus },
    select: { id: true, riderId: true, lifecycleStatus: true },
  });

  return updated;
}
