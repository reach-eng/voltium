import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { notificationUseCases } from '@/server/modules/notifications/notification.use-cases';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await requireRiderSession(request);
    if (session instanceof Response) return session;

    const url = request.nextUrl;
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 100);
    const notifications = await notificationUseCases.listNotifications(session.riderDbId, limit);
    const unreadCount = await notificationUseCases.getUnreadCount(session.riderDbId);
    return success({ notifications, unreadCount });
  } catch (error) {
    logger.error('[GET /api/rider/notifications]', error);
    return errors.internal('Failed to fetch notifications');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireRiderSession(request);
    if (session instanceof Response) return session;

    const body = await request.json().catch(() => ({}));
    if (body.notificationId) {
      await notificationUseCases.markRead(body.notificationId, session.riderDbId);
      return success({ id: body.notificationId }, 'Notification marked read');
    }

    await notificationUseCases.markAllRead(session.riderDbId);
    return success({ all: true }, 'All notifications marked read');
  } catch (error) {
    logger.error('[PUT /api/rider/notifications]', error);
    return errors.internal('Failed to update notifications');
  }
}

// PR-VER-2026-08-06 (SUPPORT_NOTIFICATIONS P0-5): the rider app's
// swipe-to-delete was local-only. This is the server half — DELETE by id,
// ownership-scoped (a rider cannot delete another rider's row).
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireRiderSession(request);
    if (session instanceof Response) return session;

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return errors.badRequest('notification id is required');

    const deleted = await notificationUseCases.deleteNotification(
      id,
      session.riderDbId
    );
    if (!deleted) return errors.notFound('Notification not found');
    return success({ id }, 'Notification deleted');
  } catch (error) {
    logger.error('[DELETE /api/rider/notifications]', error);
    return errors.internal('Failed to delete notification');
  }
}
