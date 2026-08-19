import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { validateBody, registerTokenSchema } from '@/lib/validators';
import { requireRiderSession } from '@/lib/rider-auth';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';

// PR-M (Ticket #26.1) — moved from /api/riders/register-token (plural) to
// /api/rider/register-token (singular) to align with the rest of the rider API.
// The original route predated the rider/ directory migration and was the only
// leftover plural route.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRiderSession(req);
    if (auth instanceof Response) return auth;

    const body = await req.json();
    const validation = validateBody(registerTokenSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    // riderId (BLOCKER 1.2) is derived from the verified session, not the
    // request body. The client never needs to know its own dbId.
    const { fcmToken } = validation.data;
    await riderUseCases.registerFcmToken(auth.riderDbId, fcmToken);
    logger.info('[TokenRegistration] FCM token updated for rider', { riderId: auth.riderDbId });

    return success(null, 'Token registered successfully');
  } catch (error: unknown) {
    if ((error instanceof Error ? error.message : String(error)) === 'Rider not found') return errors.notFound('Rider not found');
    logger.error('[TokenRegistration] Error registering token:', error);
    return errors.internal('Failed to register device token');
  }
}
