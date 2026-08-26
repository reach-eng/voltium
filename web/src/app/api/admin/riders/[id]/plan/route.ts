import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'riders_manage')) return adminForbidden();

  try {
    const { id: riderId } = await params;
    const body = await req.json();
    const { action, reason } = body;

    if (action === 'REJECT') {
      if (!reason) return errors.badRequest('reason is required for REJECT');
      await riderUseCases.rejectPlan(riderId, session.adminId || '', reason);
      return success(null, 'Plan rejected');
    }

    return errors.badRequest('Invalid action');
  } catch (error: any) {
    return errors.internal(error.message || 'Failed to update plan');
  }
}
