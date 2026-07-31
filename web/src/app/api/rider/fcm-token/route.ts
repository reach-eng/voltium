import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { validateBody } from '@/lib/validators';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const fcmTokenSchema = z.object({
  token: z.string().min(1, 'FCM token required'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireRiderSession(request);
    if (session instanceof Response) return session;

    const body = await request.json().catch(() => ({}));
    const validation = validateBody(fcmTokenSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const { token } = validation.data;
    await db.rider.update({
      where: { id: session.riderDbId },
      data: { fcmToken: token },
    });

    return success({ fcmToken: token }, 'FCM token registered successfully');
  } catch (error) {
    logger.error('[POST /api/rider/fcm-token]', error);
    return errors.internal('Failed to register FCM token');
  }
}
