/**
 * POST /api/internal/worker — Process queued jobs (SMS, referral rewards, etc.)
 *
 * Thin route handler: auth + delegate + respond.
 * Business logic lives in JobQueue process methods and referral reward use-cases.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { JobQueue } from '@/lib/job-queue';
import { OutboxEventTypes } from '@/server/workers/outbox';
import { sendSms } from '@/lib/sms-provider';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerSecret) {
    // PR-61: fail closed on production and staging
    if (process.env.APP_ENV === 'production' || process.env.APP_ENV === 'staging') {
      return NextResponse.json({ error: 'Worker endpoint not configured' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authHeader = request.headers.get('authorization') || '';
  // PR-61: use constant-time compare via SHA-256 hashing.
  const token = /^bearer\s+(.+)$/i.exec(authHeader)?.[1] ?? '';
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (token.length > 1024) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tokenHash = createHash('sha256').update(token).digest();
  const secretHash = createHash('sha256').update(workerSecret).digest();
  if (!timingSafeEqual(tokenHash, secretHash)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // PR-75: SMS dispatch is classified as 'interactive' — a 1-second
    // job that must not be starved by a 10-minute background cleanup.
    // The claim query filters to priority='interactive' so this route
    // can never pick up a background event. The orchestrator
    // (web/src/server/workers/index.ts) still drives SMS dispatch in
    // the normal flow; this route is the manual trigger / fallback.
    await JobQueue.processJobs(
      OutboxEventTypes.SMS_SEND,
      async (job) => {
        const { phone, message } = job.payload as { phone: string; message: string };
        const success = await sendSms(phone, message);
        if (!success) throw new Error('SMS Provider failure');
      },
      5,
      'interactive'
    );

    return NextResponse.json({ success: true, processedAt: new Date().toISOString() });
  } catch (error) {
    logger.error('[Worker] Job processing failed', error);
    return NextResponse.json({ error: 'Worker failure' }, { status: 500 });
  }
}
