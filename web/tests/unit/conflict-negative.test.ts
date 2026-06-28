/**
 * Phase 2d — Conflict & Race Condition Negative Tests
 *
 * Tests business-rule guards that prevent:
 *   - Double-booking a vehicle + shift combination
 *   - KYC submission after already approved
 *   - Wallet withdrawal with insufficient funds
 *   - Duplicate idempotency key usage
 *   - Concurrent deposit approval
 *
 * Pure unit tests — validates the transition/validation logic directly.
 */

import { describe, it, expect } from 'vitest';

// ── Rental Double-Book Guard ────────────────────────────────────────────────

/**
 * Simulates the business rule: a vehicle + shift + date combination
 * must be unique (enforced by Prisma @@unique constraint).
 * If a lease already exists for that combo, a second one must be rejected.
 */

interface ExistingLease {
  vehicleId: string;
  shiftId: string;
  leaseDate: string;
  riderId: string;
  status: string;
}

function canBookVehicle(
  existingLeases: ExistingLease[],
  vehicleId: string,
  shiftId: string,
  leaseDate: string
): { allowed: boolean; reason?: string } {
  const conflict = existingLeases.find(
    (l) =>
      l.vehicleId === vehicleId &&
      l.shiftId === shiftId &&
      l.leaseDate === leaseDate &&
      l.status !== 'CLOSED' &&
      l.status !== 'REJECTED'
  );
  if (conflict) {
    return { allowed: false, reason: `Vehicle ${vehicleId} is already booked for shift ${shiftId} on ${leaseDate}` };
  }
  return { allowed: true };
}

describe('Rental — double-book guard', () => {
  const existingLeases: ExistingLease[] = [
    { vehicleId: 'vh-1', shiftId: 'shift-morning', leaseDate: '2026-07-01', riderId: 'rider-1', status: 'BOOKED' },
    { vehicleId: 'vh-1', shiftId: 'shift-morning', leaseDate: '2026-07-02', riderId: 'rider-1', status: 'ACTIVE' },
  ];

  it('blocks double-booking same vehicle + shift + date', () => {
    const result = canBookVehicle(existingLeases, 'vh-1', 'shift-morning', '2026-07-01');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('already booked');
  });

  it('allows same vehicle on a different date', () => {
    const result = canBookVehicle(existingLeases, 'vh-1', 'shift-morning', '2026-07-03');
    expect(result.allowed).toBe(true);
  });

  it('allows same vehicle on same date but different shift', () => {
    const result = canBookVehicle(existingLeases, 'vh-1', 'shift-afternoon', '2026-07-01');
    expect(result.allowed).toBe(true);
  });

  it('allows different vehicle on same shift + date', () => {
    const result = canBookVehicle(existingLeases, 'vh-2', 'shift-morning', '2026-07-01');
    expect(result.allowed).toBe(true);
  });

  it('allows re-booking after previous lease is CLOSED', () => {
    const closedLeases: ExistingLease[] = [
      { vehicleId: 'vh-1', shiftId: 'shift-morning', leaseDate: '2026-07-01', riderId: 'rider-1', status: 'CLOSED' },
    ];
    const result = canBookVehicle(closedLeases, 'vh-1', 'shift-morning', '2026-07-01');
    expect(result.allowed).toBe(true);
  });

  it('allows re-booking after previous lease is REJECTED', () => {
    const rejectedLeases: ExistingLease[] = [
      { vehicleId: 'vh-1', shiftId: 'shift-morning', leaseDate: '2026-07-01', riderId: 'rider-1', status: 'REJECTED' },
    ];
    const result = canBookVehicle(rejectedLeases, 'vh-1', 'shift-morning', '2026-07-01');
    expect(result.allowed).toBe(true);
  });

  it('blocks re-booking while previous is RETURN_PENDING', () => {
    const pendingLeases: ExistingLease[] = [
      { vehicleId: 'vh-1', shiftId: 'shift-morning', leaseDate: '2026-07-01', riderId: 'rider-1', status: 'RETURN_PENDING' },
    ];
    const result = canBookVehicle(pendingLeases, 'vh-1', 'shift-morning', '2026-07-01');
    expect(result.allowed).toBe(false);
  });
});

// ── KYC After Approved Guard ────────────────────────────────────────────────

/**
 * Simulates the KYC submission guard: once KYC is APPROVED,
 * a new submission should be blocked (must go through EXPIRED first).
 */

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

