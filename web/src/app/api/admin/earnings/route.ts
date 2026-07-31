import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { parseDDMMYYYY } from '@/lib/date-utils';
import { earningUseCases } from '@/server/modules/earnings/earning.use-cases';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'earnings_view')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const search = url.searchParams.get('search') || '';
    const platform = url.searchParams.get('platform') || '';
    // Accept both DD-MM-YYYY (canonical) and ISO 8601 (legacy).
    const startDateRaw = url.searchParams.get('startDate') || '';
    const endDateRaw = url.searchParams.get('endDate') || '';
    const startDate = startDateRaw
      ? parseDDMMYYYY(startDateRaw)?.toISOString() || startDateRaw
      : '';
    const endDate = endDateRaw
      ? parseDDMMYYYY(endDateRaw)?.toISOString() || endDateRaw
      : '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '20')));

    const result = await earningUseCases.list({
      search,
      platform,
      startDate,
      endDate,
      page,
      limit,
    });
    return success(result);
  } catch (error) {
    logger.error('GET /api/admin/earnings error:', error);
    return errors.internal('Failed to fetch earnings');
  }
}
