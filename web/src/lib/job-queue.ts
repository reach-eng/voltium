import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

// Guard: only initialize Redis if credentials are present (same pattern as rate-limit.ts)
const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = REDIS_URL && REDIS_TOKEN ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null;

const QUEUE_PREFIX = 'voltium:queue';
const JOB_TTL = 86400;

export interface QueueJob {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  createdAt: number;
  processedAt?: number;
  error?: string;
}

function createJob(type: string, payload: Record<string, unknown>): QueueJob {
  return {
    id: crypto.randomUUID(),
    type,
    payload,
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
  };
}

export const JobQueue = {
  async enqueue(type: string, payload: Record<string, unknown>, delayMs = 0): Promise<string> {
    if (!redis) {
      logger.warn('[JobQueue] Redis not configured — job not enqueued', { type });
      return createJob(type, payload).id;
    }
    const job = createJob(type, payload);
    job.createdAt = Date.now() + delayMs;

    await redis.zadd(`${QUEUE_PREFIX}:${type}`, {
      score: job.createdAt,
      member: JSON.stringify(job),
    });

    return job.id;
  },

  async enqueueBulk(
    jobs: Array<{ type: string; payload: Record<string, unknown> }>
  ): Promise<string[]> {
    if (!redis) {
      logger.warn('[JobQueue] Redis not configured — bulk jobs not enqueued');
      return jobs.map((j) => createJob(j.type, j.payload).id);
    }
    const jobIds: string[] = [];
    const now = Date.now();
    const pipeline = redis.pipeline();

    for (const job of jobs) {
      const jobData = createJob(job.type, job.payload);
      jobData.createdAt = now;

      pipeline.zadd(`${QUEUE_PREFIX}:${job.type}`, {
        score: now,
        member: JSON.stringify(jobData),
      });
      jobIds.push(jobData.id);
    }

    await pipeline.exec();
    return jobIds;
  },

  async processJobs(
    type: string,
    processor: (job: QueueJob) => Promise<void>,
    concurrency = 5
  ): Promise<void> {
    if (!redis) {
      logger.warn('[JobQueue] Redis not configured — cannot process jobs');
      return;
    }
    const processed: string[] = [];

    for (let i = 0; i < concurrency; i++) {
      const result = await redis.zpopmin(`${QUEUE_PREFIX}:${type}`);
      if (!result || result.length === 0) break;

      const [jobJson, rawScore] = result as [string, string];
      const job: QueueJob = JSON.parse(jobJson);

      if (job.createdAt > Date.now()) {
        await redis.zadd(`${QUEUE_PREFIX}:${type}`, {
          score: job.createdAt,
          member: jobJson,
        });
        continue;
      }

      job.status = 'processing';
      job.processedAt = Date.now();

      try {
        await processor(job);
        job.status = 'completed';
      } catch (error) {
        job.attempts++;
        job.status = job.attempts >= 3 ? 'failed' : 'pending';
        job.error = error instanceof Error ? error.message : 'Unknown error';
      }

      if (job.status === 'completed') {
        await redis.set(`${QUEUE_PREFIX}:job:${job.id}`, JSON.stringify(job), { ex: JOB_TTL });
        processed.push(job.id);
      } else if (job.status === 'pending') {
        await redis.zadd(`${QUEUE_PREFIX}:${type}`, {
          score: Date.now() + job.attempts * 60000,
          member: JSON.stringify(job),
        });
      } else {
        await redis.set(`${QUEUE_PREFIX}:dead:${job.id}`, JSON.stringify(job), { ex: JOB_TTL * 7 });
      }
    }
  },

  async getJobStatus(jobId: string): Promise<QueueJob | null> {
    if (!redis) return null;
    const job = await redis.get(`${QUEUE_PREFIX}:job:${jobId}`);
    return job ? JSON.parse(job as string) : null;
  },

  async getQueueStats(
    type: string
  ): Promise<{ pending: number; processing: number; failed: number }> {
    if (!redis) return { pending: 0, processing: 0, failed: 0 };
    const jobs = await redis.zrange(`${QUEUE_PREFIX}:${type}`, 0, -1);

    let pending = 0;
    let processing = 0;
    let failed = 0;

    for (const jobJson of jobs) {
      const job: QueueJob = JSON.parse(jobJson as string);
      if (job.status === 'pending') pending++;
      else if (job.status === 'processing') processing++;
      else if (job.status === 'failed') failed++;
    }

    return { pending, processing, failed };
  },

  async retryFailedJobs(type: string): Promise<number> {
    if (!redis) return 0;
    const jobs = await redis.zrange(`${QUEUE_PREFIX}:${type}`, 0, -1);
    let retried = 0;

    for (const jobJson of jobs) {
      const job: QueueJob = JSON.parse(jobJson as string);
      if (job.status === 'failed') {
        job.status = 'pending';
        job.attempts = 0;
        job.error = undefined;

        await redis.zrem(`${QUEUE_PREFIX}:${type}`, jobJson);
        await redis.zadd(`${QUEUE_PREFIX}:${type}`, {
          score: Date.now(),
          member: JSON.stringify(job),
        });
        retried++;
      }
    }

    return retried;
  },

  async clearQueue(type: string): Promise<void> {
    if (!redis) return;
    await redis.del(`${QUEUE_PREFIX}:${type}`);
  },
};

export const JobTypes = {
  SEND_SMS: 'send_sms',
  SEND_EMAIL: 'send_email',
  NOTIFICATION: 'notification',
  RIDE_REMINDER: 'ride_reminder',
  REFERRAL_REWARD: 'referral_reward',
  REFUND_PROCESSING: 'refund_processing',
};
