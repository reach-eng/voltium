import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function recordJobRun(
  jobId: string,
  status: 'SUCCESS' | 'FAILED' | 'RUNNING',
  details?: string | Record<string, unknown> | null,
  error?: string | null
): Promise<void> {
  try {
    const key = `job:last_run:${jobId}`;
    const value = JSON.stringify({
      timestamp: new Date().toISOString(),
      status,
      details:
        typeof details === 'object' && details !== null
          ? JSON.stringify(details)
          : details ?? null,
      error: error ?? null,
    });

    await db.systemSetting.upsert({
      where: { key },
      create: { key, value, category: 'BACKGROUND_JOB', valueType: 'JSON' },
      update: { value },
    });
  } catch (err) {
    logger.error(`Failed to record job run for ${jobId}:`, err);
  }
}
