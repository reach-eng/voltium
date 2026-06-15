import { describe, it, expect, beforeEach, vi } from 'vitest';
import { softDelete, restoreSoftDelete, includeDeleted } from '@/lib/soft-delete';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';

vi.mock('@/lib/db');
vi.mock('@/lib/audit-log');

describe('Soft Delete Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('softDelete', () => {
    it('soft-deletes a rider with audit log', async () => {
      const mockRider = {
        id: 'rider_123',
        phone: '9876543210',
        deletedAt: new Date(),
        deletedBy: 'admin_1',
        deletionReason: 'Compliance deletion',
      };

      vi.mocked(db.rider.update).mockResolvedValue(mockRider);
      vi.mocked(createAuditLog).mockResolvedValue(undefined as any);

      const result = await softDelete('Rider', 'rider_123', {
        deletedBy: 'admin_1',
        reason: 'Compliance deletion',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRider);
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE',
          entity: 'Rider',
          entityId: 'rider_123',
        })
      );
    });

    it('handles unknown model gracefully', async () => {
      const result = await softDelete('UnknownModel', 'id_123', {
        deletedBy: 'admin_1',
        reason: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('creates audit log with deletion metadata', async () => {
      vi.mocked(db.rider.update).mockResolvedValue({} as any);
      vi.mocked(createAuditLog).mockResolvedValue(undefined as any);

      await softDelete('Rider', 'rider_123', {
        deletedBy: 'admin_1',
        reason: 'Compliance deletion',
        metadata: { department: 'legal' },
      });

      expect(createAuditLog).toHaveBeenCalled();
      const call = vi.mocked(createAuditLog).mock.calls[0][0];
      const details = JSON.parse(call.details || '{}');
      expect(details.metadata).toEqual({ department: 'legal' });
    });
  });

  describe('restoreSoftDelete', () => {
    it('restores a soft-deleted rider', async () => {
      const mockRider = {
        id: 'rider_123',
        phone: '9876543210',
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
      };

      vi.mocked(db.rider.update).mockResolvedValue(mockRider);
      vi.mocked(createAuditLog).mockResolvedValue(undefined as any);

      const result = await restoreSoftDelete('Rider', 'rider_123', 'admin_1');

      expect(result.success).toBe(true);
      expect(result.data?.deletedAt).toBeNull();
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RESTORE',
          entity: 'Rider',
        })
      );
    });
  });

  describe('includeDeleted helper', () => {
    it('filters out soft-deleted records by default', () => {
      const query = { where: { status: 'ACTIVE' } };
      const result = includeDeleted(query, false);

      expect(result).toEqual({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
        },
      });
    });

    it('includes soft-deleted records when flag is true', () => {
      const query = { where: { status: 'ACTIVE' } };
      const result = includeDeleted(query, true);

      expect(result).toEqual(query);
    });
  });
});
