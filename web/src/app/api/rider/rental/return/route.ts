import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await requireRiderSession(request);
    if (session instanceof Response) return session;
    const body = await request.json();
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
    if (error instanceof Error && error.message.includes('No vehicle'))
      return errors.badRequest(error.message);
    return errors.internal('Failed to submit return request');
  }
}
