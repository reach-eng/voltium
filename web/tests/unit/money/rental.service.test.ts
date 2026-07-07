import { describe, it, expect } from 'vitest';
import { rentalService } from '../../../src/server/modules/rentals/rental.service';
import {
  validateRentalTransition,
  canTransitionRental,
  getValidNextRentalStates,
  RentalStateError,
} from '../../../src/server/modules/rentals/rental-state-machine';

describe('rentalService', () => {
  describe('calculateDailyRate', () => {
    it('returns base price for DAILY plan', () => {
      expect(rentalService.calculateDailyRate('DAILY', 10000)).toBe(10000);
    });

    it('returns base price / 7 for WEEKLY plan', () => {
      expect(rentalService.calculateDailyRate('WEEKLY', 70000)).toBe(10000);
    });

    it('returns base price / 30 for MONTHLY plan', () => {
      expect(rentalService.calculateDailyRate('MONTHLY', 300000)).toBe(10000);
    });

    it('rounds WEEKLY rate for non-divisible price', () => {
      // 10001 / 7 = 1428.71... → Math.round → 1429
      expect(rentalService.calculateDailyRate('WEEKLY', 10001)).toBe(1429);
    });

    it('rounds MONTHLY rate for non-divisible price', () => {
      // 10001 / 30 = 333.36... → Math.round → 333
      expect(rentalService.calculateDailyRate('MONTHLY', 10001)).toBe(333);
    });

    it('returns 0 for zero price DAILY', () => {
      expect(rentalService.calculateDailyRate('DAILY', 0)).toBe(0);
    });

    it('returns 0 for zero price WEEKLY', () => {
      expect(rentalService.calculateDailyRate('WEEKLY', 0)).toBe(0);
    });

    it('returns 0 for zero price MONTHLY', () => {
      expect(rentalService.calculateDailyRate('MONTHLY', 0)).toBe(0);
    });
  });

  describe('isOverdue', () => {
    it('returns false if no rentPaidUntil date is provided', () => {
      expect(rentalService.isOverdue(undefined)).toBe(false);
    });

    it('returns false if rentPaidUntil is in the future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      expect(rentalService.isOverdue(futureDate)).toBe(false);
    });

    it('returns true if rentPaidUntil is in the past', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);
      expect(rentalService.isOverdue(pastDate)).toBe(true);
    });

    it('returns true if rentPaidUntil is 1 second ago', () => {
      const justPast = new Date(Date.now() - 1000);
      expect(rentalService.isOverdue(justPast)).toBe(true);
    });
  });

  describe('calculateLateFee', () => {
    it('calculates late fee as 10% per day', () => {
      // 2 days * 10% * 10000 = 2000
      expect(rentalService.calculateLateFee(2, 10000)).toBe(2000);
    });

    it('returns 0 for 0 days overdue', () => {
      expect(rentalService.calculateLateFee(0, 10000)).toBe(0);
    });

    it('returns 0 for 0 daily rate', () => {
      expect(rentalService.calculateLateFee(5, 0)).toBe(0);
    });

    it('calculates 1 day late fee correctly', () => {
      expect(rentalService.calculateLateFee(1, 10000)).toBe(1000);
    });

    it('calculates large overdue fee correctly', () => {
      // 30 days * 10% * 10000 = 30000
      expect(rentalService.calculateLateFee(30, 10000)).toBe(30000);
    });
  });
});

