import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';

export const notificationsCleanupJob = {
  async process() {
    logger.info('[NotificationsCleanupJob] Starting...');
    const cutoff = new Date(clock.now().getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const result = await db.notification.deleteMany({
      where: {
        isRead: true,
        createdAt: { lt: cutoff },
      },
    });
    logger.info('[NotificationsCleanupJob] Complete', { deletedCount: result.count });
    return { deletedCount: result.count };
  },
};
