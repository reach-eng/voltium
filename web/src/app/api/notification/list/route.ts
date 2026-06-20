import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { notificationUseCases } from '@/server/modules/notifications/notification.use-cases';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const notifications = await notificationUseCases.listNotifications(riderDbId, 20);

    const result =
      notifications.length > 0
        ? notifications
        : [
            {
              id: 'welcome',
              riderId: riderDbId,
              title: 'Welcome to Ryd!',
              message: 'Complete your KYC to get started.',
              type: 'INFO',
              isRead: false,
              createdAt: new Date(),
            },
            {
              id: 'deposit',
              riderId: riderDbId,
              title: 'Security Deposit',
              message: 'Deposit ₹2,000 to unlock vehicle booking.',
              type: 'ALERT',
              isRead: false,
              createdAt: new Date(Date.now() - 3600000),
            },
          ];

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
  } catch (err: any) {
    if (err.message === 'NOTIFICATION_ACCESS_DENIED')
      return errors.forbidden('Cannot access this notification');
    logger.error('[PUT /api/notification/list]', err);
    return errors.internal('Failed to update notifications');
  }
}
