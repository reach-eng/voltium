import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    rider: {
      findMany: vi.fn(),
    },
  },
  calculateRiderScore: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/lib/score-calculator', () => ({ calculateRiderScore: mocks.calculateRiderScore }));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));

import { scoreUseCases } from '@/server/modules/scores/score.use-cases';

describe('Score Recalculation Cache Bypass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAuditLog.mockResolvedValue(undefined);
  });

  it('passes forceRecalculate = true to calculateRiderScore on recalculateAll', async () => {
    mocks.db.rider.findMany.mockResolvedValue([{ id: 'r_1' }, { id: 'r_2' }]);
    mocks.calculateRiderScore.mockResolvedValue({ id: 'sc_1', compositeScore: 85, riskLevel: 'LOW' });

    const res = await scoreUseCases.recalculateAll('admin_1');
    expect(res.successCount).toBe(2);
    expect(mocks.calculateRiderScore).toHaveBeenCalledWith('r_1', true);
    expect(mocks.calculateRiderScore).toHaveBeenCalledWith('r_2', true);
  });
});
