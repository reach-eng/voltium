import { describe, it, expect } from 'vitest';
import { rentalService } from '../../../src/server/modules/rentals/rental.service';

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
  });

  describe('calculateLateFee', () => {
    it('calculates late fee as 10% per day', () => {
      // 2 days * 10% * 10000 = 2000
      expect(rentalService.calculateLateFee(2, 10000)).toBe(2000);
    });
  });
});
