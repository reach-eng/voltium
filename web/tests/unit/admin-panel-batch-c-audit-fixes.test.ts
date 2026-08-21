import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vehicleRepository } from '@/server/modules/vehicles/vehicle.repository';
import { shiftUseCases } from '@/server/modules/shifts/shift.use-cases';
import { supportUseCases } from '@/server/modules/support/support.use-cases';
import { offerUseCases } from '@/server/modules/offers/offer.use-cases';
import { invalidateCache } from '@/lib/cache';

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    vehicle: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    rentalLease: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    shift: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'shift_1', ...data })),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'shift_1', ...data })),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    supportTicket: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockImplementation(({ where }) => {
        if (where?.status === 'OPEN') return Promise.resolve(2);
        if (where?.status === 'IN_PROGRESS') return Promise.resolve(3);
        if (where?.status === 'WAITING_ON_RIDER') return Promise.resolve(1);
        if (where?.status === 'RESOLVED') return Promise.resolve(4);
        if (where?.status === 'CLOSED') return Promise.resolve(5);
        return Promise.resolve(15);
      }),
    },
    offer: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'offer_1', ...data })),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'offer_1', ...data })),
      delete: vi.fn().mockResolvedValue({ id: 'offer_1' }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn().mockImplementation((cb) => {
      if (typeof cb === 'function') {
        const tx = {
          vehicle: { update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn() },
          rentalLease: { update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn() },
          rider: { update: vi.fn() },
        };
        return cb(tx);
      }
      return Promise.all(cb);
    }),
  },
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  logAdminAction: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {},
}));

vi.mock('@/lib/server-cache', () => ({
  invalidateVehicleCache: vi.fn(),
  invalidateRiderCache: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
  invalidateCache: vi.fn(),
}));

describe('Admin Panel Batch C Remediation Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('D1-P1-02: Vehicle Bulk Deletion Open Lease Guards', () => {
    it('blocks bulk deletion when vehicles have OVERDUE, PICKUP_SCHEDULED, or SUSPENDED leases', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.rentalLease.count).mockResolvedValueOnce(2);

      await expect(vehicleRepository.bulkDelete(['veh_1', 'veh_2'])).rejects.toThrow(
        'Cannot delete vehicles: 2 vehicle(s) currently have active or booked rental leases'
      );

      expect(db.rentalLease.count).toHaveBeenCalledWith({
        where: {
          vehicleId: { in: ['veh_1', 'veh_2'] },
          status: {
            in: ['BOOKED', 'PICKUP_SCHEDULED', 'ACTIVE', 'OVERDUE', 'RETURN_PENDING', 'SUSPENDED'],
          },
        },
      });
    });
  });

  describe('D1-P2-01: Multi-Part Cross-Midnight Shift End-Time Derivation', () => {
    it('correctly calculates latestEnd for overnight split shifts', async () => {
      const { db } = await import('@/lib/db');

      const result = await shiftUseCases.createShift(
        {
          name: 'Night Delivery',
          hubId: 'hub_1',
          startTime: '18:00',
          endTime: '04:00',
          parts: [
            { startTime: '18:00', endTime: '23:00' },
            { startTime: '23:00', endTime: '04:00' },
          ],
        },
        'admin_1'
      );

      expect(result.startTime).toBe('18:00');
      expect(result.endTime).toBe('04:00');
    });
  });

  describe('D3-P2-01: Support Tickets Status Counts with WAITING_ON_RIDER', () => {
    it('accurately counts and aggregates WAITING_ON_RIDER tickets in statusCounts', async () => {
      const result = await supportUseCases.getAdminTickets({ page: 1, limit: 20 });

      expect(result.statusCounts).toEqual({
        all: 15, // 2 + 3 + 1 + 4 + 5
        OPEN: 2,
        IN_PROGRESS: 3,
        WAITING_ON_RIDER: 1,
        RESOLVED: 4,
        CLOSED: 5,
      });
    });
  });

  describe('D4-P2-01: Offer Cache Invalidation', () => {
    it('invalidates admin:offers:* cache pattern on create, update, and delete', async () => {
      await offerUseCases.create(
        {
          title: 'Festival Offer',
          validFrom: '2026-08-01',
          validUntil: '2026-08-31',
          isSponsored: false,
          isActive: true,
        },
        'admin_1'
      );
      expect(invalidateCache).toHaveBeenCalledWith('admin:offers:*');

      await offerUseCases.update('offer_1', { title: 'Updated Festival Offer' }, 'admin_1');
      expect(invalidateCache).toHaveBeenCalledWith('admin:offers:*');

      await offerUseCases.delete('offer_1', 'admin_1');
      expect(invalidateCache).toHaveBeenCalledWith('admin:offers:*');
    });
  });
});
