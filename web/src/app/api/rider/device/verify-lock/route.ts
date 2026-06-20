import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { z } from 'zod';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { checkRateLimit } from '@/lib/rate-limit';
import { logSecurityEvent } from '@/lib/security-events';

const verifyLockSchema = z.object({
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    let body;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid request body');
    }

    const validation = verifyLockSchema.safeParse(body);
    if (!validation.success) {
      return errors.validation(validation.error.message);
    }

    const { password } = validation.data;
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    // Rate limit: 5 attempts per minute
    const rateLimit = await checkRateLimit(`verify-lock:${riderDbId}`, {
      windowMs: 60 * 1000,
      maxRequests: 5,
    });
    if (!rateLimit.allowed) {
      await logSecurityEvent({
        type: 'rider.verify_lock_password_rate_limit',
        severity: 'critical',
        actorId: riderDbId,
        actorType: 'RIDER',
        details: {
          message: 'Rate limit exceeded for lock password verification',
        },
        ip: clientIp,
      });
      return errors.tooManyRequests('Too many unlock attempts. Try again in a minute.');
    }

    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: { lockPassword: true },
    });

    if (!rider || !rider.lockPassword) {
      return success({ success: false }, 'Lock password is not configured');
    }

    const valid = await verifyPassword(password, rider.lockPassword);

    await logSecurityEvent({
      type: 'rider.verify_lock_password',
      severity: valid ? 'info' : 'warning',
      actorId: riderDbId,
      actorType: 'RIDER',
      details: {
        success: valid,
      },
      ip: clientIp,
    });

    return success({ success: valid }, valid ? 'Verification successful' : 'Incorrect password');
  } catch (err) {
    logger.error('[POST /api/rider/device/verify-lock]', err);
    return errors.internal('Verification failed');
  }
}
