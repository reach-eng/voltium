import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { validateBody, awardRewardSchema } from '@/lib/validators';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { rewardUseCases } from '@/server/modules/rewards/reward.use-cases';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'rewards_manage')) return adminForbidden();

  try {
    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');

    const result = await rewardUseCases.list({ search, page, limit });
    return success(result);
  } catch (error) {
    logger.error('GET /api/admin/rewards error:', error);
    return errors.internal('Failed to fetch rewards');
  }
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'rewards_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(awardRewardSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const reward = await rewardUseCases.award(validation.data, session.adminId || '');
    return success(reward, 'Rewards points awarded successfully');
  } catch (error) {
    logger.error('POST /api/admin/rewards error:', error);
    return errors.internal('Failed to award reward points');
  }
}
