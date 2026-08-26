/**
 * Job Wrapper — Decorates background jobs with DLQ persistence + alert logic.
 */

import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

export interface JobGuardOptions {
  name: string;
  notifyOnFailure?: boolean;
}

export function withJobGuards<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: JobGuardOptions
): T {
  const notifyOnFailure = options.notifyOnFailure ?? true;

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (err) {
      logger.error(`[ALERT] Background job failed: ${options.name}`, err);

      try {
        await (db as any).failedJob.create({
          data: {
            jobName: options.name,
            error: err instanceof Error ? err.message : String(err),
            failedAt: new Date(),
          },
        });
      } catch (dbErr) {
        logger.error('[withJobGuards] Failed to persist to failedJob', dbErr);
      }

      if (notifyOnFailure) {
        logger.warn(`[ALERT] High-priority notification for failed job: ${options.name}`);
      }

      throw err;
    }
  }) as T;
}
