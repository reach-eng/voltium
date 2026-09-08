/**
 * Unit tests for backfill-kyc-approval-lock-expiry.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findCandidates, applyBackfill } from '@/../scripts/backfill-kyc-approval-lock-expiry';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  invalidateRiderCache: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    kycProfile: {
      findMany: mocks.findMany,
      update: mocks.update,
    },
  },
}));

vi.mock('@/lib/server-cache', () => ({
  invalidateRiderCache: mocks.invalidateRiderCache,
}));

describe('backfill-kyc-approval-lock-expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findCandidates', () => {
    it('identifies rows missing expiresAt', async () => {
      const updatedAt = new Date('2026-08-01T12:00:00Z');
      const kycDoneAt = new Date('2026-08-01T10:00:00Z');

      mocks.findMany.mockResolvedValue([
        {
          id: 'kp1',
          riderId: 'r1',
          status: 'APPROVED',
          editableFields: [],
          expiresAt: null,
          updatedAt,
          rider: { id: 'r1', riderId: 'VF-RD-001', kycDoneAt },
        },
      ]);

      const { totalApproved, candidates } = await findCandidates();

      expect(totalApproved).toBe(1);
      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toMatchObject({
        id: 'kp1',
        riderDbId: 'r1',
        riderCode: 'VF-RD-001',
        missingExpiry: true,
        unlockedFields: false,
      });

      // Expected expiry is kycDoneAt + 365 days
      const expectedExpiry = new Date(kycDoneAt.getTime() + 365 * 24 * 60 * 60 * 1000);
      expect(candidates[0].calculatedExpiresAt.toISOString()).toBe(expectedExpiry.toISOString());
    });

    it('identifies rows with non-empty editableFields', async () => {
      const updatedAt = new Date('2026-08-01T12:00:00Z');
      const existingExpiresAt = new Date('2027-08-01T12:00:00Z');

      mocks.findMany.mockResolvedValue([
        {
          id: 'kp2',
          riderId: 'r2',
          status: 'APPROVED',
          editableFields: ['profilePhoto', 'dob'],
          expiresAt: existingExpiresAt,
          updatedAt,
          rider: { id: 'r2', riderId: 'VF-RD-002', kycDoneAt: null },
        },
      ]);

      const { totalApproved, candidates } = await findCandidates();

      expect(totalApproved).toBe(1);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].unlockedFields).toBe(true);
      expect(candidates[0].missingExpiry).toBe(false);

      // When kycDoneAt is null, falls back to updatedAt
      const expectedExpiry = new Date(updatedAt.getTime() + 365 * 24 * 60 * 60 * 1000);
      expect(candidates[0].calculatedExpiresAt.toISOString()).toBe(expectedExpiry.toISOString());
    });

    it('ignores already backfilled / compliant rows', async () => {
      mocks.findMany.mockResolvedValue([
        {
          id: 'kp3',
          riderId: 'r3',
          status: 'APPROVED',
          editableFields: [],
          expiresAt: new Date('2027-09-01T00:00:00Z'),
          updatedAt: new Date('2026-09-01T00:00:00Z'),
          rider: { id: 'r3', riderId: 'VF-RD-003', kycDoneAt: new Date('2026-09-01T00:00:00Z') },
        },
      ]);

      const { totalApproved, candidates } = await findCandidates();

      expect(totalApproved).toBe(1);
      expect(candidates).toHaveLength(0);
    });
  });

  describe('applyBackfill', () => {
    it('updates candidates and invalidates rider cache', async () => {
      const targetDate = new Date('2027-08-01T10:00:00Z');
      mocks.update.mockResolvedValue({});

      const candidates = [
        {
          id: 'kp1',
          riderDbId: 'r1',
          riderCode: 'VF-RD-001',
          currentExpiresAt: null,
          currentEditableFields: null,
          calculatedExpiresAt: targetDate,
          missingExpiry: true,
          unlockedFields: true,
        },
      ];

      const { updated, errors } = await applyBackfill(candidates);

      expect(updated).toBe(1);
      expect(errors).toHaveLength(0);
      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: 'kp1' },
        data: {
          editableFields: [],
          expiresAt: targetDate,
        },
      });
      expect(mocks.invalidateRiderCache).toHaveBeenCalledWith('r1');
    });

    it('captures errors per item without throwing', async () => {
      mocks.update.mockRejectedValue(new Error('DB connection reset'));

      const candidates = [
        {
          id: 'kp-fail',
          riderDbId: 'r-fail',
          riderCode: 'VF-RD-FAIL',
          currentExpiresAt: null,
          currentEditableFields: null,
          calculatedExpiresAt: new Date(),
          missingExpiry: true,
          unlockedFields: true,
        },
      ];

      const { updated, errors } = await applyBackfill(candidates);

      expect(updated).toBe(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        id: 'kp-fail',
        error: 'DB connection reset',
      });
    });
  });
});
