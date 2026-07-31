import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { hubUseCases } from '@/server/modules/hubs/hub.use-cases';

import { getOrSetResponse } from '@/lib/cache';

/**
 * GET /api/rider/hubs — list active hubs (rider-accessible, no admin auth required).
 *
 * This is the rider-facing endpoint for fetching hub locations during pickup flow.
 * It returns only active hubs with basic info (no vehicle breakdowns).
 */
export async function GET(_req: NextRequest) {
  try {
    const hubs = await getOrSetResponse('rider_hubs', async () => hubUseCases.listHubs(), 600);
    return success(hubs);
  } catch (error) {
    logger.error('GET /api/rider/hubs error:', error);
    return errors.internal('Failed to fetch hubs');
  }
}
