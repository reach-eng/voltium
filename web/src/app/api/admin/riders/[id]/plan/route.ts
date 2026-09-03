import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
import { logger } from '@/lib/logger';
import { adminRiderPlanActionSchema } from '@/lib/validators/admin';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'riders_manage')) return adminForbidden();

  try {
    const { id: riderId } = await params;
    const body = await req.json();
    // P1: strict Zod validation (was unvalidated `action` + raw
    // `error.message` echo on 500).
    const validation = adminRiderPlanActionSchema.safeParse(body);
    if (!validation.success) return errors.validation(validation.error.message);
    const { action, reason } = validation.data;

    if (action === 'REJECT') {
      await riderUseCases.rejectPlan(riderId, session.adminId || '', reason);
      return success(null, 'Plan rejected');
    }

    return errors.validation('Invalid action');
  } catch (error: unknown) {
    // P1: never echo raw internals (Prisma/use-case text) to the client.
    logger.error('PUT /api/admin/riders/[id]/plan error:', error);
    return errors.internal('Failed to update plan');
  }
}
