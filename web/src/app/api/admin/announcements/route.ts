import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, createAnnouncementSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { announcementUseCases } from '@/server/modules/announcements/announcement.use-cases';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'notifications_manage')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const status = url.searchParams.get('status') || '';
    const search = url.searchParams.get('search') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20')), 100);

    const result = await announcementUseCases.list({ status, search, page, limit });
    return success(result.announcements, undefined, 200, result.pagination);
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

    const result = await announcementUseCases.create(
      { title, message, channel, targetAudience, targetIds, scheduledAt },
      session.adminId || ''
    );

    return success(result, scheduledAt ? 'Announcement scheduled' : 'Announcement sent', 201);
  } catch (error) {
    logger.error('POST /api/admin/announcements error:', error);
    return errors.internal('Failed to create announcement');
  }
}
