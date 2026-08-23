import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { announcementUseCases } from '@/server/modules/announcements/announcement.use-cases';
import { logger } from '@/lib/logger';
// T-92 (PR-2, 2026-08-23): the inline auth check on line 8 was
// `if (process.env.CRON_SECRET && authHeader !== ...)` — this
// fails OPEN when CRON_SECRET is unset. The other 3 cron routes
// (`cleanup-telemetry`, `notifications`, `reconciliation`) use
// `requireCronAuth` which is fail-closed and enforces a >=16-char
// secret. Announcements was the lone drift. Use the same
// helper to match the rest of the cron surface.
import { requireCronAuth } from '@/lib/cron-auth';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const result = await announcementUseCases.processScheduledAnnouncements();
    return success(result, `Processed ${result.processedCount} scheduled announcements`);
  } catch (error) {
    logger.error('[Cron:Announcements] Error processing scheduled announcements:', error);
    return errors.internal('Failed to process scheduled announcements');
  }
}
