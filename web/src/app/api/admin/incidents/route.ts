import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { invalidateCache } from '@/lib/cache';
import { validateBody, createIncidentSchema, updateIncidentSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { incidentUseCases } from '@/server/modules/incidents/incident.use-cases';
import { parsePositiveInt } from '@/lib/api-utils';
import { logAdminMutation } from '@/lib/audit-log';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'incidents_manage')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const status = url.searchParams.get('status') || '';
    const type = url.searchParams.get('type') || '';
    const severity = url.searchParams.get('severity') || '';
    const search = url.searchParams.get('search') || '';
    // PR-4b (13th audit P0-6): NaN-safe pagination.
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 100);

    const result = await incidentUseCases.list({ status, type, severity, search, page, limit });
    return withCacheHeaders(
      success(result.incidents, undefined, 200, {
        ...result.pagination,
        statusCounts: result.statusCounts,
      }),
      5
    );
  } catch (error) {
    logger.error('GET /api/admin/incidents error:', error);
    return errors.internal('Failed to fetch incidents');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'incidents_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(createIncidentSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    const incident = await incidentUseCases.create(validation.data, session.adminId || '');
    invalidateCache('admin:incidents:*');
    await logAdminMutation({
      session,
      action: 'incident.create',
      entity: 'Incident',
      entityId: incident?.id,
      details: validation.data,
    });
    return success(incident, 'Incident created', 201);
  } catch (error) {
    // P1-8: the use-case already verifies rider/vehicle existence — surface a
    // clean 400 instead of a 500 with a confusing message.
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Rider not found' || message === 'Vehicle not found') {
      return errors.badRequest(message);
    }
    logger.error('POST /api/admin/incidents error:', error);
    return errors.internal('Failed to create incident');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'incidents_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(updateIncidentSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    const { id, status, assignedTo, resolution, insuranceClaim, insuranceClaimNumber } =
      validation.data;
    if (!id) return errors.badRequest('Incident ID is required');

    const actorId = session.adminId ?? session.riderDbId ?? 'system';
    const incident = await incidentUseCases.updateIncident(
      id,
      {
        status,
        assignedTo: assignedTo === '' ? null : assignedTo,
        resolution,
        insuranceClaim,
        insuranceClaimNumber,
      },
      actorId
    );

    invalidateCache('admin:incidents:*');
    await logAdminMutation({
      session,
      action: 'incident.update',
      entity: 'Incident',
      entityId: id,
      details: { status, assignedTo, resolution, insuranceClaim, insuranceClaimNumber },
    });
    return success(incident);
  } catch (error) {
    logger.error('PUT /api/admin/incidents error:', error);
    return errors.internal('Failed to update incident');
  }
}
