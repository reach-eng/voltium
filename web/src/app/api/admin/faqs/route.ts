import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { adminFaqUseCases } from '@/server/modules/support/admin-faq.use-cases';
import { parsePositiveInt } from '@/lib/api-utils';
import { createFaqAdminSchema, updateFaqAdminSchema } from '@/lib/validators/admin';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'faq_manage')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const search = url.searchParams.get('search') || '';
    const category = url.searchParams.get('category') || '';
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 100);

    const result = await adminFaqUseCases.list({ search, category, page, limit });
    return withCacheHeaders(success(result.faqs, undefined, 200, result.pagination), 60);
  } catch (error) {
    logger.error('GET /api/admin/faqs error:', error);
    return errors.internal('Failed to fetch FAQs');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'faq_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = createFaqAdminSchema.safeParse(body);
    if (!validation.success) return errors.validation(validation.error.message);

    const faq = await adminFaqUseCases.create(
      validation.data,
      session.adminId ?? session.riderDbId ?? 'system'
    );
    return success(faq, 'FAQ created', 201);
  } catch (error) {
    logger.error('POST /api/admin/faqs error:', error);
    return errors.internal('Failed to create FAQ');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'faq_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = updateFaqAdminSchema.safeParse(body);
    if (!validation.success) return errors.validation(validation.error.message);

    const { id, ...data } = validation.data;
    const faq = await adminFaqUseCases.update(id, data, session.adminId ?? session.riderDbId ?? 'system');
    return success(faq);
  } catch (error) {
    logger.error('PUT /api/admin/faqs error:', error);
    return errors.internal('Failed to update FAQ');
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'faq_manage')) return adminForbidden();

  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return errors.badRequest('id is required');

    await adminFaqUseCases.delete(id, session.adminId ?? session.riderDbId ?? 'system');
    return success(null, 'FAQ deleted');
  } catch (error) {
    logger.error('DELETE /api/admin/faqs error:', error);
    return errors.internal('Failed to delete FAQ');
  }
}
