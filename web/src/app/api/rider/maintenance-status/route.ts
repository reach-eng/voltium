import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const [modeSetting, messageSetting] = await Promise.all([
      db.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MODE' } }),
      db.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MESSAGE' } }),
    ]);

    const enabled = modeSetting?.value === 'true';
    const message =
      messageSetting?.value ??
      'System is currently under maintenance. Please check back later.';

    return withCacheHeaders(
      success({
        enabled,
        message,
      }),
      5
    );
  } catch (err: unknown) {
    logger.error('[rider/maintenance-status] GET failed:', err);
    return errors.internal('Failed to fetch maintenance status');
  }
}
