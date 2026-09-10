import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { deviceComplianceUseCases } from '@/server/modules/device-compliance/device-compliance.use-cases';

const reportViolationSchema = z.object({
  permissionId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const deviceState = await deviceComplianceUseCases.getDeviceState(riderDbId);
    if (!deviceState) return errors.notFound('Rider not found');

    return success(deviceState);
  } catch (err) {
    logger.error('[GET /api/rider/device]', err);
    return errors.internal('Failed to fetch device security flags');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    // P1-4 (device-tracking audit, 2026-09-08): rider-scoped rate
    // limit on the violation-report path. The previous code
    // accepted unlimited reports per minute, which — combined
    // with the 6/session client-side backoff — still let a
    // compromised token create many ACTIVE rows (now blocked
    // by the P1-3 server-side dedupe) and inflate the counter
    // (now resolved by P1-3's resolve-on-grant). 5/min is
    // well above the expected failure rate.
    const rl = await checkRateLimit(`rider-device-violation:${riderDbId}`, {
      windowMs: 60_000,
      maxRequests: 5,
    });
    if (!rl.allowed) {
      return errors.tooManyRequests('Too many violation reports. Try again in a minute.');
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid request body');
    }

    const validation = reportViolationSchema.safeParse(body);
    if (!validation.success) return errors.validation(validation.error.message);

    const { permissionId } = validation.data;
    await deviceComplianceUseCases.reportViolation(riderDbId, permissionId);

    return success({ permissionId, reportedAt: new Date().toISOString() }, 'Violation reported');
  } catch (err) {
    logger.error('[POST /api/rider/device]', err);
    return errors.internal('Failed to report device violation');
  }
}
