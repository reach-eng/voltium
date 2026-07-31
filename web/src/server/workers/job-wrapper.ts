import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

const activeJobLocks = new Set<string>();

export interface JobGuardOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  notifyOnFailure?: boolean;
}

export function withJobGuards(
  jobName: string,
  handler: () => Promise<void>,
  options: JobGuardOptions = {}
) {
  const { maxRetries = 3, retryDelayMs = 1000, notifyOnFailure = true } = options;

  return async (): Promise<void> => {
    if (activeJobLocks.has(jobName)) {
      logger.info(`[JobGuard] ${jobName} is already running in another context, skipping concurrent execution.`);
      return;
    }

    activeJobLocks.add(jobName);
    const startTime = Date.now();

    let attempt = 0;
    let success = false;
    let lastError: unknown = null;

    try {
      while (attempt < maxRetries && !success) {
        attempt++;
        try {
          logger.info(`[JobGuard] Starting job ${jobName} (attempt ${attempt}/${maxRetries})`);
          await handler();
          success = true;
          logger.info(`[JobGuard] Job ${jobName} completed successfully in ${Date.now() - startTime}ms`);
        } catch (err) {
          lastError = err;
          logger.warn(`[JobGuard] Job ${jobName} attempt ${attempt}/${maxRetries} failed:`, err);
          if (attempt < maxRetries) {
            await new Promise((res) => setTimeout(res, retryDelayMs * Math.pow(2, attempt - 1)));
          }
        }
      }

      if (!success) {
        const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
        logger.error(`[JobGuard] Job ${jobName} failed permanently after ${maxRetries} attempts`, {
          error: errorMsg,
          durationMs: Date.now() - startTime,
        });

        // Persist to FailedJob table in database as DLQ
        try {
          if (db.failedJob && typeof db.failedJob.create === 'function') {
            await db.failedJob.create({
              data: {
                jobName,
                payload: {},
                error: errorMsg,
                attempts: maxRetries,
                lastRunAt: new Date(),
              },
            });
          }
        } catch (dlqErr) {
          logger.error(`[JobGuard] Failed to persist failed job ${jobName} to DLQ table:`, dlqErr);
        }

        if (notifyOnFailure) {
          logger.error(`[ALERT] Background job failed: ${jobName}`, { error: errorMsg });
        }
      }
    } finally {
      activeJobLocks.delete(jobName);
    }
  };
}
