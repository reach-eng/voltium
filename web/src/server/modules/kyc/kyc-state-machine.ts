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
  // KYC-CORRECTION-P0-2026-09-08 (P0-2): a never-submitted rider
  // (PENDING normalizes to DRAFT in admin-riders.use-cases.ts:540-547)
  // can be rejected or asked for info directly, without first
  // forcing the admin to bump to SUBMITTED. Previously, the
  // Pending tab's Reject button always 500ed with KycStateError.
  DRAFT: ['SUBMITTED', 'REJECTED', 'INFO_REQUIRED'],
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
