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
  if (!hasPermission(session, 'riders_view')) return adminForbidden();

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

import { z } from 'zod';

const CreateEarningSchema = z.object({
  riderId: z.string().min(1, 'riderId is required'),
  date: z.string().optional(),
  platform: z.string().max(50).default('DIRECT'),
  amount: z
    .number()
    .finite('amount must be a finite number')
    .positive('amount must be a positive number')
    .max(10_000_000, 'amount exceeds maximum limit'),
  trips: z.number().int().nonnegative().optional(),
  distance: z.number().finite().nonnegative().optional(),
  hoursOnline: z.number().finite().nonnegative().max(24).optional(),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'riders_manage')) return adminForbidden();

  try {
    const raw = await req.json();
    const parsed = CreateEarningSchema.safeParse(raw);
    if (!parsed.success) {
      return errors.badRequest(
        parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')
      );
    }
    const { riderId, date, platform, amount, trips, distance, hoursOnline, notes } = parsed.data;

    const created = await earningUseCases.create({
      riderId,
      date: date ? new Date(date) : new Date(),
      platform,
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