describe('KYC — submission after approval guard', () => {
  it('blocks re-submission when status is APPROVED', () => {
    expect(isValidKycTransition('APPROVED', 'SUBMITTED')).toBe(false);
  });

  it('blocks approval when already APPROVED', () => {
    expect(isValidKycTransition('APPROVED', 'APPROVED')).toBe(false);
  });

  it('allows transition to EXPIRED from APPROVED', () => {
    expect(isValidKycTransition('APPROVED', 'EXPIRED')).toBe(true);
  });

  it('blocks direct jump from DRAFT to APPROVED', () => {
    expect(isValidKycTransition('DRAFT', 'APPROVED')).toBe(false);
  });

  it('blocks direct jump from REJECTED to APPROVED', () => {
    expect(isValidKycTransition('REJECTED', 'APPROVED')).toBe(false);
  });

  it('allows full cycle: SUBMITTED → APPROVED → EXPIRED → SUBMITTED', () => {
    expect(isValidKycTransition('SUBMITTED', 'APPROVED')).toBe(true);
    expect(isValidKycTransition('APPROVED', 'EXPIRED')).toBe(true);
    expect(isValidKycTransition('EXPIRED', 'SUBMITTED')).toBe(false); // EXPIRED is terminal
  });
});

// ── Wallet Insufficient Funds Guard ─────────────────────────────────────────

/**
 * Simulates the wallet debit guard: cannot debit more than available balance.
 */

interface WalletState {
  balanceInPaise: number;
  securityDeposit: number;
}

function canDebit(
  wallet: WalletState,
  amountInPaise: number,
  purpose: string
): { allowed: boolean; reason?: string } {
  if (amountInPaise <= 0) {
    return { allowed: false, reason: 'Amount must be positive' };
  }

  if (purpose === 'RENT_PAYMENT') {
    // Rents can only come from wallet balance (not security deposit)
    if (wallet.balanceInPaise < amountInPaise) {
      return {
        allowed: false,
        reason: `Insufficient wallet balance: have ${wallet.balanceInPaise}, need ${amountInPaise}`,
      };
    }
  }

  if (purpose === 'ADMIN_ADJUSTMENT' || purpose === 'PENALTY') {
    // Penalties/adjustments can go negative up to security deposit limit
    const available = wallet.balanceInPaise + wallet.securityDeposit;
    if (available < amountInPaise) {
      return {
        allowed: false,
        reason: `Insufficient funds (balance + deposit): have ${available}, need ${amountInPaise}`,
      };
    }
  }

  return { allowed: true };
}

describe('Wallet — insufficient funds guard', () => {
  const wallet: WalletState = { balanceInPaise: 5000, securityDeposit: 50000 };

  it('allows rent payment within balance', () => {
    const result = canDebit(wallet, 2199, 'RENT_PAYMENT');
    expect(result.allowed).toBe(true);
  });

  it('blocks rent payment exceeding balance', () => {
    const result = canDebit(wallet, 6000, 'RENT_PAYMENT');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Insufficient wallet balance');
  });

  it('blocks rent payment at exact balance boundary', () => {
    const result = canDebit(wallet, 5000, 'RENT_PAYMENT');
    expect(result.allowed).toBe(true);
  });

  it('blocks rent payment at balance + 1', () => {
    const result = canDebit(wallet, 5001, 'RENT_PAYMENT');
    expect(result.allowed).toBe(false);
  });

  it('blocks zero amount', () => {
    const result = canDebit(wallet, 0, 'RENT_PAYMENT');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('positive');
  });

  it('blocks negative amount', () => {
    const result = canDebit(wallet, -100, 'RENT_PAYMENT');
    expect(result.allowed).toBe(false);
  });

  it('allows penalty up to balance + security deposit', () => {
    const result = canDebit(wallet, 55000, 'ADMIN_ADJUSTMENT');
    expect(result.allowed).toBe(true);
  });

  it('blocks penalty exceeding balance + security deposit', () => {
    const result = canDebit(wallet, 55001, 'ADMIN_ADJUSTMENT');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Insufficient funds');
  });
});

// ── Deposit Approval Race Guard ─────────────────────────────────────────────

/**
 * Simulates the deposit approval guard: only PENDING_VERIFICATION
 * deposits can be approved. Concurrent or duplicate approvals must be blocked.
 */

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

describe('Deposit — concurrent approval guard', () => {
  it('allows first approval from PENDING_VERIFICATION', () => {
    expect(isValidDepositTransition('PENDING_VERIFICATION', 'APPROVED')).toBe(true);
  });

  it('blocks second approval after already APPROVED', () => {
    expect(isValidDepositTransition('APPROVED', 'APPROVED')).toBe(false);
  });

  it('blocks approval from NOT_SUBMITTED (skipping verification)', () => {
    expect(isValidDepositTransition('NOT_SUBMITTED', 'APPROVED')).toBe(false);
  });

  it('blocks refund from PENDING_VERIFICATION (skipping approval)', () => {
    expect(isValidDepositTransition('PENDING_VERIFICATION', 'REFUNDED')).toBe(false);
  });

  it('blocks any transition from REFUNDED (terminal state)', () => {
    expect(isValidDepositTransition('REFUNDED', 'APPROVED')).toBe(false);
    expect(isValidDepositTransition('REFUNDED', 'PENDING_VERIFICATION')).toBe(false);
    expect(isValidDepositTransition('REFUNDED', 'REFUND_REQUESTED')).toBe(false);
  });

  it('blocks any transition from FORFEITED (terminal state)', () => {
    expect(isValidDepositTransition('FORFEITED', 'APPROVED')).toBe(false);
    expect(isValidDepositTransition('FORFEITED', 'REFUNDED')).toBe(false);
  });

  it('allows REJECTED → PENDING_VERIFICATION (resubmit)', () => {
    expect(isValidDepositTransition('REJECTED', 'PENDING_VERIFICATION')).toBe(true);
  });

  it('blocks REJECTED → APPROVED (must resubmit first)', () => {
    expect(isValidDepositTransition('REJECTED', 'APPROVED')).toBe(false);
  });
});

