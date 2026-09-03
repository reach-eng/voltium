import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { checkRateLimit } from '@/lib/rate-limit';
import { logSecurityEvent } from '@/lib/security-events';
import { rateLimitIdentifierFromRequest } from '@/lib/rate-limit-middleware';
import { redactPii } from '@/lib/pii-redact';

const setLockSchema = z.object({
  password: z.string().regex(/^\d{4}$/, 'Must be a 4-digit PIN'),
});

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get('x-rider-id')) {
      return errors.forbidden('Impersonation is strictly forbidden on lock configuration');
    }
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    let body;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid request body');
    }

    const validation = setLockSchema.safeParse(body);
    if (!validation.success) {
      return errors.validation(validation.error.message);
    }

    const { password } = validation.data;
    const clientIp = rateLimitIdentifierFromRequest(request).replace(/^ip:/, '');

    // Rate limit: 5 attempts per minute per rider
    const rateLimit = await checkRateLimit(`set-lock:${riderDbId}`, {
      windowMs: 60 * 1000,
      maxRequests: 5,
    });
    if (!rateLimit.allowed) {
      await logSecurityEvent({
        type: 'rider.set_lock_password_rate_limit',
        severity: 'critical',
        actorId: riderDbId,
        actorType: 'RIDER',
        details: {
          message: 'Rate limit exceeded for lock password setting',
        },
        ip: clientIp,
      });
      return errors.tooManyRequests('Too many attempts. Try again in a minute.');
    }

    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: { id: true },
    });

    if (!rider) {
      return errors.notFound('Rider not found');
    }

    const hashedPassword = await hashPassword(password);

    await db.rider.update({
      where: { id: riderDbId },
      data: { lockPasswordHash: hashedPassword },
    });

    await logSecurityEvent({
      type: 'rider.set_lock_password',
      severity: 'info',
      actorId: riderDbId,
      actorType: 'RIDER',
      details: {
        success: true,
      },
      ip: clientIp,
    });

    return success({ updated: true }, 'Lock password updated successfully');
  } catch (err) {
    logger.error('[POST /api/rider/device/set-lock]', redactPii(err));
    return errors.internal('Failed to update lock password');
  }
}
