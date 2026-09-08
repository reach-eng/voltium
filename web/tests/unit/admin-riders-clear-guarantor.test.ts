import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  guarantorDeleteMany: vi.fn(),
  guarantorUpsert: vi.fn(),
  guarantorFindUnique: vi.fn(),
  getCachedRider: vi.fn((id, fn) => fn()),
  invalidateRiderCache: vi.fn(),
  invalidateCache: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    guarantor: {
      findUnique: mocks.guarantorFindUnique,
      deleteMany: mocks.guarantorDeleteMany,
      upsert: mocks.guarantorUpsert,
    },
    $transaction: vi.fn(async (fn) =>
      fn({
        rider: {
          update: mocks.update,
          findUnique: mocks.findUnique,
        },
        guarantor: {
          findUnique: mocks.guarantorFindUnique,
          deleteMany: mocks.guarantorDeleteMany,
          upsert: mocks.guarantorUpsert,
        },
        kycProfile: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        wallet: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'w1', balanceInPaise: 0 }),
        },
      })
    ),
  },
}));

vi.mock('@/lib/server-cache', () => ({
  getCachedRider: mocks.getCachedRider,
  invalidateRiderCache: mocks.invalidateRiderCache,
  invalidateRiderPhoneCache: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
  invalidateCache: mocks.invalidateCache,
  getCachedResponse: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock('@/lib/get-session', () => ({
  getAdminSession: mocks.requireAdmin,
}));

vi.mock('@/lib/permissions', () => ({
  hasPermission: mocks.hasPermission,
}));

import { updateRiderSchema } from '@/app/api/admin/riders/route';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';
import { PUT as updateRiderRoute } from '@/app/api/admin/riders/route';

describe('P0-2: Clear Guarantor Schema & Use-Case Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateRiderSchema nullish acceptance (P0-2)', () => {
    it('accepts guarantorStatus: null and guarantorStatus: ""', () => {
      const nullResult = updateRiderSchema.safeParse({
        id: 'rider-1',
        guarantorStatus: null,
      });
      expect(nullResult.success).toBe(true);

      const emptyResult = updateRiderSchema.safeParse({
        id: 'rider-1',
        guarantorStatus: '',
      });
      expect(emptyResult.success).toBe(true);
    });

    it('accepts the exact Clear Guarantor wire payload sent by useRiders.ts', () => {
      const clearPayload = {
        id: 'rider-1',
        guarantorName: null,
        guarantorRelation: null,
        guarantorPhone: null,
        guarantorDob: null,
        guarantorStatus: null,
        guarantorAadhaarFront: null,
        guarantorAadhaarBack: null,
        guarantorPan: null,
        guarantorVideo: null,
        guarantorSignature: null,
      };

      const result = updateRiderSchema.safeParse(clearPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.guarantorStatus).toBeNull();
        expect(result.data.guarantorName).toBeNull();
        expect(result.data.guarantorPhone).toBeNull();
      }
    });
  });

  describe('adminRiderUseCases.update - Clear Guarantor vs Partial Upsert', () => {
    it('deletes guarantor row via deleteMany and skips state-machine check when all guarantor fields are null', async () => {
      // Initial fetch of existing rider with an approved guarantor
      mocks.findUnique.mockResolvedValueOnce({
        id: 'rider-1',
        riderId: 'VF-RD-001',
        serialNumber: 1,
        phone: '9999999999',
        lifecycleStatus: 'ACTIVE',
        guarantor: {
          id: 'g-1',
          status: 'APPROVED',
          name: 'Old Guarantor',
          phone: '9888888888',
        },
      });
      // Post-transaction fetch after deleteMany: guarantor is now null
      mocks.findUnique.mockResolvedValueOnce({
        id: 'rider-1',
        riderId: 'VF-RD-001',
        serialNumber: 1,
        phone: '9999999999',
        lifecycleStatus: 'ACTIVE',
        guarantor: null,
      });
      mocks.guarantorDeleteMany.mockResolvedValue({ count: 1 });

      const clearData = {
        guarantorName: null,
        guarantorRelation: null,
        guarantorPhone: null,
        guarantorDob: null,
        guarantorStatus: null,
        guarantorAadhaarFront: null,
        guarantorAadhaarBack: null,
        guarantorPan: null,
        guarantorVideo: null,
        guarantorSignature: null,
      };

      const result = await adminRiderUseCases.update('rider-1', clearData, {
        actorId: 'admin-1',
        actorRole: 'OPERATIONS_ADMIN',
      });

      expect(mocks.guarantorDeleteMany).toHaveBeenCalledWith({
        where: { riderId: 'rider-1' },
      });
      expect(mocks.guarantorUpsert).not.toHaveBeenCalled();
      // Verifies the returned flattened rider has null guarantor fields and default status
      expect(result.guarantorStatus).toBe('PENDING');
      expect(result.guarantorName).toBeNull();
      expect(result.guarantorPhone).toBeNull();
    });

    it('upserts guarantor when partial non-null guarantor data is provided', async () => {
      mocks.findUnique.mockResolvedValue({
        id: 'rider-2',
        riderId: 'VF-RD-002',
        serialNumber: 2,
        phone: '9999999999',
        lifecycleStatus: 'ACTIVE',
        guarantor: null,
      });
      mocks.guarantorUpsert.mockResolvedValue({
        id: 'g-2',
        riderId: 'rider-2',
        phone: '9876543210',
        name: 'New Contact',
        status: 'SUBMITTED',
      });
      mocks.guarantorFindUnique.mockResolvedValue(null);

      const partialData = {
        guarantorPhone: '9876543210',
        guarantorName: 'New Contact',
      };

      await adminRiderUseCases.update('rider-2', partialData, {
        actorId: 'admin-1',
        actorRole: 'OPERATIONS_ADMIN',
      });

      expect(mocks.guarantorDeleteMany).not.toHaveBeenCalled();
      expect(mocks.guarantorUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { riderId: 'rider-2' },
          update: expect.objectContaining({
            phone: '9876543210',
            name: 'New Contact',
          }),
          create: expect.objectContaining({
            riderId: 'rider-2',
            phone: '9876543210',
            name: 'New Contact',
          }),
        })
      );
    });
  });

  describe('PUT /api/admin/riders route integration', () => {
    it('returns 200 OK for full-null Clear Guarantor request', async () => {
      mocks.requireAdmin.mockResolvedValue({
        adminId: 'admin-ops',
        adminRole: 'OPERATIONS_ADMIN',
      });
      mocks.hasPermission.mockReturnValue(true);
      mocks.findUnique.mockResolvedValue({
        id: 'rider-1',
        riderId: 'VF-RD-001',
        serialNumber: 1,
        phone: '9999999999',
        lifecycleStatus: 'ACTIVE',
        guarantor: null,
      });
      mocks.guarantorDeleteMany.mockResolvedValue({ count: 1 });

      const req = new NextRequest('http://localhost/api/admin/riders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'rider-1',
          guarantorName: null,
          guarantorRelation: null,
          guarantorPhone: null,
          guarantorDob: null,
          guarantorStatus: null,
          guarantorAadhaarFront: null,
          guarantorAadhaarBack: null,
          guarantorPan: null,
          guarantorVideo: null,
          guarantorSignature: null,
        }),
      });

      const res = await updateRiderRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mocks.guarantorDeleteMany).toHaveBeenCalledWith({
        where: { riderId: 'rider-1' },
      });
    });
  });
});