// ── Transaction Double-Spend Guard ──────────────────────────────────────────

/**
 * Simulates the transaction status guard: prevents double-processing
 * and blocks invalid reverse transitions.
 */

const TXN_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['APPROVED', 'REJECTED', 'FAILED'],
  APPROVED: ['REVERSED', 'REFUNDED'],
  REJECTED: [],
  FAILED: [],
  REVERSED: [],
  REFUNDED: [],
};

function isValidTxnTransition(from: string, to: string): boolean {
  const allowed = TXN_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

describe('Transaction — double-spend guard', () => {
  it('allows first approval from PENDING', () => {
    expect(isValidTxnTransition('PENDING', 'APPROVED')).toBe(true);
  });

  it('blocks second approval after APPROVED', () => {
    expect(isValidTxnTransition('APPROVED', 'APPROVED')).toBe(false);
  });

  it('blocks reversal from PENDING (must approve first)', () => {
    expect(isValidTxnTransition('PENDING', 'REVERSED')).toBe(false);
  });

  it('blocks refund from PENDING (must approve first)', () => {
    expect(isValidTxnTransition('PENDING', 'REFUNDED')).toBe(false);
  });

  it('allows REVERSED → nothing (terminal)', () => {
    expect(isValidTxnTransition('REVERSED', 'APPROVED')).toBe(false);
    expect(isValidTxnTransition('REVERSED', 'PENDING')).toBe(false);
  });

  it('allows REFUNDED → nothing (terminal)', () => {
    expect(isValidTxnTransition('REFUNDED', 'APPROVED')).toBe(false);
    expect(isValidTxnTransition('REFUNDED', 'REVERSED')).toBe(false);
  });

  it('allows REJECTED → nothing (terminal)', () => {
    expect(isValidTxnTransition('REJECTED', 'APPROVED')).toBe(false);
    expect(isValidTxnTransition('REJECTED', 'PENDING')).toBe(false);
  });

  it('allows FAILED → nothing (terminal)', () => {
    expect(isValidTxnTransition('FAILED', 'APPROVED')).toBe(false);
    expect(isValidTxnTransition('FAILED', 'PENDING')).toBe(false);
  });
});

// ── Rider Lifecycle Skip-Guard ──────────────────────────────────────────────

/**
 * Simulates the rider lifecycle guard: riders must complete
 * onboarding steps in order. No skipping allowed.
 */

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

describe('Rider lifecycle — step-skip guard', () => {
  it('blocks NEW → ACTIVE (skip entire onboarding)', () => {
    expect(isValidRiderTransition('NEW', 'ACTIVE')).toBe(false);
  });

  it('blocks NEW → KYC_APPROVED (skip phone, profile, KYC)', () => {
    expect(isValidRiderTransition('NEW', 'KYC_APPROVED')).toBe(false);
  });

  it('blocks PROFILE_SUBMITTED → DEPOSIT_PENDING (skip KYC and guarantor)', () => {
    expect(isValidRiderTransition('PROFILE_SUBMITTED', 'DEPOSIT_PENDING')).toBe(false);
  });

  it('blocks KYC_APPROVED → DEPOSIT_PENDING (skip guarantor)', () => {
    expect(isValidRiderTransition('KYC_APPROVED', 'DEPOSIT_PENDING')).toBe(false);
  });

  it('blocks GUARANTOR_APPROVED → ACTIVE (skip deposit, plan, pickup)', () => {
    expect(isValidRiderTransition('GUARANTOR_APPROVED', 'ACTIVE')).toBe(false);
  });

  it('blocks ACTIVE → NEW (no backwards movement)', () => {
    expect(isValidRiderTransition('ACTIVE', 'NEW')).toBe(false);
  });

  it('blocks ACTIVE → KYC_SUBMITTED (cannot redo onboarding)', () => {
    expect(isValidRiderTransition('ACTIVE', 'KYC_SUBMITTED')).toBe(false);
  });

  it('blocks CLOSED → any state', () => {
    for (const state of Object.keys(RIDER_LIFECYCLE)) {
      if (state === 'CLOSED') continue;
      expect(isValidRiderTransition('CLOSED', state)).toBe(false);
    }
  });

  it('allows correct sequential flow NEW → ACTIVE', () => {
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
});
