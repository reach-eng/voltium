import { describe, it, expect, vi, beforeEach } from 'vitest';
import { teamLeaderUseCases } from '../../src/server/modules/team-leaders/team-leader.use-cases';
import { teamLeaderRepository } from '../../src/server/modules/team-leaders/team-leader.repository';
import * as auditLog from '../../src/lib/audit-log';
import { db } from '../../src/lib/db';

vi.mock('../../src/server/modules/team-leaders/team-leader.repository');
vi.mock('../../src/lib/audit-log');
vi.mock('../../src/lib/db', () => ({
  db: {
    $transaction: vi.fn(async (cb) => {
      return cb({ teamLeader: { update: vi.fn().mockResolvedValue({}) } });
    }),
    teamLeader: {
      update: vi.fn(),
    }
  }
}));
vi.mock('../../src/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() }
}));

describe('Team Leader Soft Delete & Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('update() captures before and after states for audit diffs', async () => {
    const mockBefore = { id: 'tl-1', name: 'Old', isActive: true };
    const mockAfter = { id: 'tl-1', name: 'New', isActive: true };
    
    vi.mocked(teamLeaderRepository.findById).mockResolvedValue(mockBefore as any);
    vi.mocked(teamLeaderRepository.update).mockResolvedValue(mockAfter as any);
    vi.mocked(auditLog.createAuditLog).mockResolvedValue(null as any);

    await teamLeaderUseCases.update('tl-1', { name: 'New' }, 'admin-1');

    expect(teamLeaderRepository.findById).toHaveBeenCalledWith('tl-1');
    expect(auditLog.createAuditLog).toHaveBeenCalledWith({
      actorId: 'admin-1',
      action: 'tl.update',
      entity: 'team_leader',
      entityId: 'tl-1',
      details: { before: mockBefore, after: mockAfter },
    });
  });

  it('delete() calls soft delete logic in repository and logs correctly', async () => {
    vi.mocked(teamLeaderRepository.delete).mockResolvedValue({} as any);
    vi.mocked(auditLog.createAuditLog).mockResolvedValue(null as any);

    await teamLeaderUseCases.delete('tl-1', 'admin-1');

    expect(teamLeaderRepository.delete).toHaveBeenCalledWith('tl-1');
    expect(auditLog.createAuditLog).toHaveBeenCalledWith({
      actorId: 'admin-1',
      action: 'tl.delete',
      entity: 'team_leader',
      entityId: 'tl-1',
      details: undefined,
    });
  });

  it('bulkDelete() acts on multiple items and logs them', async () => {
    // ADMIN_TEAM_LEADERS_AUDIT_2026-08-24 P1-1: the use case reads
    // previousStates via findIsActiveByIds before the mutation. Mock it
    // so the test doesn't crash on an undefined value.
    vi.mocked(teamLeaderRepository.findIsActiveByIds).mockResolvedValue([
      { id: 'tl-1', isActive: true },
      { id: 'tl-2', isActive: false },
    ]);
    vi.mocked(teamLeaderRepository.bulkDelete).mockResolvedValue(2);
    vi.mocked(auditLog.createAuditLog).mockResolvedValue(null as any);

    await teamLeaderUseCases.bulkDelete(['tl-1', 'tl-2'], 'admin-1');

    expect(teamLeaderRepository.bulkDelete).toHaveBeenCalledWith(['tl-1', 'tl-2']);
    expect(auditLog.createAuditLog).toHaveBeenCalledWith({
      actorId: 'admin-1',
      action: 'team_leader.bulk_delete',
      entity: 'team_leader',
      entityId: 'multiple',
      details: {
        ids: ['tl-1', 'tl-2'],
        count: 2,
        previousStates: { 'tl-1': true, 'tl-2': false },
      },
    });
  });
});
