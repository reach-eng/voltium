import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { teamLeaderRepository } from './team-leader.repository';

export const teamLeaderUseCases = {
  async list(params: {
    search?: string | null;
    isActive?: string | null;
    page: number;
    limit: number;
  }) {
    return teamLeaderRepository.findAllPaginated(params);
  },

  async create(data: Record<string, unknown>, actorId: string) {
    const teamLeader = await teamLeaderRepository.create(data);
    createAuditLog({
      actorId,
      action: 'tl.create',
      entity: 'team_leader',
      entityId: teamLeader.id,
      details: { name: data.name },
    }).catch((e) => logger.error('Audit log failed for tl.create', e));
    return teamLeader;
  },

  async update(id: string, data: Record<string, unknown>, actorId: string) {
    const teamLeader = await teamLeaderRepository.update(id, data);
    createAuditLog({
      actorId,
      action: 'tl.update',
      entity: 'team_leader',
      entityId: id,
      details: data,
    }).catch((e) => logger.error('Audit log failed for tl.update', e));
    return teamLeader;
  },

  async delete(id: string, actorId: string) {
    await teamLeaderRepository.delete(id);
    createAuditLog({ actorId, action: 'tl.delete', entity: 'team_leader', entityId: id }).catch(
      (e) => logger.error('Audit log failed for tl.delete', e)
    );
  },

  async bulkActivate(ids: string[], actorId: string) {
    const count = await teamLeaderRepository.bulkActivate(ids);
    createAuditLog({
      actorId,
      action: 'team_leader.bulk_activate',
      entity: 'team_leader',
      entityId: 'multiple',
      details: { ids, count },
    }).catch((e) => logger.error('Audit log failed for team_leader.bulk_activate', e));
    return count;
  },

  async bulkDeactivate(ids: string[], actorId: string) {
    const count = await teamLeaderRepository.bulkDeactivate(ids);
    createAuditLog({
      actorId,
      action: 'team_leader.bulk_deactivate',
      entity: 'team_leader',
      entityId: 'multiple',
      details: { ids, count },
    }).catch((e) => logger.error('Audit log failed for team_leader.bulk_deactivate', e));
    return count;
  },

  async bulkDelete(ids: string[], actorId: string) {
    const count = await teamLeaderRepository.bulkDelete(ids);
    createAuditLog({
      actorId,
      action: 'team_leader.bulk_delete',
      entity: 'team_leader',
      entityId: 'multiple',
      details: { ids, count },
    }).catch((e) => logger.error('Audit log failed for team_leader.bulk_delete', e));
    return count;
  },
};
