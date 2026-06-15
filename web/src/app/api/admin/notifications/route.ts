import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, sendNotificationSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { notificationUseCases } from '@/server/modules/notifications/notification.use-cases';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'notifications_manage')) return adminForbidden();

  try {
    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || undefined;
    const type = searchParams.get('type') || undefined;
    const status = searchParams.get('status') || undefined;

    const result = await notificationUseCases.listAllAdmin({ page, limit, search, type, status });
    return success({ notifications: result.notifications, pagination: result.pagination });
  } catch (error) {
    logger.error('GET /api/admin/notifications error:', error);
    return errors.internal('Failed to fetch notifications');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'notifications_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(sendNotificationSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    const { title, message, type } = validation.data;
    const riderId = (body as Record<string, unknown>).riderId as string | undefined;

    if (!riderId && (!validation.data.riderIds || validation.data.riderIds.length === 0) && !validation.data.sendToAll) {
      return errors.badRequest('riderId or riderIds or sendToAll is required');
    }

    if (riderId) {
      const notification = await notificationUseCases.sendToSingleRider(riderId, title, message, type, session.adminId || '');
      return success(notification, 'Notification sent', 201);
    }

    if (validation.data.sendToAll) {
      const result = await notificationUseCases.sendToAllRiders(title, message, type, session.adminId || '');
      return success(result, 'Notifications sent to all riders', 201);
    }

    if (validation.data.riderIds && validation.data.riderIds.length > 0) {
      const result = await notificationUseCases.sendToSpecificRiders(validation.data.riderIds, title, message, type, session.adminId || '');
      return success(result, 'Notifications sent', 201);
    }

    return errors.badRequest('No target riders specified');
  } catch (error) {
    logger.error('POST /api/admin/notifications error:', error);
    return errors.internal('Failed to send notification');
  }
}
