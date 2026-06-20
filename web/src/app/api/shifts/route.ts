import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { shiftUseCases } from '@/server/modules/shifts/shift.use-cases';

export async function GET(request: NextRequest) {
  try {
    const hubId = request.nextUrl.searchParams.get('hubId');
    const date = request.nextUrl.searchParams.get('date') || undefined;

    if (!hubId) return errors.validation('hubId is required');

    if (date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) return errors.validation('date must be in YYYY-MM-DD format');
    }

    const result = await shiftUseCases.getShifts(hubId, date);
    return success(result, 'Shifts fetched successfully');
  } catch (err: any) {
    if (err.message === 'Hub not found') return errors.notFound(err.message);
    if (err.message === 'Hub is currently inactive') return errors.badRequest(err.message);
    logger.error('[GET /api/shifts]', err);
    return errors.internal('Failed to fetch shifts');
  }
}
