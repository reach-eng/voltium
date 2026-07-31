/**
 * Guarantor Status State Machine
 *
 * DRAFT → SUBMITTED → APPROVED | REJECTED | INFO_REQUIRED
 * REJECTED → SUBMITTED (rider re-submits)
 * APPROVED → REPLACED (rider requests replacement)
 *
 * See docs/STATE_MACHINES.md for full transition map.
 */

export type GuarantorStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'INFO_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'REPLACED';

type TransitionMap = Record<GuarantorStatus, GuarantorStatus[]>;

const VALID_TRANSITIONS: TransitionMap = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'INFO_REQUIRED'],
  INFO_REQUIRED: ['SUBMITTED'],
  APPROVED: ['REPLACED'],
  REJECTED: ['SUBMITTED'],
  REPLACED: [],
};

import { DomainError } from '@/lib/domain-error';

export class GuarantorStateError extends DomainError {
  readonly httpStatus = 409;
  readonly errorCode = 'GUARANTOR_STATE_CONFLICT';

  constructor(
    message: string,
    public readonly currentStatus: GuarantorStatus,
    public readonly targetStatus: GuarantorStatus
  ) {
    super(message);
    this.name = 'GuarantorStateError';
  }
}

export function validateGuarantorTransition(
  current: GuarantorStatus,
  target: GuarantorStatus
): void {
  if (current === target) return;

  const allowed = VALID_TRANSITIONS[current];
  if (!allowed?.includes(target)) {
    throw new GuarantorStateError(
      `Invalid guarantor transition: "${current}" → "${target}". ` +
        `Allowed: ${allowed?.join(', ') || 'none'}.`,
      current,
      target
    );
  }
}

export function canTransitionGuarantor(current: GuarantorStatus, target: GuarantorStatus): boolean {
  try {
    validateGuarantorTransition(current, target);
    return true;
  } catch {
    return false;
  }
}
