/**
 * POST /api/internal/worker — Process queued jobs (SMS, referral rewards, etc.)
 *
 * Thin route handler: auth + delegate + respond.
 * Business logic lives in JobQueue process methods and referral reward use-cases.
 */

import { NextRequest, NextResponse } from 'next/server';
import { JobQueue, JobTypes } from '@/lib/job-queue';
import { sendSms } from '@/lib/sms-provider';
import { logger } from '@/lib/logger';
import { referralUseCases } from '@/server/modules/referrals/referral.use-cases';

const WORKER_SECRET = process.env.WORKER_SECRET;

export async function POST(request: NextRequest) {
  if (!WORKER_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Worker endpoint not configured' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${WORKER_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Process SMS Jobs
    await JobQueue.processJobs(JobTypes.SEND_SMS, async (job) => {
      const { phone, message } = job.payload as { phone: string; message: string };
      const success = await sendSms(phone, message);
      if (!success) throw new Error('SMS Provider failure');
    });

    // 2. Process Referral Reward Jobs — delegate to use-case
    await JobQueue.processJobs(JobTypes.REFERRAL_REWARD, async (job) => {
      const { refereeId, referrerCode } = job.payload as { refereeId: string; referrerCode: string };
      await referralUseCases.processReferralReward(refereeId, referrerCode);
    });

    return NextResponse.json({ success: true, processedAt: new Date().toISOString() });
  } catch (error) {
    logger.error('[Worker] Job processing failed', error);
    return NextResponse.json({ error: 'Worker failure' }, { status: 500 });
  }
}
