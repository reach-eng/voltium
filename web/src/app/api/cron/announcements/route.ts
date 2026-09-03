import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireCronAuth } from '@/lib/cron-auth';
import { announcementUseCases } from '@/server/modules/announcements/announcement.use-cases';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req, 'CRON_SECRET_ANNOUNCEMENTS');
  if (authError) {
    return authError;
  }

  try {
    const result = await announcementUseCases.processScheduledAnnouncements();
    return success(result, `Processed ${result.processedCount} scheduled announcements`);
  } catch (error) {
    logger.error('[Cron:Announcements] Error processing scheduled announcements:', error);
    return errors.internal('Failed to process scheduled announcements');
  }
}
