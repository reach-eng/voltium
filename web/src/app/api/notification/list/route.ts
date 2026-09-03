import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { parsePositiveInt } from '@/lib/api-utils';
import { notificationUseCases } from '@/server/modules/notifications/notification.use-cases';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    // P1: client-controllable bounded limit (was hardcoded 20, no control).
    const limit = parsePositiveInt(new URL(request.url).searchParams.get('limit'), 20, 100);
    const notifications = await notificationUseCases.listNotifications(riderDbId, limit);

    const result = notifications;

    return success({ notifications: result }, `${result.length} notifications fetched`);
  } catch (err) {
    logger.error('[GET /api/notification/list]', err);
    return errors.internal('Failed to fetch notifications');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const { notificationId } = await request.json();
    if (!notificationId) return errors.badRequest('notificationId required');

    await notificationUseCases.markRead(notificationId, riderDbId);
    return success(null, 'Notification marked as read');
  } catch (err: unknown) {
    if ((err instanceof Error ? err.message : String(err)) === 'NOTIFICATION_ACCESS_DENIED')
      return errors.forbidden('Cannot access this notification');
    logger.error('[PUT /api/notification/list]', err);
    return errors.internal('Failed to update notifications');
  }
}
