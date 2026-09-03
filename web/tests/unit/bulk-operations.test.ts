import { describe, it, expect } from 'vitest';
import { mapWithConcurrency, yieldEventLoop, MAX_BULK_BATCH_SIZE } from '@/lib/bulk-operations';

describe('Bulk Operations & Event Loop Offloading', () => {
  it('mapWithConcurrency processes all items and preserves order', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = await mapWithConcurrency(items, 3, async (item) => {
      // Simulate variable execution duration
      await new Promise((resolve) => setTimeout(resolve, item % 2 === 0 ? 5 : 1));
      return item * 2;
    });

    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
  });

  it('mapWithConcurrency bounds active concurrent workers', async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    let activeWorkers = 0;
    let maxObservedWorkers = 0;

    await mapWithConcurrency(items, 4, async (item) => {
      activeWorkers++;
      maxObservedWorkers = Math.max(maxObservedWorkers, activeWorkers);
      await new Promise((resolve) => setTimeout(resolve, 2));
      activeWorkers--;
      return item;
    });

    expect(maxObservedWorkers).toBeLessThanOrEqual(4);
    expect(activeWorkers).toBe(0);
  });

  it('yieldEventLoop returns a resolved promise via setImmediate', async () => {
    let yielded = false;
    const promise = yieldEventLoop().then(() => {
      yielded = true;
    });
    expect(yielded).toBe(false);
    await promise;
    expect(yielded).toBe(true);
  });

  it('handles empty input gracefully', async () => {
    const results = await mapWithConcurrency([], 4, async (x) => x);
    expect(results).toEqual([]);
  });

  it('defines safe maximum batch size limit', () => {
    expect(MAX_BULK_BATCH_SIZE).toBe(100);
  });
});
