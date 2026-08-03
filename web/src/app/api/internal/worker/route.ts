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

const WORKER_SECRET = process.env.WORKER_SECRET;

export async function POST(request: NextRequest) {
  if (!WORKER_SECRET) {
    // PR-61: use APP_ENV (the deploy env) rather than NODE_ENV
    // (the Next.js optimizer flag) — see fix(security) PR-60 for the
    // same change in get-session.ts.
    if (process.env.APP_ENV === 'production') {
      return NextResponse.json({ error: 'Worker endpoint not configured' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authHeader = request.headers.get('authorization') || '';
  // PR-61: use constant-time compare via SHA-256 hashing. The previous
  // plain string equality `authHeader !== \`Bearer ${WORKER_SECRET}\``
  // leaked the secret length via timing differences and would have
  // thrown on a 1-byte WORKER_SECRET (timingSafeEqual requires equal
  // lengths). Hashing both inputs to fixed 32-byte buffers fixes both
  // at once. The pattern is the same as `cron-auth.ts:33-35`.
  const token = /^bearer\s+(.+)$/i.exec(authHeader)?.[1] ?? '';
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (token.length > 1024) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tokenHash = createHash('sha256').update(token).digest();
  const secretHash = createHash('sha256').update(WORKER_SECRET).digest();
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
