import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
import { logger } from '@/lib/logger';

import { z } from 'zod';

// Strict object — reject any field not in the allowlist. This is a defense
// against mass-assignment: even if a future caller adds a new profile field,
// an attacker can't smuggle it through this route.
const returnSchema = z
  .object({
    returnPhotos: z.array(z.string()).optional(),
    photoLeft: z.string().optional(),
    photoRight: z.string().optional(),
    photoFront: z.string().optional(),
    photoSpeedometer: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    reason: z.string().max(500).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const session = await requireRiderSession(request);
    if (session instanceof Response) return session;

    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return errors.badRequest('Invalid JSON body');
    }

    const validation = returnSchema.safeParse(rawBody);
    if (!validation.success) {
      return errors.validation(validation.error.message);
    }

    const body = validation.data;
    const returnPhotos =
      body.returnPhotos ||
      [body.photoLeft, body.photoRight, body.photoFront, body.photoSpeedometer].filter(
        (p): p is string => Boolean(p)
      );

    const result = await riderUseCases.updateProfile(session.riderDbId, {
      returnPending: true,
      returnPhotos,
      latitude: body.latitude,
      longitude: body.longitude,
      returnReason: body.reason || 'End of rental',
    });
    return success(result, 'Return request submitted');
  } catch (error) {
    logger.error('[POST /api/rider/rental/return]', error);
    if (error instanceof Error && error.message.includes('No vehicle'))
      return errors.badRequest(error.message);
    return errors.internal('Failed to submit return request');
  }
}
