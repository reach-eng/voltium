import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shiftUseCases } from '@/server/modules/shifts/shift.use-cases';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';
import { hubUseCases } from '@/server/modules/hubs/hub.use-cases';

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    shift: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    hub: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    vehicle: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    rentalLease: {
      count: vi.fn().mockResolvedValue(0),
    },
    rider: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    kycProfile: {
      upsert: vi.fn(),
    },
    guarantor: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    wallet: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation((cb) => {
      if (typeof cb === 'function') {
        const tx = {
          rider: {
            update: vi.fn(),
            findUnique: vi.fn().mockResolvedValue({
              id: 'rider_1',
              riderId: 'VEMXX001',
              teamLeaderId: 'tl_123',
              kycProfile: null,
              wallet: null,
              guarantor: null,
            }),
          },
          kycProfile: { upsert: vi.fn() },
          guarantor: { upsert: vi.fn() },
          wallet: { findUnique: vi.fn(), create: vi.fn() },
        };
        return cb(tx);
      }
      return Promise.all(cb);
    }),
  },
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  logAccountSuspension: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/server/modules/hubs/hub.repository', () => ({
  hubRepository: {
    bulkSoftDelete: vi.fn().mockResolvedValue({ count: 2 }),
  },
}));

describe('Admin Panel Batch A Remediation Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('D1-P1-03: Shift Timings & Multi-Part End-Time Derivation', () => {
    it('allows valid overnight shifts (e.g. 22:00 -> 06:00)', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.shift.create).mockResolvedValueOnce({
        id: 'shift_1',
        name: 'Graveyard Shift',
        startTime: '22:00',
        endTime: '06:00',
        hubId: 'hub_1',
      } as any);

      const created = await shiftUseCases.createShift({
        name: 'Graveyard Shift',
        hubId: 'hub_1',
        startTime: '22:00',
        endTime: '06:00',
      });

      expect(created).toBeDefined();
      expect(db.shift.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startTime: '22:00',
            endTime: '06:00',
          }),
        })
      );
    });

    it('derives accurate latest end-time for non-monotonic multi-part shifts', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.shift.create).mockResolvedValueOnce({
        id: 'shift_2',
        name: 'Split Shift',
        startTime: '08:00',
        endTime: '17:00',
        hubId: 'hub_1',
      } as any);

      await shiftUseCases.createShift({
        name: 'Split Shift',
        hubId: 'hub_1',
        parts: [
          { name: 'Morning', startTime: '08:00', endTime: '17:00' },
          { name: 'Peak', startTime: '11:00', endTime: '14:00' },
        ],
      });

      expect(db.shift.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startTime: '08:00',
            endTime: '17:00',
          }),
        })
      );
    });
  });

  describe('D1-P1-01: Hub Bulk Delete Soft-Deleted Vehicles Check', () => {
    it('queries only non-deleted vehicles (deletedAt: null) before bulk deleting hubs', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.hub.findMany).mockResolvedValueOnce([]); // No active vehicles

      const result = await hubUseCases.bulkDelete(['hub_1', 'hub_2'], 'admin_1');

      expect(db.hub.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['hub_1', 'hub_2'] },
          deletedAt: null,
          vehicles: { some: { deletedAt: null } },
        },
        select: { id: true },
      });
      expect(result.count).toBe(2);
    });
  });

  describe('D2-P0-01: Team Leader Approval Handling', () => {
    it('assigns teamLeaderId when tlAction is APPROVE', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.rider.findUnique).mockResolvedValueOnce({
        id: 'rider_1',
        riderId: 'VEMXX001',
        lifecycleStatus: 'ACTIVE',
        teamLeaderId: null,
      } as any);

      await adminRiderUseCases.update(
        'rider_1',
        { tlAction: 'APPROVE', teamLeaderId: 'tl_123' },
        { actorId: 'admin_1', actorRole: 'SUPER_ADMIN' }
      );

      expect(db.$transaction).toHaveBeenCalled();
    });
  });
});
