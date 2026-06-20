import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, createIncidentSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { incidentUseCases } from '@/server/modules/incidents/incident.use-cases';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'incidents_manage')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const status = url.searchParams.get('status') || '';
    const type = url.searchParams.get('type') || '';
    const severity = url.searchParams.get('severity') || '';
    const search = url.searchParams.get('search') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20')), 100);

    const result = await incidentUseCases.list({ status, type, severity, search, page, limit });
    return success(result.incidents, undefined, 200, result.pagination);
  } catch (error) {
    logger.error('GET /api/admin/incidents error:', error);
    return errors.internal('Failed to fetch incidents');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'incidents_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(createIncidentSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    const incident = await incidentUseCases.create(validation.data, session.adminId || '');
    return success(incident, 'Incident created', 201);
  } catch (error) {
    logger.error('POST /api/admin/incidents error:', error);
    return errors.internal('Failed to create incident');
  }
}
