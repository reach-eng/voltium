/**
 * KYC Status State Machine
 *
 * Controls KYC document lifecycle: DRAFT → SUBMITTED → APPROVED | REJECTED | INFO_REQUIRED
 *
 * See docs/STATE_MACHINES.md for full transition map.
 */

export type KycStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'INFO_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

type TransitionMap = Record<KycStatus, KycStatus[]>;

const VALID_TRANSITIONS: TransitionMap = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'INFO_REQUIRED'],
  INFO_REQUIRED: ['SUBMITTED'],
  APPROVED: ['EXPIRED'],
  REJECTED: ['SUBMITTED'],
  EXPIRED: [],
};

export class KycStateError extends Error {
  constructor(
    message: string,
    public readonly currentStatus: KycStatus,
    public readonly targetStatus: KycStatus
  ) {
    super(message);
    this.name = 'KycStateError';
  }
}

export function validateKycTransition(current: KycStatus, target: KycStatus): void {
  if (current === target) return;

  const allowed = VALID_TRANSITIONS[current];
  if (!allowed?.includes(target)) {
    throw new KycStateError(
      `Invalid KYC transition: "${current}" → "${target}". ` +
        `Allowed: ${allowed?.join(', ') || 'none'}.`,
      current,
      target
    );
  }
}

export function canTransitionKyc(current: KycStatus, target: KycStatus): boolean {
  try {
    validateKycTransition(current, target);
    return true;
  } catch {
    return false;
  }
}

export function getValidNextKycStates(status: KycStatus): KycStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}
