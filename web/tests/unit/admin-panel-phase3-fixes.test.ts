import { describe, it, expect } from 'vitest';
import { createCouponSchema, createOfferSchema } from '@/lib/validators';
import { getExpiresAt, RETENTION_PERIODS } from '@/lib/audit-log';
import { buildSelectedRiderCsv } from '@/components/admin/screens/rider-management/exportSelectedRiders';
import { buildTeamLeaderCsv } from '@/components/admin/screens/team-leaders/exportTeamLeaders';
import type { Rider } from '@/components/admin/screens/rider-management/types';
import type { TeamLeader } from '@/components/admin/screens/team-leaders/types';

describe('Admin Panel Phase 3 Fixes Verification', () => {
  describe('Coupon & Offer Schema Boundary Validation (GROWTH-01b)', () => {
    it('accepts valid percentage coupons with discount <= 100', () => {
      const validCoupon = {
        code: 'PROMO50',
        description: '50% off rental',
        discountType: 'PERCENTAGE',
        discountValue: 50,
        validFrom: '2026-08-01',
        validUntil: '2026-08-31',
        isActive: true,
      };
      const result = createCouponSchema.safeParse(validCoupon);
      expect(result.success).toBe(true);
    });

    it('rejects percentage coupons with discount > 100%', () => {
      const invalidCoupon = {
        code: 'PROMO150',
        description: '150% off rental',
        discountType: 'PERCENTAGE',
        discountValue: 150,
        validFrom: '2026-08-01',
        validUntil: '2026-08-31',
      };
      const result = createCouponSchema.safeParse(invalidCoupon);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Percentage discount cannot exceed 100%');
      }
    });

    it('rejects coupons where validUntil is before validFrom', () => {
      const invalidDates = {
        code: 'TIMETRAVEL',
        description: 'Invalid date coupon',
        discountType: 'FIXED',
        discountValue: 100,
        validFrom: '2026-09-01',
        validUntil: '2026-08-01',
      };
      const result = createCouponSchema.safeParse(invalidDates);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('validUntil must be after or equal to validFrom');
      }
    });

    it('rejects offers where validUntil is before validFrom', () => {
      const invalidOffer = {
        title: 'Summer Sale',
        description: 'Special summer discount offer',
        validFrom: '2026-09-01',
        validUntil: '2026-08-01',
      };
      const result = createOfferSchema.safeParse(invalidOffer);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('validUntil must be after or equal to validFrom');
      }
    });
  });

  describe('Audit Retention Period Matching (SEC-08)', () => {
    it('correctly calculates expiration dates based on action domain', () => {
      const now = Date.now();
      const authExpires = getExpiresAt('admin.login');
      const finExpires = getExpiresAt('transaction.approve');

      expect(authExpires.getTime()).toBeGreaterThan(now);
      expect(finExpires.getTime()).toBeGreaterThan(authExpires.getTime());
    });
  });

  describe('CSV Export Formatting & RFC 4180 Escaping (P2-06)', () => {
    it('escapes quotes, commas, and special characters in Rider CSV export', () => {
      const testRiders: Rider[] = [
        {
          id: 'r_1',
          riderId: 'RD-001',
          fullName: 'Arjun "The Ace" Sharma, Jr.',
          phone: '9876543210',
          state: 'ACTIVE',
          kycStatus: 'APPROVED',
        } as unknown as Rider,
      ];

      const csv = buildSelectedRiderCsv(testRiders, new Set(['r_1']));
      expect(csv).toContain('"Arjun ""The Ace"" Sharma, Jr."');
      expect(csv).toContain('Rider ID,Name,Phone,State,KYC Status');
    });

    it('escapes quotes and commas in Team Leader CSV export', () => {
      const testLeaders: TeamLeader[] = [
        {
          id: 'tl_1',
          name: 'Priya "Lead" Patel',
          phone: '9876543211',
          email: 'priya,lead@voltium.in',
          isActive: true,
          riderCount: 15,
          createdAt: '2026-08-01',
        },
      ];

      const csv = buildTeamLeaderCsv(testLeaders);
      expect(csv).toContain('"Priya ""Lead"" Patel"');
      expect(csv).toContain('"priya,lead@voltium.in"');
    });
  });
});
