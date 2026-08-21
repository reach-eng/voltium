import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vehicleUseCases } from '@/server/modules/vehicles/vehicle.use-cases';
import { transactionQuerySchema } from '@/server/modules/transactions/transaction.schemas';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    vehicle: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    rentalLease: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    admin: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation((cb) => {
      if (typeof cb === 'function') {
        const tx = {
          vehicle: { update: vi.fn() },
          rentalLease: { update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn() },
          rider: { update: vi.fn() },
          depositRecord: { update: vi.fn(), findUnique: vi.fn() },
          transaction: { update: vi.fn(), create: vi.fn() },
          fileRecord: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
          auditLog: { create: vi.fn() },
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
  AUDIT_ACTIONS: {
    ADMIN_UPDATE: 'ADMIN_UPDATE',
  },
}));

vi.mock('@/server/modules/vehicles/vehicle.repository', () => ({
  vehicleRepository: {
    findById: vi.fn(),
    update: vi.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
  },
}));

vi.mock('@/server/modules/admin/admin.repository', () => ({
  adminRepository: {
    findById: vi.fn(),
    count: vi.fn(),
    update: vi.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
  },
}));

vi.mock('@/lib/cache', () => ({
  invalidateCache: vi.fn(),
}));

vi.mock('@/lib/server-cache', () => ({
  invalidateVehicleCache: vi.fn(),
  invalidateRiderCache: vi.fn(),
}));

describe('Admin Panel Batch B Remediation Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('D1-P1-01: Vehicle Retirement Soft-Delete & Open Lease Guards', () => {
    it('sets status RETIRED and deletedAt timestamp on retireVehicle', async () => {
      const { vehicleRepository } = await import('@/server/modules/vehicles/vehicle.repository');
      const { db } = await import('@/lib/db');

      vi.mocked(vehicleRepository.findById).mockResolvedValueOnce({
        id: 'veh_1',
        vehicleNumber: 'V-001',
        vehicleId: 'VF001',
      } as any);
      vi.mocked(db.rentalLease.findFirst).mockResolvedValueOnce(null);

      const result = await vehicleUseCases.retireVehicle('veh_1', 'admin_1');

      expect(result.status).toBe('RETIRED');
      expect(result.deletedAt).toBeInstanceOf(Date);
      expect(vehicleRepository.update).toHaveBeenCalledWith(
        'veh_1',
        expect.objectContaining({
          status: 'RETIRED',
          deletedAt: expect.any(Date),
        })
      );
    });

    it('blocks retirement if vehicle has an OVERDUE or RETURN_PENDING lease', async () => {
      const { vehicleRepository } = await import('@/server/modules/vehicles/vehicle.repository');
      const { db } = await import('@/lib/db');

      vi.mocked(vehicleRepository.findById).mockResolvedValueOnce({
        id: 'veh_2',
        vehicleNumber: 'V-002',
        vehicleId: 'VF002',
      } as any);
      vi.mocked(db.rentalLease.findFirst).mockResolvedValueOnce({
        id: 'lease_overdue',
        status: 'OVERDUE',
      } as any);

      await expect(vehicleUseCases.retireVehicle('veh_2', 'admin_1')).rejects.toThrow(
        'VEHICLE_HAS_ACTIVE_LEASE'
      );
    });
  });

  describe('D3-P1-01: Transaction Query Schema with Purpose and Audience', () => {
    it('successfully parses purpose and audience parameters', () => {
      const parsed = transactionQuerySchema.parse({
        purpose: 'SECURITY_DEPOSIT',
        audience: 'USER',
        page: '2',
        limit: '50',
      });

      expect(parsed.purpose).toBe('SECURITY_DEPOSIT');
      expect(parsed.audience).toBe('USER');
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(50);
    });
  });

  describe('D4-P2-01: Last Active SUPER_ADMIN Protection in updateAdmin', () => {
    it('prevents deactivating the last active SUPER_ADMIN', async () => {
      const { adminRepository } = await import('@/server/modules/admin/admin.repository');

      vi.mocked(adminRepository.findById).mockResolvedValueOnce({
        id: 'admin_super_1',
        email: 'super@voltium.in',
        role: 'SUPER_ADMIN',
        isActive: true,
      } as any);
      vi.mocked(adminRepository.count).mockResolvedValueOnce(1);

      await expect(
        adminUseCases.updateAdmin('admin_super_1', { isActive: false }, 'admin_actor')
      ).rejects.toThrow(/Cannot deactivate or demote the last active SUPER_ADMIN/);
    });

    it('prevents demoting the last active SUPER_ADMIN to another role', async () => {
      const { adminRepository } = await import('@/server/modules/admin/admin.repository');

      vi.mocked(adminRepository.findById).mockResolvedValueOnce({
        id: 'admin_super_1',
        email: 'super@voltium.in',
        role: 'SUPER_ADMIN',
        isActive: true,
      } as any);
      vi.mocked(adminRepository.count).mockResolvedValueOnce(1);

      await expect(
        adminUseCases.updateAdmin(
          'admin_super_1',
          { role: 'OPERATIONS_ADMIN' as any },
          'admin_actor'
        )
      ).rejects.toThrow(/Cannot deactivate or demote the last active SUPER_ADMIN/);
    });
  });
});
