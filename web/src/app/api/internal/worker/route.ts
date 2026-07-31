/**
 * POST /api/internal/worker — Process queued jobs (SMS, referral rewards, etc.)
 *
 * Thin route handler: auth + delegate + respond.
 * Business logic lives in JobQueue process methods and referral reward use-cases.
 */

import { NextRequest, NextResponse } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { JobQueue } from '@/lib/job-queue';
import { OutboxEventTypes } from '@/server/workers/outbox';
import { sendSms } from '@/lib/sms-provider';
import { logger } from '@/lib/logger';
import { ValidationError } from "@/lib/api-error";

const WORKER_SECRET = process.env.WORKER_SECRET;

export async function POST(request: NextRequest) {
  // Always require WORKER_SECRET to be configured, in any env. Previously,
  // non-prod with no WORKER_SECRET returned 401, but an attacker could send
  // `Authorization: Bearer undefined` to get a 200 from the bypass path.
  // Now: 503 (service unavailable) if the secret is not configured.
  if (!WORKER_SECRET) {
    return NextResponse.json({ error: 'Worker endpoint not configured' }, { status: 503 });
  }

  // Use timing-safe compare to avoid leaking the secret length.
  const authHeader = request.headers.get('authorization') || '';
  const expected = `Bearer ${WORKER_SECRET}`;
  const authBuf = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(expected);
  if (
    authBuf.length !== expectedBuf.length ||
    !require('crypto').timingSafeEqual(authBuf, expectedBuf)
  ) {
    return errors.unauthorized();
  }

  try {
    // Process pending jobs from the PostgreSQL-backed outbox queue
    await JobQueue.processJobs(OutboxEventTypes.SMS_SEND, async (job) => {
      const { phone, message } = job.payload as { phone: string; message: string };
      const smsResult = await sendSms(phone, message);
      if (!smsResult) throw new ValidationError('SMS Provider failure');
    });

    return success({ processedAt: new Date().toISOString() });
  } catch (error) {
    logger.error('[Worker] Job processing failed', error);
    return errors.internal('Worker failure');
  }
}
