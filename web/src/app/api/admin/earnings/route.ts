import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { parseDDMMYYYY } from '@/lib/date-utils';
import { parsePositiveInt } from '@/lib/api-utils';
import { earningUseCases } from '@/server/modules/earnings/earning.use-cases';
import { toRupeesResponse } from '@/lib/api-money';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'riders_view')) return adminForbidden();

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
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 100);

    const result = await earningUseCases.list({
      search,
      platform,
      startDate,
      endDate,
      page,
      limit,
    });
    return withCacheHeaders(success(toRupeesResponse(result)), 10);
  } catch (error) {
    logger.error('GET /api/admin/earnings error:', error);
    return errors.internal('Failed to fetch earnings');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'riders_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const { riderId, date, platform, amount, trips, distance, hoursOnline, notes } = body;

    if (!riderId || typeof riderId !== 'string') {
      return errors.badRequest('riderId is required');
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return errors.badRequest('amount must be a positive number');
    }

    const created = await earningUseCases.create({
      riderId,
      date: date ? new Date(date) : new Date(),
      platform: platform || 'DIRECT',
      amount,
      trips: typeof trips === 'number' ? trips : undefined,
      distance: typeof distance === 'number' ? distance : undefined,
      hoursOnline: typeof hoursOnline === 'number' ? hoursOnline : undefined,
      notes: typeof notes === 'string' ? notes : undefined,
    });

    return success(toRupeesResponse(created), 'Earning entry created successfully', 201);
  } catch (error) {
    logger.error('POST /api/admin/earnings error:', error);
    return errors.internal('Failed to create earning entry');
  }
}
