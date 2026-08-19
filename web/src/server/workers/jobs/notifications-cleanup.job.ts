import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { istDateKey } from '@/lib/date-keys';
import { checkOrClaimIdempotency, completeIdempotency, failIdempotency } from '@/lib/idempotency';

export const notificationsCleanupJob = {
  async process() {
    logger.info('[NotificationsCleanupJob] Starting...');

    const today = istDateKey(clock.now());
    const idempotencyKey = `notifications-cleanup:daily:${today}`;
    const claim = await checkOrClaimIdempotency(idempotencyKey, 172800); // 48h TTL
    if (claim.status !== 'not_found') {
      logger.info('[NotificationsCleanupJob] Already processed today', { key: idempotencyKey });
      return { deletedCount: 0 };
    }

    try {
      const cutoff = new Date(clock.now().getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const result = await db.notification.deleteMany({
        where: {
          isRead: true,
          createdAt: { lt: cutoff },
        },
      });
      const data = { deletedCount: result.count };
      await completeIdempotency(idempotencyKey, data).catch(() => {});
      logger.info('[NotificationsCleanupJob] Complete', data);
      return data;
    } catch (err) {
      await failIdempotency(idempotencyKey).catch(() => {});
      throw err;
    }
  },
};
