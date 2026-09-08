/**
 * KYC Status State Machine
 *
 * Controls KYC document lifecycle: DRAFT → SUBMITTED → APPROVED | REJECTED | INFO_REQUIRED
 *
 * See docs/STATE_MACHINES.md for full transition map.
 */

export type KycStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'SUBMITTED'
  | 'INFO_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

type TransitionMap = Record<KycStatus, KycStatus[]>;

const VALID_TRANSITIONS: TransitionMap = {
  DRAFT: ['SUBMITTED'],
  // PENDING: the DB default for `KycProfile.status` and
  // the target of the EXPIRED → PENDING admin re-verify
  // (see EXPIRED entry below). Riders in PENDING need
  // to submit their documents, mirroring DRAFT.
  PENDING: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'INFO_REQUIRED'],
  INFO_REQUIRED: ['SUBMITTED'],
  APPROVED: ['EXPIRED'],
  REJECTED: ['SUBMITTED'],
  // NET-005 follow-up-13 (2026-09-08): allow the
  // admin "Re-verify" action to re-open an EXPIRED
  // profile for re-submission. The EXPIRED state was
  // a dead end (no transitions out) — the rider's
  // 365-day approval had lapsed and there was no
  // admin remedy. The repo's `reopenExpiredKyc`
  // performs the EXPIRED → PENDING transition +
  // clears `expiresAt` + `editableFields` so the
  // rider app's KYC form is editable again. PENDING
  // is correct (not DRAFT) because the rider app's
  // onboarding screen treats PENDING and DRAFT
  // identically for the "needs to submit" view, and
  // PENDING matches the existing semantics: "no row
  // / empty row" and "KycProfile with status
  // PENDING" are both "not yet submitted" (see the
  // queue PENDING filter in
  // `admin-riders.use-cases.ts:190-198`).
  EXPIRED: ['PENDING'],
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
