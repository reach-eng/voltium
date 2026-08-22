import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
import { z } from 'zod';

// AUDIT FIX (N-7): body was destructured raw; the catch also leaked
// `error.message` (internal details) to the client.
const PlanRejectSchema = z.object({
  action: z.literal('REJECT'),
  reason: z.string().min(1).max(1000),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'riders_manage')) return adminForbidden();

  try {
    const { id: riderId } = await params;
    const parsed = PlanRejectSchema.safeParse(await req.json());
    if (!parsed.success) {
      return errors.badRequest(
        parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')
      );
    }
    const { reason } = parsed.data;
    await riderUseCases.rejectPlan(riderId, session.adminId || '', reason);
    return success(null, 'Plan rejected');
  } catch (error: any) {
    // AUDIT FIX (N-7): log the real error; return a generic message.
    logger.error('[PLAN_REJECT_ERROR]', error);
    return errors.internal('Failed to update plan');
  }
}
