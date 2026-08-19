import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { announcementUseCases } from '@/server/modules/announcements/announcement.use-cases';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return errors.unauthorized('Invalid cron secret');
  }

  try {
    const result = await announcementUseCases.processScheduledAnnouncements();
    return success(result, `Processed ${result.processedCount} scheduled announcements`);
  } catch (error) {
    logger.error('[Cron:Announcements] Error processing scheduled announcements:', error);
    return errors.internal('Failed to process scheduled announcements');
  }
}
