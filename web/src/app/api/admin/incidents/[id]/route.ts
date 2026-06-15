import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, updateIncidentSchema } from '@/lib/validators';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { incidentUseCases } from '@/server/modules/incidents/incident.use-cases';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'incidents_manage')) return adminForbidden();

  try {
    const { id } = await params;
    const incident = await incidentUseCases.getIncident(id);

    if (!incident) return errors.notFound('Incident not found');

    return success(incident);
  } catch (error) {
    return errors.internal('Failed to fetch incident');
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'incidents_manage')) return adminForbidden();

  try {
    const { id } = await params;
    const body = await req.json();
    const validation = validateBody(updateIncidentSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error!);
    }

    const { status, assignedTo, resolution, insuranceClaim, insuranceClaimNumber } = validation.data;

    const incident = await incidentUseCases.updateIncident(
      id,
      { status, assignedTo, resolution, insuranceClaim, insuranceClaimNumber },
      session.adminId || '',
    );

    return success(incident);
  } catch (error) {
    return errors.internal('Failed to update incident');
  }
}
