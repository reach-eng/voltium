/**
 * POST /api/rental/book — Book a vehicle rental
 *
 * Thin route handler: auth + parse + call use-case + respond.
 * Business logic (availability checks, dynamic pricing, lease creation) lives in rentalUseCases.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { rentalUseCases } from '@/server/modules/rentals/rental.use-cases';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const body = await request.json();
    const { vehicleId, shiftId, leaseDate, startTime } = body;

    if (!vehicleId) return errors.validation('vehicleId is required');
    if (!shiftId) return errors.validation('shiftId is required');
    if (!leaseDate) return errors.validation('leaseDate is required (YYYY-MM-DD)');
    if (!startTime) return errors.validation('startTime is required (HH:mm)');

    // Validate date/time formats
    if (!/^\d{4}-\d{2}-\d{2}$/.test(leaseDate)) {
      return errors.validation('leaseDate must be in YYYY-MM-DD format');
    }
    if (!/^\d{2}:\d{2}$/.test(startTime)) {
      return errors.validation('startTime must be in HH:mm format');
    }

    const result = await rentalUseCases.bookRental(riderDbId, {
      vehicleId,
      shiftId,
      leaseDate,
      startTime,
    });

    return success(result, 'Vehicle booked successfully');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to book rental';

    if (message.includes('not found')) return errors.notFound(message);
    if (
      message.includes('not available') ||
      message.includes('fully booked') ||
      message.includes('already have')
    ) {
      return errors.conflict(message);
    }
    if (message.includes('format') || message.includes('required') || message.includes('invalid')) {
      return errors.validation(message);
    }
    if (typeof message === 'string' && message.includes('Unique constraint')) {
      return errors.conflict('This vehicle is already booked for this shift on the selected date');
    }

    logger.error('[POST /api/rental/book]', err);
    return errors.internal('Failed to book rental');
  }
}
