import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateVehicleTransition } from '@/server/modules/vehicles/vehicle-state-machine';
import { couponUseCases } from '@/server/modules/coupons/coupon.use-cases';
import { offerUseCases } from '@/server/modules/offers/offer.use-cases';
import { shiftUseCases } from '@/server/modules/shifts/shift.use-cases';
import { hasPermission } from '@/lib/auth';
import type { SessionPayload } from '@/lib/session-payload';

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    coupon: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'cpn_1', ...data })),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'cpn_1', ...data })),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    offer: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'off_1', ...data })),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'off_1', ...data })),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    shift: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'shf_1', ...data })),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'shf_1', ...data })),
    },
    rentalLease: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  deleteExpiredLogs: vi.fn().mockResolvedValue(5),
  getRetentionStats: vi.fn().mockResolvedValue({ totalLogs: 10 }),
}));

vi.mock('@/lib/cache', () => ({
  invalidateCache: vi.fn(),
}));

describe('Admin Panel Phase 3 (P2 Polish) Remediation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('P2-02: Vehicle State Machine Un-retire & Lost Recovery', () => {
    it('allows valid administrative restore transitions from RETIRED', () => {
      expect(() => validateVehicleTransition('RETIRED', 'AVAILABLE')).not.toThrow();
      expect(() => validateVehicleTransition('RETIRED', 'MAINTENANCE')).not.toThrow();
    });

    it('allows valid asset recovery transitions from LOST', () => {
      expect(() => validateVehicleTransition('LOST', 'AVAILABLE')).not.toThrow();
      expect(() => validateVehicleTransition('LOST', 'MAINTENANCE')).not.toThrow();
      expect(() => validateVehicleTransition('LOST', 'RETIRED')).not.toThrow();
    });

    it('rejects invalid transitions from RETIRED to ACTIVE_RENTAL directly', () => {
      expect(() => validateVehicleTransition('RETIRED', 'ACTIVE_RENTAL')).toThrow();
    });
  });

  describe('P2-04: Shift Validation & Lease Guards', () => {
    it('rejects invalid shift part when start time and end time are identical', async () => {
      await expect(
        shiftUseCases.createShift(
          {
            name: 'Broken Shift',
            parts: [{ startTime: '18:00', endTime: '18:00' }],
          },
          'admin_1'
        )
      ).rejects.toThrow('Invalid shift part');
    });

    it('blocks shift deletion when active leases exist', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.rentalLease.count).mockResolvedValueOnce(3);

      await expect(shiftUseCases.deleteShift('shf_active', 'admin_1')).rejects.toThrow(
        /Cannot delete shift.*3 active or booked/
      );
    });

    it('allows shift deletion when no active leases exist', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.rentalLease.count).mockResolvedValueOnce(0);

      const result = await shiftUseCases.deleteShift('shf_idle', 'admin_1');
      expect(result).toBeDefined();
    });
  });

  describe('P2-15: Date-only Expiry Normalization to End-of-Day UTC', () => {
    it('normalizes YYYY-MM-DD validUntil in coupon creation to 23:59:59.999Z', async () => {
      const { db } = await import('@/lib/db');
      await couponUseCases.create(
        {
          code: 'FESTIVE50',
          description: '50% off',
          discountType: 'PERCENTAGE',
          discountValue: 50,
          validFrom: '2026-09-01T00:00:00.000Z',
          validUntil: '2026-09-30',
          isActive: true,
        },
        'admin_1'
      );

      const callArg = vi.mocked(db.coupon.create).mock.calls[0][0];
      const validUntil = callArg.data.validUntil as Date;
      expect(validUntil.toISOString()).toBe('2026-09-30T23:59:59.999Z');
    });

    it('normalizes YYYY-MM-DD validUntil in offer creation to 23:59:59.999Z', async () => {
      const { db } = await import('@/lib/db');
      await offerUseCases.create(
        {
          title: 'Monsoon Deal',
          validFrom: '2026-09-01T00:00:00.000Z',
          validUntil: '2026-09-15',
          isSponsored: false,
          isActive: true,
        },
        'admin_1'
      );

      const callArg = vi.mocked(db.offer.create).mock.calls[0][0];
      const validUntil = callArg.data.validUntil as Date;
      expect(validUntil.toISOString()).toBe('2026-09-15T23:59:59.999Z');
    });
  });

  describe('P2-16: Canonical Permission Verification', () => {
    const sessionWithEarnings: SessionPayload = {
      riderId: 'adm_1',
      riderDbId: 'adm_1',
      phone: '+919999999999',
      role: 'admin',
      adminRole: 'OPERATIONS_ADMIN',
      adminId: 'adm_1',
      adminPermissions: ['earnings_view'],
    };

    const sessionWithoutEarnings: SessionPayload = {
      riderId: 'adm_2',
      riderDbId: 'adm_2',
      phone: '+919999999999',
      role: 'admin',
      adminRole: 'SUPPORT_AGENT',
      adminId: 'adm_2',
      adminPermissions: [],
    };

    it('evaluates earnings_view correctly via session', () => {
      expect(hasPermission(sessionWithEarnings, 'earnings_view')).toBe(true);
      expect(hasPermission(sessionWithoutEarnings, 'earnings_view')).toBe(false);
    });

    it('evaluates audit_cleanup correctly for SUPER_ADMIN', () => {
      const superAdminSession: SessionPayload = {
        riderId: 'adm_sa',
        riderDbId: 'adm_sa',
        phone: '+919999999999',
        role: 'admin',
        adminRole: 'SUPER_ADMIN',
        adminId: 'adm_sa',
        adminPermissions: [],
      };
      expect(hasPermission(superAdminSession, 'audit_cleanup')).toBe(true);
    });
  });
});
