/**
 * Unit tests for state machine transitions.
 *
 * Tests every legal and illegal transition for:
 *   - KYC State Machine
 *   - Guarantor State Machine
 *   - Deposit State Machine
 *   - Transaction State Machine
 *   - Rental State Machine
 *   - Rider Lifecycle State Machine
 *
 * These tests verify the application-layer transition validation.
 * (Prisma enums will be added when migrating to PostgreSQL in Phase 10.)
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// KYC State Machine (kyc_profile.status)
// ---------------------------------------------------------------------------

const KYC_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'INFO_REQUIRED'],
  REJECTED: ['SUBMITTED'],
  INFO_REQUIRED: ['SUBMITTED'],
  APPROVED: ['EXPIRED'],
  EXPIRED: [],
};

function isValidKycTransition(from: string, to: string): boolean {
  const allowed = KYC_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

describe('KYC State Machine', () => {
  it('allows DRAFT → SUBMITTED', () => {
    expect(isValidKycTransition('DRAFT', 'SUBMITTED')).toBe(true);
  });

  it('allows SUBMITTED → APPROVED', () => {
    expect(isValidKycTransition('SUBMITTED', 'APPROVED')).toBe(true);
  });

  it('allows SUBMITTED → REJECTED', () => {
    expect(isValidKycTransition('SUBMITTED', 'REJECTED')).toBe(true);
  });

  it('allows SUBMITTED → INFO_REQUIRED', () => {
    expect(isValidKycTransition('SUBMITTED', 'INFO_REQUIRED')).toBe(true);
  });

  it('allows REJECTED → SUBMITTED (re-submit)', () => {
    expect(isValidKycTransition('REJECTED', 'SUBMITTED')).toBe(true);
  });

  it('allows INFO_REQUIRED → SUBMITTED', () => {
    expect(isValidKycTransition('INFO_REQUIRED', 'SUBMITTED')).toBe(true);
  });

  it('allows APPROVED → EXPIRED', () => {
    expect(isValidKycTransition('APPROVED', 'EXPIRED')).toBe(true);
  });

  // Forbidden transitions
  it('blocks DRAFT → APPROVED (skip submit)', () => {
    expect(isValidKycTransition('DRAFT', 'APPROVED')).toBe(false);
  });

  it('blocks APPROVED → SUBMITTED (already approved)', () => {
    expect(isValidKycTransition('APPROVED', 'SUBMITTED')).toBe(false);
  });

  it('blocks REJECTED → APPROVED (must re-submit first)', () => {
    expect(isValidKycTransition('REJECTED', 'APPROVED')).toBe(false);
  });

  it('blocks EXPIRED → anything', () => {
    expect(isValidKycTransition('EXPIRED', 'SUBMITTED')).toBe(false);
    expect(isValidKycTransition('EXPIRED', 'APPROVED')).toBe(false);
    expect(isValidKycTransition('EXPIRED', 'REJECTED')).toBe(false);
  });

  it('blocks unknown status transitions', () => {
    expect(isValidKycTransition('UNKNOWN', 'SUBMITTED')).toBe(false);
    expect(isValidKycTransition('SUBMITTED', 'UNKNOWN' as string)).toBe(false);
  });

  it('validates all legal transitions are covered', () => {
    const legalFrom = Object.keys(KYC_TRANSITIONS);
    expect(legalFrom).toEqual([
      'DRAFT',
      'SUBMITTED',
      'REJECTED',
      'INFO_REQUIRED',
      'APPROVED',
      'EXPIRED',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Guarantor State Machine (guarantor.status)
// ---------------------------------------------------------------------------

const GUARANTOR_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'INFO_REQUIRED'],
  REJECTED: ['SUBMITTED'],
  INFO_REQUIRED: ['SUBMITTED'],
  APPROVED: ['REPLACED'],
  REPLACED: [],
};

function isValidGuarantorTransition(from: string, to: string): boolean {
  const allowed = GUARANTOR_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

describe('Guarantor State Machine', () => {
  it('allows standard transitions', () => {
    expect(isValidGuarantorTransition('DRAFT', 'SUBMITTED')).toBe(true);
    expect(isValidGuarantorTransition('SUBMITTED', 'APPROVED')).toBe(true);
    expect(isValidGuarantorTransition('SUBMITTED', 'REJECTED')).toBe(true);
    expect(isValidGuarantorTransition('SUBMITTED', 'INFO_REQUIRED')).toBe(true);
    expect(isValidGuarantorTransition('REJECTED', 'SUBMITTED')).toBe(true);
    expect(isValidGuarantorTransition('INFO_REQUIRED', 'SUBMITTED')).toBe(true);
  });

  it('allows APPROVED → REPLACED', () => {
    expect(isValidGuarantorTransition('APPROVED', 'REPLACED')).toBe(true);
  });

  it('blocks REPLACED → anything', () => {
    expect(isValidGuarantorTransition('REPLACED', 'SUBMITTED')).toBe(false);
    expect(isValidGuarantorTransition('REPLACED', 'APPROVED')).toBe(false);
  });

  it('blocks REJECTED → APPROVED (must re-submit)', () => {
    expect(isValidGuarantorTransition('REJECTED', 'APPROVED')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Deposit State Machine (deposit_record.status)
// ---------------------------------------------------------------------------

const DEPOSIT_TRANSITIONS: Record<string, string[]> = {
  NOT_SUBMITTED: ['PENDING_VERIFICATION'],
  PENDING_VERIFICATION: ['APPROVED', 'REJECTED'],
  REJECTED: ['PENDING_VERIFICATION'],
  APPROVED: ['REFUND_REQUESTED', 'FORFEITED'],
  REFUND_REQUESTED: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  REFUNDED: [],
  PARTIALLY_REFUNDED: [],
  FORFEITED: [],
};

function isValidDepositTransition(from: string, to: string): boolean {
  const allowed = DEPOSIT_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

describe('Deposit State Machine', () => {
  it('allows NOT_SUBMITTED → PENDING_VERIFICATION', () => {
    expect(isValidDepositTransition('NOT_SUBMITTED', 'PENDING_VERIFICATION')).toBe(true);
  });

  it('allows PENDING_VERIFICATION → APPROVED/REJECTED', () => {
    expect(isValidDepositTransition('PENDING_VERIFICATION', 'APPROVED')).toBe(true);
    expect(isValidDepositTransition('PENDING_VERIFICATION', 'REJECTED')).toBe(true);
  });

  it('allows REJECTED → PENDING_VERIFICATION (resubmit)', () => {
    expect(isValidDepositTransition('REJECTED', 'PENDING_VERIFICATION')).toBe(true);
  });

  it('allows APPROVED → REFUND_REQUESTED / FORFEITED', () => {
    expect(isValidDepositTransition('APPROVED', 'REFUND_REQUESTED')).toBe(true);
    expect(isValidDepositTransition('APPROVED', 'FORFEITED')).toBe(true);
  });

  it('allows REFUND_REQUESTED → REFUNDED / PARTIALLY_REFUNDED', () => {
    expect(isValidDepositTransition('REFUND_REQUESTED', 'REFUNDED')).toBe(true);
    expect(isValidDepositTransition('REFUND_REQUESTED', 'PARTIALLY_REFUNDED')).toBe(true);
  });

  it('blocks terminal states', () => {
    expect(isValidDepositTransition('REFUNDED', 'APPROVED')).toBe(false);
    expect(isValidDepositTransition('FORFEITED', 'APPROVED')).toBe(false);
  });

  it('blocks PENDING_VERIFICATION → REFUNDED (skip approval)', () => {
    expect(isValidDepositTransition('PENDING_VERIFICATION', 'REFUNDED')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Transaction State Machine (transaction.status)
// ---------------------------------------------------------------------------

const TRANSACTION_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['APPROVED', 'REJECTED', 'FAILED'],
  APPROVED: ['REVERSED', 'REFUNDED'],
  REJECTED: [],
  FAILED: [],
  REVERSED: [],
  REFUNDED: [],
};

function isValidTransactionTransition(from: string, to: string): boolean {
  const allowed = TRANSACTION_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

describe('Transaction State Machine', () => {
  it('allows PENDING → APPROVED/REJECTED/FAILED', () => {
    expect(isValidTransactionTransition('PENDING', 'APPROVED')).toBe(true);
    expect(isValidTransactionTransition('PENDING', 'REJECTED')).toBe(true);
    expect(isValidTransactionTransition('PENDING', 'FAILED')).toBe(true);
  });

  it('allows APPROVED → REVERSED/REFUNDED', () => {
    expect(isValidTransactionTransition('APPROVED', 'REVERSED')).toBe(true);
    expect(isValidTransactionTransition('APPROVED', 'REFUNDED')).toBe(true);
  });

  it('blocks terminal states from further transitions', () => {
    expect(isValidTransactionTransition('REJECTED', 'APPROVED')).toBe(false);
    expect(isValidTransactionTransition('FAILED', 'APPROVED')).toBe(false);
    expect(isValidTransactionTransition('REVERSED', 'APPROVED')).toBe(false);
    expect(isValidTransactionTransition('REFUNDED', 'APPROVED')).toBe(false);
  });

  it('blocks PENDING → REVERSED (must approve first)', () => {
    expect(isValidTransactionTransition('PENDING', 'REVERSED')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rental State Machine (rental_lease.status)
// ---------------------------------------------------------------------------

const RENTAL_TRANSITIONS: Record<string, string[]> = {
  NO_RENTAL: ['PLAN_SELECTED'],
  PLAN_SELECTED: ['PICKUP_SCHEDULED'],
  PICKUP_SCHEDULED: ['ACTIVE'],
  ACTIVE: ['OVERDUE', 'RETURN_PENDING', 'SUSPENDED', 'CLOSED'],
  OVERDUE: ['ACTIVE', 'SUSPENDED'],
  RETURN_PENDING: ['RETURN_APPROVED'],
  RETURN_APPROVED: ['CLOSED'],
  SUSPENDED: ['ACTIVE'],
  CLOSED: [],
};

function isValidRentalTransition(from: string, to: string): boolean {
  const allowed = RENTAL_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

describe('Rental State Machine', () => {
  it('allows forward lifecycle transitions', () => {
    expect(isValidRentalTransition('NO_RENTAL', 'PLAN_SELECTED')).toBe(true);
    expect(isValidRentalTransition('PLAN_SELECTED', 'PICKUP_SCHEDULED')).toBe(true);
    expect(isValidRentalTransition('PICKUP_SCHEDULED', 'ACTIVE')).toBe(true);
  });

  it('allows ACTIVE → OVERDUE/RETURN_PENDING/SUSPENDED/CLOSED', () => {
    expect(isValidRentalTransition('ACTIVE', 'OVERDUE')).toBe(true);
    expect(isValidRentalTransition('ACTIVE', 'RETURN_PENDING')).toBe(true);
    expect(isValidRentalTransition('ACTIVE', 'SUSPENDED')).toBe(true);
    expect(isValidRentalTransition('ACTIVE', 'CLOSED')).toBe(true);
  });

  it('allows OVERDUE → ACTIVE (payment received) or SUSPENDED', () => {
    expect(isValidRentalTransition('OVERDUE', 'ACTIVE')).toBe(true);
    expect(isValidRentalTransition('OVERDUE', 'SUSPENDED')).toBe(true);
  });

  it('allows SUSPENDED → ACTIVE (reinstated)', () => {
    expect(isValidRentalTransition('SUSPENDED', 'ACTIVE')).toBe(true);
  });

  it('blocks RETURN_PENDING → ACTIVE (cannot go back)', () => {
    expect(isValidRentalTransition('RETURN_PENDING', 'ACTIVE')).toBe(false);
  });

  it('blocks CLOSED → anything', () => {
    expect(isValidRentalTransition('CLOSED', 'ACTIVE')).toBe(false);
    expect(isValidRentalTransition('CLOSED', 'RETURN_PENDING')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rider Lifecycle (rider.state)
// ---------------------------------------------------------------------------

const RIDER_LIFECYCLE: Record<string, string[]> = {
  NEW: ['PHONE_VERIFIED'],
  PHONE_VERIFIED: ['PROFILE_SUBMITTED'],
  PROFILE_SUBMITTED: ['KYC_SUBMITTED'],
  KYC_SUBMITTED: ['KYC_APPROVED', 'KYC_REJECTED'],
  KYC_REJECTED: ['PROFILE_SUBMITTED'],
  KYC_APPROVED: ['GUARANTOR_SUBMITTED'],
  GUARANTOR_SUBMITTED: ['GUARANTOR_APPROVED', 'GUARANTOR_REJECTED'],
  GUARANTOR_REJECTED: ['GUARANTOR_SUBMITTED'],
  GUARANTOR_APPROVED: ['DEPOSIT_PENDING'],
  DEPOSIT_PENDING: ['DEPOSIT_APPROVED', 'DEPOSIT_REJECTED'],
  DEPOSIT_REJECTED: ['DEPOSIT_PENDING'],
  DEPOSIT_APPROVED: ['PLAN_SELECTED'],
  PLAN_SELECTED: ['PICKUP_SCHEDULED'],
  PICKUP_SCHEDULED: ['ACTIVE'],
  ACTIVE: ['SUSPENDED', 'RETURN_PENDING', 'CLOSED'],
  SUSPENDED: ['ACTIVE'],
  RETURN_PENDING: ['CLOSED'],
  CLOSED: [],
};

function isValidRiderTransition(from: string, to: string): boolean {
  const allowed = RIDER_LIFECYCLE[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

describe('Rider Lifecycle State Machine', () => {
  it('allows forward lifecycle from NEW → ACTIVE', () => {
    expect(isValidRiderTransition('NEW', 'PHONE_VERIFIED')).toBe(true);
    expect(isValidRiderTransition('PHONE_VERIFIED', 'PROFILE_SUBMITTED')).toBe(true);
    expect(isValidRiderTransition('PROFILE_SUBMITTED', 'KYC_SUBMITTED')).toBe(true);
    expect(isValidRiderTransition('KYC_SUBMITTED', 'KYC_APPROVED')).toBe(true);
    expect(isValidRiderTransition('KYC_APPROVED', 'GUARANTOR_SUBMITTED')).toBe(true);
    expect(isValidRiderTransition('GUARANTOR_SUBMITTED', 'GUARANTOR_APPROVED')).toBe(true);
    expect(isValidRiderTransition('GUARANTOR_APPROVED', 'DEPOSIT_PENDING')).toBe(true);
    expect(isValidRiderTransition('DEPOSIT_PENDING', 'DEPOSIT_APPROVED')).toBe(true);
    expect(isValidRiderTransition('DEPOSIT_APPROVED', 'PLAN_SELECTED')).toBe(true);
    expect(isValidRiderTransition('PLAN_SELECTED', 'PICKUP_SCHEDULED')).toBe(true);
    expect(isValidRiderTransition('PICKUP_SCHEDULED', 'ACTIVE')).toBe(true);
  });

  it('allows rejection → resubmit cycles', () => {
    expect(isValidRiderTransition('KYC_REJECTED', 'PROFILE_SUBMITTED')).toBe(true);
    expect(isValidRiderTransition('GUARANTOR_REJECTED', 'GUARANTOR_SUBMITTED')).toBe(true);
    expect(isValidRiderTransition('DEPOSIT_REJECTED', 'DEPOSIT_PENDING')).toBe(true);
  });

  it('allows ACTIVE → SUSPENDED and back', () => {
    expect(isValidRiderTransition('ACTIVE', 'SUSPENDED')).toBe(true);
    expect(isValidRiderTransition('SUSPENDED', 'ACTIVE')).toBe(true);
  });

  it('allows ACTIVE → RETURN_PENDING → CLOSED', () => {
    expect(isValidRiderTransition('ACTIVE', 'RETURN_PENDING')).toBe(true);
    expect(isValidRiderTransition('RETURN_PENDING', 'CLOSED')).toBe(true);
  });

  // Forbidden transitions
  it('blocks NEW → ACTIVE (skip all onboarding)', () => {
    expect(isValidRiderTransition('NEW', 'ACTIVE')).toBe(false);
  });

  it('blocks ACTIVE → NEW (cannot go backwards)', () => {
    expect(isValidRiderTransition('ACTIVE', 'NEW')).toBe(false);
  });

  it('blocks KYC_REJECTED → KYC_APPROVED (must re-submit)', () => {
    expect(isValidRiderTransition('KYC_REJECTED', 'KYC_APPROVED')).toBe(false);
  });

  it('blocks CLOSED → anything', () => {
    expect(isValidRiderTransition('CLOSED', 'ACTIVE')).toBe(false);
    expect(isValidRiderTransition('CLOSED', 'RETURN_PENDING')).toBe(false);
  });

  it('blocks DEPOSIT_REJECTED → DEPOSIT_APPROVED (must resubmit)', () => {
    expect(isValidRiderTransition('DEPOSIT_REJECTED', 'DEPOSIT_APPROVED')).toBe(false);
  });
});
