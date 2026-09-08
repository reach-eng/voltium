import { createAuditLog } from '@/lib/audit-log';
import { notificationService } from '@/lib/notification-service';
import { logger } from '@/lib/logger';
import { rewardRepository } from './reward.repository';

/**
 * Admin reward management.
 *
 * Unit decision (dashboard audit): `Reward.points` stores POINT COUNTS,
 * not paise — a ₹200 bonus stores 200. The redeem endpoint converts
 * ×100 → paise at payout, tier thresholds and admin "+pts" read counts,
 * and both referral writers now store counts. Do NOT store paise here:
 * paise figures read as 100× points and redeem 100× cash. If you change
 * this interpretation, change the redeem endpoint in lockstep.
 */
export const adminRewardUseCases = {
  async list(params: { search?: string | null; page: number; limit: number }) {
    const [listResult, summary] = await Promise.all([
      rewardRepository.findAllPaginated(params),
      rewardRepository.getSummary(),
    ]);
    return { ...listResult, summary };
  },

  /**
   * Manually award reward points to a rider.
   * @param data.points integer reward-point count (see module docs — NOT a
   *                    currency amount; never ×100 for paise).
   */
  async award(data: { riderDbId: string; title: string; points: number }, actorId: string) {
    const reward = await rewardRepository.create({
      rider: { connect: { id: data.riderDbId } },
      title: data.title,
      points: data.points,
    });
    createAuditLog({
      actorId,
      action: 'reward.award_manual',
      entity: 'reward',
      entityId: reward.id,
      details: { riderDbId: data.riderDbId, title: data.title, points: data.points },
    }).catch(() => {});
    notificationService
      .notifyRewardMilestone(data.riderDbId, data.points, data.title)
      .catch((e) => logger.error('Failed to notify reward', e));
    return reward;
  },

  async revoke(id: string, actorId: string) {
    const existing = await rewardRepository.findById(id);
    if (!existing) {
      throw new Error('Reward not found');
    }

    await rewardRepository.delete(id);

    await createAuditLog({
      actorId,
      action: 'reward.revoke',
      entity: 'reward',
      entityId: id,
      details: {
        riderId: existing.riderId,
        riderName: existing.rider?.fullName,
        title: existing.title,
        points: existing.points,
      },
    }).catch(() => {});
  },

  async update(id: string, data: { title?: string; points?: number }, actorId: string) {
    const existing = await rewardRepository.findById(id);
    if (!existing) throw new Error('Reward not found');

    const updated = await rewardRepository.update(id, data);
    await createAuditLog({
      actorId,
      action: 'reward.update',
      entity: 'reward',
      entityId: id,
      details: { title: data.title, points: data.points },
    }).catch(() => {});
    return updated;
  },
};
