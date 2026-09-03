import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { validateBody, updateRewardSchema } from '@/lib/validators';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { adminRewardUseCases } from '@/server/modules/rewards/reward.use-cases';
import { toRupeesResponse } from '@/lib/api-money';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'rewards_manage')) return adminForbidden();

  try {
    const id = (await params).id;
    if (!id) return errors.badRequest('Reward id is required');

    const actorId = session.adminId ?? session.riderDbId ?? 'system';
    await adminRewardUseCases.revoke(id, actorId);
    return success({ id }, 'Reward points revoked successfully');
  } catch (error: unknown) {
    logger.error('DELETE /api/admin/rewards/[id] error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('not found')) return errors.notFound(msg);
    return errors.internal('Failed to revoke reward points');
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'rewards_manage')) return adminForbidden();

  try {
    const id = (await params).id;
    const body = await req.json();
    
    // Inject the ID from the URL into the body to satisfy the schema
    const validation = validateBody(updateRewardSchema, { ...body, id });
    if (!validation.success) return errors.validation(validation.error);

    const { id: validatedId, ...updates } = validation.data;
    const actorId = session.adminId ?? session.riderDbId ?? 'system';
    const reward = await adminRewardUseCases.update(validatedId, updates, actorId);
    return success(toRupeesResponse(reward), 'Reward updated successfully');
  } catch (error: unknown) {
    logger.error('PUT /api/admin/rewards/[id] error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('not found')) return errors.notFound(msg);
    return errors.internal('Failed to update reward');
  }
}
