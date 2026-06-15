/**
 * GET /api/cron/notifications — Periodic notification tasks
 *
 * Thin route handler: auth + delegate + respond.
 * Business logic lives in notificationService (birthday wishes, payment reminders, referral updates).
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { notificationUseCases } from '@/server/modules/notifications/notification.use-cases';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return errors.unauthorized('Invalid cron secret');
  }

  try {
    const results = await notificationUseCases.processScheduledNotifications();
    return success(results, 'Cron tasks completed successfully');
  } catch (error) {
    logger.error('Cron /api/cron/notifications error:', error);
    return errors.internal('Cron tasks failed');
  }
}
