import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { validateBody, awardRewardSchema, updateRewardSchema } from '@/lib/validators';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { adminRewardUseCases } from '@/server/modules/rewards/reward.use-cases';
import { parsePositiveInt } from '@/lib/api-utils';
import { toRupeesResponse } from '@/lib/api-money';
import { logAdminMutation } from '@/lib/audit-log';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'rewards_manage')) return adminForbidden();

  try {
    const { searchParams } = req.nextUrl;
    const page = parsePositiveInt(searchParams.get('page'), 1);
    const limit = parsePositiveInt(searchParams.get('limit'), 20, 100);
    const search = searchParams.get('search');

    const result = await adminRewardUseCases.list({ search, page, limit });
    return withCacheHeaders(success(toRupeesResponse(result)), 10);
  } catch (error) {
    logger.error('GET /api/admin/rewards error:', error);
    return errors.internal('Failed to fetch rewards');
  }
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'rewards_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(awardRewardSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const actorId = session.adminId ?? session.riderDbId ?? 'system';
    const reward = await adminRewardUseCases.award(validation.data, actorId);

    await logAdminMutation({
      session,
      action: 'reward.award',
      entity: 'Reward',
      entityId: reward?.id,
      details: { riderDbId: validation.data.riderDbId, points: validation.data.points },
    });

    return success(toRupeesResponse(reward), 'Rewards points awarded successfully');
  } catch (error) {
    logger.error('POST /api/admin/rewards error:', error);
    return errors.internal('Failed to award reward points');
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'rewards_manage')) return adminForbidden();

  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return errors.badRequest('Reward id is required');

    const actorId = session.adminId ?? session.riderDbId ?? 'system';
    await adminRewardUseCases.revoke(id, actorId);

    await logAdminMutation({
      session,
      action: 'reward.revoke',
      entity: 'Reward',
      entityId: id,
    });

    return success({ id }, 'Reward points revoked successfully');
  } catch (error: unknown) {
    logger.error('DELETE /api/admin/rewards error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('not found')) return errors.notFound(msg);
    return errors.internal('Failed to revoke reward points');
  }
}

export async function PUT(req: Request) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'rewards_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(updateRewardSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { id, ...updates } = validation.data;
    const actorId = session.adminId ?? session.riderDbId ?? 'system';
    const reward = await adminRewardUseCases.update(id, updates, actorId);

    await logAdminMutation({
      session,
      action: 'reward.update',
      entity: 'Reward',
      entityId: id,
      details: updates,
    });

    return success(toRupeesResponse(reward), 'Reward updated successfully');
  } catch (error: unknown) {
    logger.error('PUT /api/admin/rewards error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('not found')) return errors.notFound(msg);
    return errors.internal('Failed to update reward');
  }
}
