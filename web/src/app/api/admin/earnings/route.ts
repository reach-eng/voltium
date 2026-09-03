import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { parseDDMMYYYY } from '@/lib/date-utils';
import { parsePositiveInt } from '@/lib/api-utils';
import { earningUseCases } from '@/server/modules/earnings/earning.use-cases';
import { toRupeesResponse } from '@/lib/api-money';
import { z } from 'zod';
import { createEarningSchema } from '@/lib/validators';

// P1: strict admin schema reusing the canonical earning fields (was manual
// checks + `new Date(date)` on unvalidated input → Invalid Date to DB).
// riderId is required on the admin path; date must parse.
const adminCreateEarningSchema = createEarningSchema
  .extend({
    riderId: z.string().min(1, 'riderId is required').max(100),
    date: z
      .string()
      .min(1, 'date is required')
      .refine((v) => !Number.isNaN(Date.parse(v)), 'date must be parseable'),
    platform: z.string().max(100).optional().default('DIRECT'),
    amount: z.number().positive('amount must be positive').max(10000000),
  })
  .strict();

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
    const validation = adminCreateEarningSchema.safeParse(body);
    if (!validation.success) return errors.validation(validation.error.message);
    const { riderId, date, platform, amount, trips, distance, hoursOnline, notes } =
      validation.data;

    const created = await earningUseCases.create({
      riderId,
      date: new Date(date),
      platform: platform || 'DIRECT',
      amount,
      trips,
      distance,
      hoursOnline,
      notes,
    });

    return success(toRupeesResponse(created), 'Earning entry created successfully', 201);
  } catch (error) {
    logger.error('POST /api/admin/earnings error:', error);
    return errors.internal('Failed to create earning entry');
  }
}
