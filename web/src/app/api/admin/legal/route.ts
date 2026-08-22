import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { legalUseCases } from '@/server/modules/legal/legal.use-cases';
import { updateLegalAdminSchema } from '@/lib/validators/admin';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'legal_manage')) return adminForbidden();

  try {
    const documents = await legalUseCases.list();
    // P2-6 (2026-08-05 legal/device audit): the old 300s browser cache meant
    // an admin who saved a document then reloaded saw the STALE version for up
    // to 5 minutes (fetchDocuments() after PUT hit the cached GET). Admin
    // reads are cheap (4 rows) — max-age=0 + must-revalidate forces a
    // revalidation on every load instead of serving a poisoned cache.
    return withCacheHeaders(success(documents), 0);
  } catch (error) {
    logger.error('GET /api/admin/legal error:', error);
    return errors.internal('Failed to fetch legal documents');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'legal_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = updateLegalAdminSchema.safeParse(body);
    if (!validation.success) return errors.validation(validation.error.message);

    const doc = await legalUseCases.upsert(
      validation.data,
      session.adminId ?? session.riderDbId ?? 'system'
    );
    return success(doc);
  } catch (error) {
    logger.error('PUT /api/admin/legal error:', error);
    return errors.internal('Failed to update legal document');
  }
}
