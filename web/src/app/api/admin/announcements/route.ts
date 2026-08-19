import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { validateBody, createAnnouncementSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { parsePositiveInt } from '@/lib/api-utils';
import { announcementUseCases } from '@/server/modules/announcements/announcement.use-cases';

// PR-4 (9th audit P0): an immediate ALL-broadcast fans out to every rider.
// Same guard as the notification broadcast — require ?confirm=true and
// rate-limit to 3/hr/admin, failing closed so an outage can never turn the
// endpoint into unlimited fanout.
const ANNOUNCEMENT_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 3,
  failClosed: true,
} as const;

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'notifications_manage')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const status = url.searchParams.get('status') || '';
    const search = url.searchParams.get('search') || '';
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 100);

    const result = await announcementUseCases.list({ status, search, page, limit });
    return withCacheHeaders(success(result.announcements, undefined, 200, result.pagination), 10);
  } catch (error) {
    logger.error('GET /api/admin/announcements error:', error);
    return errors.internal('Failed to fetch announcements');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'notifications_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(createAnnouncementSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    const { title, message, channel, targetAudience, targetIds, scheduledAt } = validation.data;

    const isImmediateAll = !scheduledAt && targetAudience === 'ALL';
    if (isImmediateAll) {
      // PR-4: explicit confirmation for send-to-all — the admin UI's
      // "are you sure?" step is enforced server-side.
      const confirm = req.nextUrl.searchParams.get('confirm');
      if (confirm !== 'true') {
        return errors.badRequest('Broadcast requires ?confirm=true to send to all riders');
      }

      const adminId = session.adminId ?? session.riderDbId ?? 'unknown';
      const rateLimit = await checkRateLimit(`admin:announcement:sendAll:${adminId}`, {
        ...ANNOUNCEMENT_RATE_LIMIT,
      });
      if (!rateLimit.allowed) {
        return errors.tooManyRequests(
          'Announcement rate limit exceeded — 3 sends per hour per admin'
        );
      }
    }

    const result = await announcementUseCases.create(
      { title, message, channel, targetAudience, targetIds, scheduledAt },
      session.adminId || ''
    );

    // PR-4: immediate sends are async (outbox + background job) — 202 Accepted
    // instead of 201 so the caller knows the fanout is queued, not complete.
    if (result.accepted) {
      return success(result, 'Announcement queued for delivery', 202);
    }
    return success(result, scheduledAt ? 'Announcement scheduled' : 'Announcement sent', 201);
  } catch (error) {
    logger.error('POST /api/admin/announcements error:', error);
    return errors.internal('Failed to create announcement');
  }
}