describe('rental-state-machine', () => {
  describe('validateRentalTransition', () => {
    it('allows valid transition NO_RENTAL → PLAN_SELECTED', () => {
      expect(() => validateRentalTransition('NO_RENTAL', 'PLAN_SELECTED')).not.toThrow();
    });

    it('allows valid transition DEPOSIT_APPROVED → PLAN_SELECTED', () => {
      expect(() => validateRentalTransition('DEPOSIT_APPROVED', 'PLAN_SELECTED')).not.toThrow();
    });

    it('allows valid transition PLAN_SELECTED → ACTIVE', () => {
      expect(() => validateRentalTransition('PLAN_SELECTED', 'ACTIVE')).not.toThrow();
    });

    it('allows valid transition ACTIVE → OVERDUE', () => {
      expect(() => validateRentalTransition('ACTIVE', 'OVERDUE')).not.toThrow();
    });

    it('allows valid transition ACTIVE → RETURN_PENDING', () => {
      expect(() => validateRentalTransition('ACTIVE', 'RETURN_PENDING')).not.toThrow();
    });

    it('allows valid transition ACTIVE → SUSPENDED', () => {
      expect(() => validateRentalTransition('ACTIVE', 'SUSPENDED')).not.toThrow();
    });

    it('allows valid transition ACTIVE → CLOSED', () => {
      expect(() => validateRentalTransition('ACTIVE', 'CLOSED')).not.toThrow();
    });

    it('allows valid transition OVERDUE → ACTIVE', () => {
      expect(() => validateRentalTransition('OVERDUE', 'ACTIVE')).not.toThrow();
    });

    it('allows valid transition RETURN_PENDING → RETURN_APPROVED', () => {
      expect(() => validateRentalTransition('RETURN_PENDING', 'RETURN_APPROVED')).not.toThrow();
    });

    it('allows valid transition RETURN_APPROVED → CLOSED', () => {
      expect(() => validateRentalTransition('RETURN_APPROVED', 'CLOSED')).not.toThrow();
    });

    it('allows valid transition SUSPENDED → ACTIVE', () => {
      expect(() => validateRentalTransition('SUSPENDED', 'ACTIVE')).not.toThrow();
    });

    it('allows same-to-same transition (no-op)', () => {
      expect(() => validateRentalTransition('ACTIVE', 'ACTIVE')).not.toThrow();
    });

    it('throws RentalStateError for invalid transition NO_RENTAL → ACTIVE', () => {
      expect(() => validateRentalTransition('NO_RENTAL', 'ACTIVE')).toThrow(RentalStateError);
    });

    it('throws RentalStateError for invalid transition CLOSED → ACTIVE', () => {
      expect(() => validateRentalTransition('CLOSED', 'ACTIVE')).toThrow(RentalStateError);
    });

    it('throws RentalStateError for invalid transition RETURN_PENDING → ACTIVE', () => {
      expect(() => validateRentalTransition('RETURN_PENDING', 'ACTIVE')).toThrow(RentalStateError);
    });

    it('error message includes current and target status', () => {
      let err: RentalStateError | undefined;
      try {
        validateRentalTransition('CLOSED', 'PLAN_SELECTED');
      } catch (e: any) {
        err = e;
      }
      expect(err).toBeInstanceOf(RentalStateError);
      expect(err!.currentStatus).toBe('CLOSED');
      expect(err!.targetStatus).toBe('PLAN_SELECTED');
      expect(err!.message).toContain('CLOSED');
      expect(err!.message).toContain('PLAN_SELECTED');
    });
  });

  describe('canTransitionRental', () => {
    it('returns true for valid transition', () => {
      expect(canTransitionRental('ACTIVE', 'OVERDUE')).toBe(true);
    });

    it('returns false for invalid transition', () => {
      expect(canTransitionRental('CLOSED', 'ACTIVE')).toBe(false);
    });

    it('returns true for same-to-same', () => {
      expect(canTransitionRental('ACTIVE', 'ACTIVE')).toBe(true);
    });

    it('returns false for REFUNDED (non-existent) target', () => {
      expect(canTransitionRental('ACTIVE', 'NO_RENTAL')).toBe(false);
    });
  });

  describe('getValidNextRentalStates', () => {
    it('returns multiple valid next states for ACTIVE', () => {
      const states = getValidNextRentalStates('ACTIVE');
      expect(states).toContain('OVERDUE');
      expect(states).toContain('RETURN_PENDING');
      expect(states).toContain('SUSPENDED');
      expect(states).toContain('CLOSED');
    });

    it('returns empty array for CLOSED', () => {
      expect(getValidNextRentalStates('CLOSED')).toEqual([]);
    });

    it('returns PLAN_SELECTED for NO_RENTAL', () => {
      const states = getValidNextRentalStates('NO_RENTAL');
      expect(states).toContain('PLAN_SELECTED');
    });

    it('returns PLAN_SELECTED for DEPOSIT_APPROVED', () => {
      expect(getValidNextRentalStates('DEPOSIT_APPROVED')).toContain('PLAN_SELECTED');
    });
  });
});
