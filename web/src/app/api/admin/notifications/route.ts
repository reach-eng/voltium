import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { validateBody, sendNotificationSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { OutboxService, OutboxEventTypes } from '@/server/workers/outbox';
import { notificationUseCases } from '@/server/modules/notifications/notification.use-cases';
import { parsePositiveInt } from '@/lib/api-utils';

// P0-1/P0-9 (2026-08-05 ops audit): broadcast limit — 3 sends per hour per
// admin. A single admin used to be able to DoS the DB with 2-3 synchronous
// calls inserting 100k rows each. Failing closed on a DB outage is right here:
// the endpoint is admin-only and a broadcast must never silently become
// unlimited because the limiter's backing store is down.
const BROADCAST_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 3,
  failClosed: true,
} as const;

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'notifications_manage')) return adminForbidden();

  try {
    const { searchParams } = req.nextUrl;
    const page = parsePositiveInt(searchParams.get('page'), 1);
    const limit = parsePositiveInt(searchParams.get('limit'), 20, 100);
    const search = searchParams.get('search') || undefined;
    const type = searchParams.get('type') || undefined;
    const status = searchParams.get('status') || undefined;

    const result = await notificationUseCases.listAllAdmin({ page, limit, search, type, status });
    return withCacheHeaders(success({ notifications: result.notifications, pagination: result.pagination }), 5);
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
    // P1-13/P2-11: riderId is now part of sendNotificationSchema — no more
    // untyped `(body as Record<string, unknown>).riderId` reads.
    const riderId = validation.data.riderId;

    if (
      !riderId &&
      (!validation.data.riderIds || validation.data.riderIds.length === 0) &&
      !validation.data.sendToAll
    ) {
      return errors.badRequest('riderId or riderIds or sendToAll is required');
    }

    if (riderId) {
      const notification = await notificationUseCases.sendToSingleRider(
        riderId,
        title,
        message,
        type,
        session.adminId || ''
      );
      return success(notification, 'Notification sent', 201);
    }

    if (validation.data.sendToAll) {
      // P0-1/P0-9: an accidental single click used to push 100k rows. Require
      // an explicit ?confirm=true so the API enforces the "are you sure?"
      // step the admin UI modal shows.
      const confirm = req.nextUrl.searchParams.get('confirm');
      if (confirm !== 'true') {
        return errors.badRequest(
          'Broadcast requires ?confirm=true to send to all riders'
        );
      }

      // P0-1/P0-9: rate limit — 3/hr/admin, fail-closed.
      const adminId = session.adminId ?? session.riderDbId ?? 'unknown';
      const rateLimit = await checkRateLimit(`admin:notification:sendAll:${adminId}`, {
        ...BROADCAST_RATE_LIMIT,
      });
      if (!rateLimit.allowed) {
        return errors.tooManyRequests(
          'Broadcast rate limit exceeded — 3 sends per hour per admin'
        );
      }

      // P0-1/P0-9: don't hold the HTTP request open for ~30-60s of inserts.
      // Emit an outbox event and return 202 Accepted; notification-broadcast
      // job runs the batched loop in the background.
      const eventId = await OutboxService.emit(OutboxEventTypes.NOTIFICATION_BROADCAST, {
        title,
        message,
        type,
        adminId,
      });
      return success(
        { accepted: true, eventId },
        'Broadcast queued for all riders',
        202
      );
    }

    if (validation.data.riderIds && validation.data.riderIds.length > 0) {
      // P3-10: same async treatment as the broadcast — the specific-send used
      // to insert up to 100 rows synchronously with no rate limit. Emit an
      // outbox event (reuses NOTIFICATION_BROADCAST; the job branches on
      // riderIds) and return 202.
      const eventId = await OutboxService.emit(OutboxEventTypes.NOTIFICATION_BROADCAST, {
        title,
        message,
        type,
        adminId: session.adminId ?? session.riderDbId ?? 'system',
        riderIds: validation.data.riderIds,
      });
      return success(
        { accepted: true, eventId },
        'Notifications queued',
        202
      );
    }

    return errors.badRequest('No target riders specified');
  } catch (error) {
    // P1-14: a stale/non-existent riderId used to surface as a 500 FK/"Rider
    // not found" error — return a clean 404 so the admin can fix the target.
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Rider not found') {
      return errors.notFound('Rider not found');
    }
    logger.error('POST /api/admin/notifications error:', error);
    return errors.internal('Failed to send notification');
  }
}
