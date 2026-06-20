/**
 * Notifications module - Routes.
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 */

import { NextRequest } from 'next/server';
import { requireRiderSession } from '@/lib/rider-auth';
import { requirePermission } from '@/lib/rbac';
import { notificationUseCases } from './notification.use-cases';
import { sendNotificationSchema } from './notification.schemas';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';

export async function GET_list(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const { searchParams } = request.nextUrl;
  const limit = parseInt(searchParams.get('limit') || '50');
  const notifications = await notificationUseCases.listNotifications(session.riderDbId, limit);
  return success(notifications);
}

export async function POST_send(request: NextRequest) {
  const admin = await requirePermission('notifications_manage');
  if (!admin) return errors.forbidden('Insufficient permissions');

  const body = await request.json();
  const validation = validateBody(sendNotificationSchema, body);
  if (!validation.success) return errors.validation(validation.error);

  if (validation.data.sendToAll) {
    await notificationUseCases.sendToAll(
      validation.data.title,
      validation.data.message,
      validation.data.type
    );
  } else if (validation.data.riderIds?.length) {
    for (const riderId of validation.data.riderIds) {
      await notificationUseCases.sendToRider(
        riderId,
        validation.data.title,
        validation.data.message,
        validation.data.type
      );
    }
  }

  return success(null, 'Notifications sent');
}

export async function POST_markRead(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const body = await request.json();
  if (body.all) {
    await notificationUseCases.markAllRead(session.riderDbId);
    return success(null, 'All notifications marked as read');
  }

  await notificationUseCases.markRead(body.notificationId);
  return success(null, 'Notification marked as read');
}

export async function GET_unreadCount(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const count = await notificationUseCases.getUnreadCount(session.riderDbId);
  return success({ count });
}
