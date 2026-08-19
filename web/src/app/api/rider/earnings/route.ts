import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, errors } from '@/lib/api-response';
import { validateBody, createEarningSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
import { parsePositiveInt } from '@/lib/api-utils';

// DEEP-AUDIT D-P1-8 (2026-08-08): the startDate/endDate query params
// used to be passed straight into `new Date(...)` for Prisma filtering.
// A bad string like "not-a-date" returned Invalid Date and either
// crashed the query or returned 0 rows silently. Zod-validate so the
// rider app gets a 400 instead of an empty list.
const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'Expected ISO date YYYY-MM-DD')
  .refine((s) => !Number.isNaN(new Date(s).getTime()), 'Invalid date');

export async function GET(req: NextRequest) {
  const auth = await requireRiderSession(req);
  if (auth instanceof Response) return auth;
  const riderId = auth.riderDbId;

  try {
    const url = req.nextUrl;
    const startDateRaw = url.searchParams.get('startDate') || undefined;
    const endDateRaw = url.searchParams.get('endDate') || undefined;
    if (startDateRaw) {
      const parsed = dateParam.safeParse(startDateRaw);
      if (!parsed.success) {
        return errors.badRequest(
          `Invalid startDate: expected ISO date YYYY-MM-DD, got ${startDateRaw}`
        );
      }
    }
    if (endDateRaw) {
      const parsed = dateParam.safeParse(endDateRaw);
      if (!parsed.success) {
        return errors.badRequest(
          `Invalid endDate: expected ISO date YYYY-MM-DD, got ${endDateRaw}`
        );
      }
    }
    const startDate = startDateRaw;
    const endDate = endDateRaw;
    const platform = url.searchParams.get('platform') || undefined;
    // PR-4b (13th audit P0-6): `?page=abc` must fall back to 1, not NaN.
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 50, 100);

    const result = await riderUseCases.listEarnings(riderId, {
      startDate,
      endDate,
      platform,
      page,
      limit,
    });

    const formatted = result.earnings.map((e: any) => ({
      id: e.id,
      date: e.date,
      platform: e.platform,
      amount: e.amount,
      trips: e.trips,
      distance: e.distance,
      hoursOnline: e.hoursOnline,
      notes: e.notes,
      createdAt: e.createdAt,
    }));

    return success(
      { earnings: formatted, weeklySummary: result.weeklySummary, pagination: result.pagination },
      undefined,
      200
    );
  } catch (error) {
    logger.error('GET /api/rider/earnings error:', error);
    return errors.internal('Failed to fetch earnings');
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRiderSession(req);
  if (auth instanceof Response) return auth;
  const riderId = auth.riderDbId;

  try {
    const body = await req.json();
    const validation = validateBody(createEarningSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    const earning = await riderUseCases.createEarning(riderId, validation.data);
    return success(earning, 'Earning added', 201);
  } catch (error) {
    logger.error('POST /api/rider/earnings error:', error);
    return errors.internal('Failed to add earning');
  }
}
