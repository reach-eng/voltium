import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as approveRoute } from '@/app/api/admin/riders/[id]/data-deletion/approve/route';
import { POST as restoreRoute } from '@/app/api/admin/riders/[id]/data-deletion/restore/route';
import { DELETE as deleteRoute } from '@/app/api/admin/riders/[id]/data-deletion/route';
import { db } from '@/lib/db';

const mockAdminSession = { adminId: 'admin-1', role: 'admin' };

vi.mock('@/lib/rbac', () => ({
  requirePermission: vi.fn().mockImplementation(async () => mockAdminSession),
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => {
      const tx = {
        rider: { update: vi.fn() },
        deviceViolation: { deleteMany: vi.fn() },
        userCallLog: { deleteMany: vi.fn() },
        userContact: { deleteMany: vi.fn() },
        userLocation: { deleteMany: vi.fn() },
      };
      return cb(tx);
    })
  }
}));

describe('Data Deletion Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /approve', () => {
    it('generates an approval token for a valid request', async () => {
      vi.mocked(db.rider.findUnique).mockResolvedValue({ id: 'rider-1' } as any);

      const req = new NextRequest('http://localhost/api/admin/riders/rider-1/data-deletion/approve', {
        method: 'POST',
        body: JSON.stringify({ requestId: 'req-1', notes: 'OK' })
      });

      const res = await approveRoute(req, { params: Promise.resolve({ id: 'rider-1' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.approvalToken).toBeDefined();
      expect(json.data.expiresAt).toBeDefined();
    });
  });

  describe('DELETE /data-deletion', () => {
    it('rejects if executor is the requester (Two-Person rule)', async () => {
      vi.mocked(db.auditLog.findFirst).mockResolvedValue({
        details: JSON.stringify({
          approvalToken: 'token-123',
          requestedBy: 'admin-1' // Same as mockAdminSession
        })
      } as any);

      const req = new NextRequest('http://localhost/api/admin/riders/rider-1/data-deletion', {
        method: 'DELETE',
        body: JSON.stringify({ approvalToken: 'token-123' })
      });

      const res = await deleteRoute(req, { params: Promise.resolve({ id: 'rider-1' }) });
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error.message).toMatch(/Two-Person rule/);
    });

    it('performs soft deletion when executor != requester', async () => {
      vi.mocked(db.auditLog.findFirst).mockResolvedValue({
        details: JSON.stringify({
          approvalToken: 'token-123',
          requestedBy: 'admin-2' // Different from mockAdminSession
        })
      } as any);

      vi.mocked(db.rider.findUnique).mockResolvedValue({
        id: 'rider-1',
        leases: []
      } as any);

      const req = new NextRequest('http://localhost/api/admin/riders/rider-1/data-deletion', {
        method: 'DELETE',
        body: JSON.stringify({ approvalToken: 'token-123' })
      });

      const res = await deleteRoute(req, { params: Promise.resolve({ id: 'rider-1' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.message).toMatch(/soft-deleted successfully/);
      expect(db.$transaction).toHaveBeenCalled();
    });
  });

  describe('POST /restore', () => {
    it('restores a soft-deleted rider', async () => {
      vi.mocked(db.rider.findUnique).mockResolvedValue({
        id: 'rider-1',
        lifecycleStatus: 'CLOSED'
      } as any);

      const req = new NextRequest('http://localhost/api/admin/riders/rider-1/data-deletion/restore', {
        method: 'POST',
        body: JSON.stringify({ requestId: 'req-2', reason: 'mistake' })
      });

      const res = await restoreRoute(req, { params: Promise.resolve({ id: 'rider-1' }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.message).toMatch(/restored successfully/);
      expect(db.rider.update).toHaveBeenCalledWith({
        where: { id: 'rider-1' },
        data: { lifecycleStatus: 'ACTIVE', deletedAt: null } // PR-7: clear deletedAt so the soft-delete middleware stops hiding the rider
      });
    });

    it('rejects restoring a non-deleted rider', async () => {
      vi.mocked(db.rider.findUnique).mockResolvedValue({
        id: 'rider-1',
        lifecycleStatus: 'ACTIVE'
      } as any);

      const req = new NextRequest('http://localhost/api/admin/riders/rider-1/data-deletion/restore', {
        method: 'POST',
        body: JSON.stringify({ requestId: 'req-3', reason: 'mistake' })
      });

      const res = await restoreRoute(req, { params: Promise.resolve({ id: 'rider-1' }) });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.message).toMatch(/not in soft-deleted state/);
    });

    it('rejects restoring a permanently purged rider (PR-2026-08-16)', async () => {
      // purgedAt set = the purge worker destroyed the PII; restore would
      // resurrect a sentinel-phone account and is rejected to match the UI.
      vi.mocked(db.rider.findUnique).mockResolvedValue({
        id: 'rider-1',
        lifecycleStatus: 'CLOSED',
        purgedAt: new Date('2026-08-08T00:00:00Z')
      } as any);

      const req = new NextRequest('http://localhost/api/admin/riders/rider-1/data-deletion/restore', {
        method: 'POST',
        body: JSON.stringify({ requestId: 'req-4', reason: 'mistake' })
      });

      const res = await restoreRoute(req, { params: Promise.resolve({ id: 'rider-1' }) });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.message).toMatch(/permanently purged/);
      expect(db.rider.update).not.toHaveBeenCalled();
    });
  });
});

import { dataDeletionApproveSchema, dataDeletionRejectSchema } from '@/lib/validators/admin';

describe('Data Deletion Approval & Reject Schemas (PR-P / Ticket #59)', () => {
  it('validates dataDeletionApproveSchema with valid requestId', () => {
    const valid = dataDeletionApproveSchema.safeParse({
      requestId: 'req-123',
      notes: 'Approved after compliance review',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects dataDeletionApproveSchema with empty requestId', () => {
    const invalid = dataDeletionApproveSchema.safeParse({
      requestId: '',
    });
    expect(invalid.success).toBe(false);
  });

  it('validates dataDeletionRejectSchema with valid reason', () => {
    const valid = dataDeletionRejectSchema.safeParse({
      requestId: 'req-123',
      reason: 'Rider has an active lease agreement.',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects dataDeletionRejectSchema with short or missing reason', () => {
    const invalid = dataDeletionRejectSchema.safeParse({
      requestId: 'req-123',
      reason: 'No',
    });
    expect(invalid.success).toBe(false);
  });
});

