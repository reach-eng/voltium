import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitIdentifierFromRequest } from '@/lib/rate-limit-middleware';
import { hubUseCases } from '@/server/modules/hubs/hub.use-cases';

/**
 * GET /api/rider/hubs — list active hubs (rider-accessible, no admin auth required).
 *
 * This is the rider-facing endpoint for fetching hub locations during pickup flow.
 * It returns only active hubs with basic info (no vehicle breakdowns).
 */
export async function GET(req: NextRequest) {
  try {
    const identifier = rateLimitIdentifierFromRequest(req);
    const rl = await checkRateLimit(`public:hubs:${identifier}`, {
      windowMs: 60_000,
      maxRequests: 60,
    });
    if (!rl.allowed) {
      return errors.tooManyRequests('Too many requests. Please try again later.');
    }

    const hubs = await hubUseCases.listHubs();
    return success(hubs);
  } catch (error) {
    logger.error('GET /api/rider/hubs error:', error);
    return errors.internal('Failed to fetch hubs');
  }
}
