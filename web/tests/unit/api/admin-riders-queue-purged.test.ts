import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

// PR-2026-08-16: purgedAt marker. data-deletion-purge.job.ts sets it once
// the 7-day appeal window passes and PII is destroyed. The admin queue
// (GET /api/admin/riders?deleted=true → adminRiderUseCases.list) must carry
// purgedAt through to the payload so the UI can distinguish a "purged" rider
// (purgedAt set — no restore) from a "pending 7-day window" rider
// (deletedAt set, purgedAt null — still restorable).

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// list() signs photo URLs via the storage provider; a null provider is a
// valid no-op path in signRiderUrlsWithProvider, keeping the test pure.
vi.mock('@/lib/storage', () => ({
  getStorageProvider: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const pendingRider = {
  id: 'rider-pending',
  riderId: 'R0001',
  fullName: 'Pending Rider',
  phone: '9000000001',
  lifecycleStatus: 'CLOSED',
  deletedAt: '2026-08-10T00:00:00.000Z',
  purgedAt: null,
  kycProfile: null,
  wallet: null,
  guarantor: null,
  vehicleReturns: [],
  createdAt: new Date('2026-08-10T00:00:00.000Z'),
  updatedAt: new Date('2026-08-10T00:00:00.000Z'),
};

const purgedRider = {
  id: 'rider-purged',
  riderId: 'R0002',
  fullName: '[PURGED]',
  phone: 'PURGED-abcd1234',
  lifecycleStatus: 'CLOSED',
  deletedAt: '2026-08-01T00:00:00.000Z',
  purgedAt: '2026-08-08T00:00:00.000Z',
  kycProfile: null,
  wallet: null,
  guarantor: null,
  vehicleReturns: [],
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-08T00:00:00.000Z'),
};

describe('adminRiderUseCases.list — data-deletion queue (purged vs pending)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects purgedAt so the queue payload can distinguish purged riders', async () => {
    vi.mocked(db.rider.findMany).mockResolvedValue([
      pendingRider,
      purgedRider,
    ] as any);
    vi.mocked(db.rider.count).mockResolvedValue(2);

    const result = await adminRiderUseCases.list({
      search: '',
      state: '',
      kycStatus: '',
      startDate: '',
      endDate: '',
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
      deleted: true,
    });

    // The query must carry the deletion markers into the select.
    const select = (vi.mocked(db.rider.findMany).mock.calls[0][0] as any).select;
    expect(select.deletedAt).toBe(true);
    expect(select.purgedAt).toBe(true);

    // Both rows reach the payload; purgedAt distinguishes them.
    expect(result.riders).toHaveLength(2);
    const pending = result.riders.find((r: any) => r.id === 'rider-pending');
    const purged = result.riders.find((r: any) => r.id === 'rider-purged');

    expect(pending.purgedAt).toBeNull();
    expect(pending.deletedAt).toBe('2026-08-10T00:00:00.000Z');

    expect(purged.purgedAt).toBe('2026-08-08T00:00:00.000Z');
    expect(purged.deletedAt).toBe('2026-08-01T00:00:00.000Z');
    expect(purged.fullName).toBe('[PURGED]');
  });

  it('filters to soft-deleted riders only when deleted=true', async () => {
    vi.mocked(db.rider.findMany).mockResolvedValue([purgedRider] as any);
    vi.mocked(db.rider.count).mockResolvedValue(1);

    await adminRiderUseCases.list({
      deleted: true,
    } as any);

    const where = (vi.mocked(db.rider.findMany).mock.calls[0][0] as any).where;
    expect(where.deletedAt).toEqual({ not: null });
  });
});
