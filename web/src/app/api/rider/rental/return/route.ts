import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { submitReturn } from '@/server/modules/rentals/use-cases/submitReturn';
import { RentalReturnError } from '@/server/modules/rentals/use-cases/errors';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const returnSchema = z
  .object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    reason: z.string().optional(),
    returnPhotos: z.array(z.string()).optional(),
    photoLeft: z.string().optional(),
    photoRight: z.string().optional(),
    photoFront: z.string().optional(),
    photoSpeedometer: z.string().optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const session = await requireRiderSession(request);
    if (session instanceof Response) return session;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid JSON body');
    }

    const parseResult = returnSchema.safeParse(body);
    if (!parseResult.success) {
      return errors.validation('Invalid fields in request body');
    }

    // Resolve photo URLs — accept either `returnPhotos` array (preferred) or
    // the four named fields for back-compat with the original schema.
    const photos =
      body.returnPhotos ||
      [body.photoLeft, body.photoRight, body.photoFront, body.photoSpeedometer].filter(
        (p: unknown): p is string => typeof p === 'string' && p.length > 0
      );

    // PR-26b: delegate to the dedicated use case instead of
    // `riderUseCases.updateProfile`. The use case enforces cross-entity
    // invariants (rider in ACTIVE state, >=4 photos, has assigned vehicle)
    // that the old chokepoint silently bypassed.
    const result = await submitReturn(session.riderDbId, {
      photoUrls: photos,
      reason: body.reason,
      latitude: body.latitude,
      longitude: body.longitude,
    });

    return success(result, 'Return request submitted');
  } catch (error) {
    logger.error('[POST /api/rider/rental/return]', error);
    if (error instanceof RentalReturnError) {
      // Map known codes to appropriate HTTP status codes
      switch (error.code) {
        case 'PHOTOS_REQUIRED':
        case 'NO_VEHICLE':
        case 'INVALID_STATE':
        case 'RIDER_NOT_FOUND':
          return errors.badRequest(error.message);
        case 'RACE_CONDITION':
          return errors.conflict(error.message);
        default:
          return errors.badRequest(error.message);
      }
    }
    return errors.internal('Failed to submit return request');
  }
}
