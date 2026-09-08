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

    const inputAsRecord = data as unknown as Record<string, unknown>;
    const isFlatDefined = (v: unknown): boolean =>
      v !== undefined &&
      (v === null ||
        typeof v === 'string' ||
        typeof v === 'number' ||
        typeof v === 'boolean');

    const changedFields = before
      ? Object.keys(inputAsRecord).filter(
          (k) =>
            isFlatDefined(inputAsRecord[k]) &&
            (before as unknown as Record<string, unknown>)[k] !== inputAsRecord[k]
        )
      : Object.keys(inputAsRecord).filter((k) => isFlatDefined(inputAsRecord[k]));

    const pick = (row: Record<string, unknown> | null | undefined, keys: string[]) => {
      if (!row) return {};
      const out: Record<string, unknown> = {};
      for (const k of keys) out[k] = row[k];
      return out;
    };

    logTlAction(actorId, 'tl.update', id, {
      changedFields,
      before: pick(before as unknown as Record<string, unknown> | null, changedFields),
      after: pick(teamLeader as unknown as Record<string, unknown>, changedFields),
    });

    return teamLeader;
  },

  async delete(id: string, actorId: string) {
    await teamLeaderRepository.delete(id);
    logTlAction(actorId, 'tl.delete', id);
  },

  async bulkActivate(ids: string[], actorId: string) {
    const count = await teamLeaderRepository.bulkActivate(ids);
    logTlAction(actorId, 'team_leader.bulk_activate', 'multiple', { ids, count });
    return count;
  },

  async bulkDeactivate(ids: string[], actorId: string) {
    const count = await teamLeaderRepository.bulkDeactivate(ids);
    logTlAction(actorId, 'team_leader.bulk_deactivate', 'multiple', { ids, count });
    return count;
  },

  async bulkDelete(ids: string[], actorId: string) {
    const count = await teamLeaderRepository.bulkDelete(ids);
    logTlAction(actorId, 'team_leader.bulk_delete', 'multiple', { ids, count });
    return count;
  },
};
