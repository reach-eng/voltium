import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, createEarningSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { getRiderId } from '@/lib/get-session';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';

export async function GET(req: NextRequest) {
  const riderId = await getRiderId(req);
  if (!riderId) return errors.unauthorized();

  try {
    const url = req.nextUrl;
    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;
    const platform = url.searchParams.get('platform') || undefined;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50')), 100);

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
  const riderId = await getRiderId(req);
  if (!riderId) return errors.unauthorized();

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
