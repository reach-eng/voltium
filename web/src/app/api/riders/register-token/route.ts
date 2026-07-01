import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { validateBody, registerTokenSchema } from '@/lib/validators';
import { getRiderId } from '@/lib/get-session';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';

export async function POST(req: NextRequest) {
  try {
    const session = await getRiderId(req);
    if (!session) return errors.unauthorized('Authentication required');

    const body = await req.json();
    const validation = validateBody(registerTokenSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    // riderId (BLOCKER 1.2) is derived from the verified session, not the
    // request body. The client never needs to know its own dbId.
    const { fcmToken } = validation.data;
    await riderUseCases.registerFcmToken(session, fcmToken);
    logger.info('[TokenRegistration] FCM token updated for rider', { riderId: session });

    return success(null, 'Token registered successfully');
  } catch (error: unknown) {
    if ((error instanceof Error ? error.message : String(error)) === 'Rider not found') return errors.notFound('Rider not found');
    logger.error('[TokenRegistration] Error registering token:', error);
    return errors.internal('Failed to register device token');
  }
}
