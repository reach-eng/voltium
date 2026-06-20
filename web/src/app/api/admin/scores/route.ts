import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, recalculateScoreSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { scoreUseCases } from '@/server/modules/scores/score.use-cases';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'riders_view')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const riskLevel = url.searchParams.get('riskLevel') || '';
    const minScore = url.searchParams.get('minScore');
    const search = url.searchParams.get('search') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20')), 100);

    const result = await scoreUseCases.list({
      riskLevel,
      minScore: minScore ? parseFloat(minScore) : undefined,
      search,
      page,
      limit,
    });
    return success({ scores: result.scores, pagination: result.pagination }, undefined, 200);
  } catch (error) {
    logger.error('GET /api/admin/scores error:', error);
    return errors.internal('Failed to fetch rider scores');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'riders_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(recalculateScoreSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    const score = await scoreUseCases.recalculate(validation.data.riderId, session.adminId || '');
    return success(score, 'Score recalculated');
  } catch (error) {
    logger.error('POST /api/admin/scores error:', error);
    return errors.internal('Failed to recalculate score');
  }
}
