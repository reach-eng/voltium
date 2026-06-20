import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { validateBody, registerTokenSchema } from '@/lib/validators';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(registerTokenSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { riderId, fcmToken } = validation.data;

    await riderUseCases.registerFcmToken(riderId, fcmToken);
    logger.info('[TokenRegistration] FCM token updated for rider', { riderId });

    return success(null, 'Token registered successfully');
  } catch (error: any) {
    if (error.message === 'Rider not found') return errors.notFound('Rider not found');
    logger.error('[TokenRegistration] Error registering token:', error);
    return errors.internal('Failed to register device token');
  }
}
