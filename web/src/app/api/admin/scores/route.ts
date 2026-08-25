import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { validateBody, recalculateScoreSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { parsePositiveInt } from '@/lib/api-utils';
import { scoreUseCases } from '@/server/modules/scores/score.use-cases';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'riders_view')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const riskLevel = url.searchParams.get('riskLevel') || '';
    const minScore = url.searchParams.get('minScore');
    const search = url.searchParams.get('search') || '';
    const hubId = url.searchParams.get('hubId') || url.searchParams.get('hub') || '';
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 100);

    const result = await scoreUseCases.list({
      riskLevel,
      minScore: minScore ? parseFloat(minScore) : undefined,
      search,
      hubId: hubId || undefined,
      page,
      limit,
    });
    return withCacheHeaders(
      success(
        {
          scores: result.scores,
          pagination: result.pagination,
          riskCounts: result.riskCounts,
        },
        undefined,
        200,
        {
          ...result.pagination,
          riskCounts: result.riskCounts,
        }
      ),
      10
    );
  } catch (error) {
    logger.error('GET /api/admin/scores error:', error);
    return errors.internal('Failed to fetch rider scores');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'riders_manage')) return adminForbidden();

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
