import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { teamLeaderRepository } from './team-leader.repository';
import { Prisma } from '@prisma/client';

const logTlAction = (actorId: string, action: string, id: string, details?: Record<string, unknown>) => {
  createAuditLog({
    actorId,
    action,
    entity: 'team_leader',
    entityId: id,
    details,
  }).catch((e) => logger.error(`Audit log failed for ${action}`, e));
};

/**
 * ADMIN_TEAM_LEADERS_AUDIT_2026-08-24 P1-1: reduce the [{id, isActive}]
 * shape from `findIsActiveByIds` to a `{id: isActive}` map for the
 * audit log. The map is keyed by id so the compliance team can
 * reconstruct "before/after" from a single audit row.
 */
function previousStatesForAudit(
  rows: { id: string; isActive: boolean }[]
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const r of rows) {
    out[r.id] = r.isActive;
  }
  return out;
}

export const teamLeaderUseCases = {
  async list(params: {
    search?: string | null;
    isActive?: string | null;
    hubId?: string | null;
    page: number;
    limit: number;
  }) {
    return teamLeaderRepository.findAllPaginated(params);
  },

  async create(data: Prisma.TeamLeaderCreateInput, actorId: string) {
    const teamLeader = await teamLeaderRepository.create(data);
    logTlAction(actorId, 'tl.create', teamLeader.id, { name: data.name });
    return teamLeader;
  },

  async update(id: string, data: Prisma.TeamLeaderUpdateInput, actorId: string) {
    const before = await teamLeaderRepository.findById(id);
    const teamLeader = await teamLeaderRepository.update(id, data);
    logTlAction(actorId, 'tl.update', id, { before, after: teamLeader });
    return teamLeader;
  },

  async delete(id: string, actorId: string) {
    await teamLeaderRepository.delete(id);
    logTlAction(actorId, 'tl.delete', id);
  },

  async bulkActivate(ids: string[], actorId: string) {
    // ADMIN_TEAM_LEADERS_AUDIT_2026-08-24 P1-1: capture the previous
    // isActive value for every affected id BEFORE the mutation so
    // compliance can reconstruct "what was true before" from the
    // audit log alone. Read the rows in one query, then mutate.
    const previousStates = await teamLeaderRepository.findIsActiveByIds(ids);
    const count = await teamLeaderRepository.bulkActivate(ids);
    logTlAction(actorId, 'team_leader.bulk_activate', 'multiple', {
      ids,
      count,
      previousStates: previousStatesForAudit(previousStates),
    });
    return count;
  },

  async bulkDeactivate(ids: string[], actorId: string) {
    const previousStates = await teamLeaderRepository.findIsActiveByIds(ids);
    const count = await teamLeaderRepository.bulkDeactivate(ids);
    logTlAction(actorId, 'team_leader.bulk_deactivate', 'multiple', {
      ids,
      count,
      previousStates: previousStatesForAudit(previousStates),
    });
    return count;
  },

  async bulkDelete(ids: string[], actorId: string) {
    const previousStates = await teamLeaderRepository.findIsActiveByIds(ids);
    const count = await teamLeaderRepository.bulkDelete(ids);
    logTlAction(actorId, 'team_leader.bulk_delete', 'multiple', {
      ids,
      count,
      previousStates: previousStatesForAudit(previousStates),
    });
    return count;
  },
};
