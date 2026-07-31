import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, updateLegalSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { legalUseCases } from '@/server/modules/legal/legal.use-cases';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'legal_manage')) return adminForbidden();

  try {
    const documents = await legalUseCases.list();
    return success(documents);
  } catch (error) {
    logger.error('GET /api/admin/legal error:', error);
    return errors.internal('Failed to fetch legal documents');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'legal_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(updateLegalSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    const doc = await legalUseCases.upsert(
      validation.data,
      req.headers.get('x-admin-id') || 'system'
    );
    return success(doc);
  } catch (error) {
    logger.error('PUT /api/admin/legal error:', error);
    return errors.internal('Failed to update legal document');
  }
}
