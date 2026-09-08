import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
  findById: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock('@/server/modules/team-leaders/team-leader.repository', () => ({
  teamLeaderRepository: {
    findById: mocks.findById,
    update: mocks.update,
  },
}));

import { teamLeaderUseCases } from '@/server/modules/team-leaders/team-leader.use-cases';

describe('P1-3: Team Leader Audit Log Changed-Fields Diff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs only changed fields rather than entire row snapshot', async () => {
    mocks.findById.mockResolvedValue({
      id: 'tl_1',
      name: 'Old Name',
      phone: '9876543210',
      email: 'old@example.com',
      hubId: 'hub_1',
      isActive: true,
    });
    mocks.update.mockResolvedValue({
      id: 'tl_1',
      name: 'New Name',
      phone: '9876543210',
      email: 'old@example.com',
      hubId: 'hub_1',
      isActive: true,
    });

    await teamLeaderUseCases.update('tl_1', { name: 'New Name' }, 'admin_1');

    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tl.update',
        entityId: 'tl_1',
        details: {
          changedFields: ['name'],
          before: { name: 'Old Name' },
          after: { name: 'New Name' },
        },
      })
    );
  });
});
