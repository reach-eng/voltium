import { describe, it, expect } from 'vitest';
import { deviceComplianceUseCases } from '@/server/modules/device-compliance/device-compliance.use-cases';
import { buildSelectedRiderCsv } from '@/components/admin/screens/rider-management/exportSelectedRiders';
import { buildTeamLeaderCsv } from '@/components/admin/screens/team-leaders/exportTeamLeaders';
import { createTeamLeaderSchema, updateCouponSchema } from '@/lib/validators';

describe('Admin Panel Phase 4 Hygiene, Cleanup & Regression Verification', () => {
  describe('Device Compliance Bounds & Safety (HYGIENE-01)', () => {
    it('throws error for NaN or out-of-range coordinates', async () => {
      await expect(
        deviceComplianceUseCases.syncLocation('test_rider', {
          lat: 999, // Out of [-90, 90]
          lng: 77.123,
        })
      ).rejects.toThrow('Invalid latitude coordinate');

      await expect(
        deviceComplianceUseCases.syncLocation('test_rider', {
          lat: 28.123,
          lng: 500, // Out of [-180, 180]
        })
      ).rejects.toThrow('Invalid longitude coordinate');
    });
  });

  describe('Team Leader Schema Normalization (HYGIENE-02)', () => {
    it('accepts valid team leader with null or empty hubId', () => {
      const resultWithNull = createTeamLeaderSchema.safeParse({
        name: 'Rohan Sharma',
        phone: '9876543210',
        hubId: null,
      });
      expect(resultWithNull.success).toBe(true);

      const resultWithEmpty = createTeamLeaderSchema.safeParse({
        name: 'Rohan Sharma',
        phone: '9876543210',
        hubId: '',
      });
      expect(resultWithEmpty.success).toBe(true);
    });

    it('rejects invalid phone number with non-digits or wrong length', () => {
      const result = createTeamLeaderSchema.safeParse({
        name: 'Rohan Sharma',
        phone: '98765-ABC',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Coupon Validation Boundary Invariants (HYGIENE-03)', () => {
    it('enforces that discountValue is strictly positive', () => {
      const result = updateCouponSchema.safeParse({
        id: 'c_test',
        discountValue: -10,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CSV Double-Quote RFC 4180 Escaping Invariants (HYGIENE-04)', () => {
    it('properly escapes quotes, newlines, and commas in CSV cells', () => {
      const csv = buildTeamLeaderCsv([
        {
          id: 'tl_edge',
          name: 'Multi\nLine, "Special"',
          phone: '9999999999',
          email: 'test@example.com',
          isActive: true,
          riderCount: 0,
          createdAt: '2026-08-20',
        },
      ]);
      expect(csv).toContain('"Multi\nLine, ""Special"""');
    });
  });
});
