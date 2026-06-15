import { createAuditLog } from '@/lib/audit-log';
import { notificationService } from '@/lib/notification-service';
import { logger } from '@/lib/logger';
import { rewardRepository } from './reward.repository';

export const rewardUseCases = {
  async list(params: { search?: string | null; page: number; limit: number }) {
    const [listResult, summary] = await Promise.all([
      rewardRepository.findAllPaginated(params),
      rewardRepository.getSummary(),
    ]);
    return { ...listResult, summary };
  },

  async award(data: { riderDbId: string; title: string; points: number }, actorId: string) {
    const reward = await rewardRepository.create({ riderId: data.riderDbId, title: data.title, points: data.points });
    createAuditLog({ actorId, action: 'reward.award_manual', entity: 'reward', entityId: reward.id, details: { riderDbId: data.riderDbId, title: data.title, points: data.points } }).catch(() => {});
    notificationService.notifyRewardMilestone(data.riderDbId, data.points, data.title).catch((e) => logger.error('Failed to notify reward', e));
    return reward;
  },
};
