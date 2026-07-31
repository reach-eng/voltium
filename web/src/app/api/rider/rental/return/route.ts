import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
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

    const result = await riderUseCases.updateProfile(session.riderDbId, {
      returnPending: true,
      returnPhotos:
        body.returnPhotos ||
        [body.photoLeft, body.photoRight, body.photoFront, body.photoSpeedometer].filter(Boolean),
      latitude: body.latitude,
      longitude: body.longitude,
      returnReason: body.reason || 'End of rental',
    });
    return success(result, 'Return request submitted');
  } catch (error) {
    logger.error('[POST /api/rider/rental/return]', error);
    if (error instanceof Error && error.message.includes('No vehicle')) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to submit return request');
  }
}
