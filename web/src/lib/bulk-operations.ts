/**
 * Bulk Operations Utility
 *
 * Provides non-blocking, bounded-concurrency execution with periodic event loop
 * yielding for large administrative bulk operations.
 */

export const DEFAULT_BULK_CONCURRENCY = 5;
export const MAX_BULK_BATCH_SIZE = 100;

/**
 * Yield to the Node.js event loop to prevent starvation during long-running iterations.
 */
export function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Executes async tasks over an array with bounded concurrency and preserves input order.
 * Periodically yields to the event loop every `yieldInterval` iterations.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number = DEFAULT_BULK_CONCURRENCY,
  fn: (item: T, index: number) => Promise<R>,
  yieldInterval: number = 10
): Promise<R[]> {
  if (!items || items.length === 0) return [];

  const results = new Array<R>(items.length);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      if (idx > 0 && idx % yieldInterval === 0) {
        await yieldEventLoop();
      }
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  return results;
}
