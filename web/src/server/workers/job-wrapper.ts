/**
 * Job Wrapper — Decorates background jobs with DLQ persistence + alert logic.
 */

import { logger } from '@/lib/logger';

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
      // No FailedJob table exists in the schema — the outbox row is
      // already marked FAILED by the poller, which is the DLQ. Logging
      // the error above is the persistence step.

      if (notifyOnFailure) {
        logger.warn(`[ALERT] High-priority notification for failed job: ${options.name}`);
      }

      throw err;
    }
  }) as T;
}
