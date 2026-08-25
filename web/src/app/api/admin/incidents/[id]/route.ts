import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { invalidateCache } from '@/lib/cache';
import { validateBody, updateIncidentSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { incidentUseCases } from '@/server/modules/incidents/incident.use-cases';
import { logAdminMutation } from '@/lib/audit-log';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'incidents_manage')) return adminForbidden();

  try {
    const { id } = await params;
    const incident = await incidentUseCases.getIncident(id);

    if (!incident) return errors.notFound('Incident not found');

    // Single-record lookup; 30s browser cache keeps repeated views cheap. PUT
    // invalidates the list cache below; this record is small enough that the
    // extra round-trip is fine.
    return withCacheHeaders(success(incident), 30);
  } catch (error) {
    // P1-9: every other admin route logs its errors — this one silently
    // returned 500 with no trail.
    logger.error('GET /api/admin/incidents/[id] error:', error);
    return errors.internal('Failed to fetch incident');
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'incidents_manage')) return adminForbidden();

  try {
    const { id } = await params;
    const body = await req.json();
    const validation = validateBody(updateIncidentSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error!);
    }

    const { status, assignedTo, resolution, insuranceClaim, insuranceClaimNumber } =
      validation.data;

    // P2-9: `session.adminId || ''` could pass an empty-string actor into the
    // use-case; and a client-sent assignedTo: '' would be written verbatim.
    // Normalize: never pass '' as the actor, and treat an empty assignedTo as
    // an explicit unassign (null) rather than a garbage string.
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

    // Update changes the record + the list view; clear the list cache so the
    // next GET reflects the new status / assignment.
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
    logger.error('PUT /api/admin/incidents/[id] error:', error);
    return errors.internal('Failed to update incident');
  }
}
