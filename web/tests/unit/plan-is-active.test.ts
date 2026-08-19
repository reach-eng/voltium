import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    rentalPlan: {
      create: vi.fn(),
    },
  },
  invalidateCache: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/lib/cache', () => ({ invalidateCache: mocks.invalidateCache }));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));

import { planUseCases } from '@/server/modules/plans/plan.use-cases';

describe('Plan Creation isActive Field Support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAuditLog.mockResolvedValue(undefined);
  });

  it('respects isActive: false when creating a draft plan', async () => {
    mocks.db.rentalPlan.create.mockImplementation(({ data }) => Promise.resolve({ id: 'plan_1', ...data }));

    const plan = await planUseCases.create(
      {
        name: 'Draft Special',
        type: 'WEEKLY',
        price: 299,
        isActive: false,
      },
      'admin_1'
    );

    expect(mocks.db.rentalPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: false,
        }),
      })
    );
    expect(plan.isActive).toBe(false);
  });
});
