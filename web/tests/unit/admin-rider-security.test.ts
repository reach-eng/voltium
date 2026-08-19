import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  transaction: vi.fn(),
  getCachedRider: vi.fn((id, fn) => fn()),
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock('@/lib/server-cache', () => ({
  getCachedRider: mocks.getCachedRider,
  invalidateRiderCache: vi.fn(),
}));

describe('Admin Rider Security - Wallet mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects direct walletBalance updates via admin update', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'r1', riderId: 'VF-RD-123', serialNumber: 1 });
    
    await expect(
      adminRiderUseCases.update('r1', { walletBalance: 500 }, { actorId: 'a1', actorRole: 'ADMIN' })
    ).rejects.toThrow('Direct walletBalance mutations are blocked — use Wallet Adjust API');
  });

  it('allows safe rider field updates', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'r1', riderId: 'VF-RD-123', serialNumber: 1 });
    mocks.transaction.mockResolvedValue({ id: 'r1', fullName: 'Test' });

    const result = await adminRiderUseCases.update('r1', { fullName: 'Test Rider' }, { actorId: 'a1', actorRole: 'ADMIN' });
    expect(mocks.transaction).toHaveBeenCalled();
  });
});
