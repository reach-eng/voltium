import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitIdentifierFromRequest } from '@/lib/rate-limit-middleware';
import { shiftUseCases } from '@/server/modules/shifts/shift.use-cases';

// This endpoint is public by design (rider shift view) — no session required.
// PR-9 (2026-08-06 fix plan): the rate limit prevents scraping/abuse.
export async function GET(request: NextRequest) {
  try {
    // Per-IP limit: 30 requests / 60s is generous for a rider checking
    // shift availability, but blocks automated scraping of hub schedules.
    const identifier = rateLimitIdentifierFromRequest(request);
    const rl = await checkRateLimit(`public:shifts:${identifier}`, {
      windowMs: 60_000,
      maxRequests: 30,
    });
    if (!rl.allowed) {
      return errors.tooManyRequests('Too many requests. Please try again later.');
    }

    const hubId = request.nextUrl.searchParams.get('hubId');
    const date = request.nextUrl.searchParams.get('date') || undefined;

    if (!hubId) return errors.validation('hubId is required');

    if (date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) return errors.validation('date must be in YYYY-MM-DD format');
    }

    const result = await shiftUseCases.getShifts(hubId, date);
    return success(result, 'Shifts fetched successfully');
  } catch (err: unknown) {
    if ((err instanceof Error ? err.message : String(err)) === 'Hub not found') return errors.notFound((err instanceof Error ? err.message : String(err)));
    if ((err instanceof Error ? err.message : String(err)) === 'Hub is currently inactive') return errors.badRequest((err instanceof Error ? err.message : String(err)));
    logger.error('[GET /api/shifts]', err);
    return errors.internal('Failed to fetch shifts');
  }
}
