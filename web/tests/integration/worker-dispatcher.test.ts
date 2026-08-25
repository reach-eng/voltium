import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { testDb } from '../_setup/test-postgres';
import { JobQueue } from '../../src/lib/job-queue';
import { OutboxService } from '../../src/server/workers/outbox';
import { clock } from '../../src/lib/clock';

describe('Worker Dispatcher & JobQueue Integration', () => {
  beforeAll(async () => {
  });

  afterAll(async () => {
  });

  beforeEach(async () => {
    await testDb.outboxEvent.deleteMany();
    clock.reset();
  });

  it('demonstrates job enqueueing, processing, and state machine transitions', async () => {
    // 1. Enqueue job
    const eventId = await OutboxService.emit('test.job', { foo: 'bar' });
    
    const initialEvent = await testDb.outboxEvent.findUnique({ where: { id: eventId } });
    expect(initialEvent?.status).toBe('PENDING');
    expect(initialEvent?.attempts).toBe(0);

    // 2. Worker picks it up and processes successfully
    let processedJob: any = null;
    await JobQueue.processJobs('test.job', async (job) => {
      processedJob = job;
      // succeeds
    });

    expect(processedJob).toBeDefined();
    expect(processedJob?.payload.foo).toBe('bar');

    // 3. Successful completion
    const completedEvent = await testDb.outboxEvent.findUnique({ where: { id: eventId } });
    expect(completedEvent?.status).toBe('COMPLETED');
    expect(completedEvent?.attempts).toBe(1);
    expect(completedEvent?.readyAt).toBeNull();
  });

  it('demonstrates retry on failure with injected clock backoff', async () => {
    // Inject a deterministic clock so the backoff check below doesn't
    // race the wall clock. The shared `clock.set()` takes a Clock impl,
    // not a number, so we wrap a mutable Date in a small adapter.
    const fixedNow = new Date('2026-01-01T00:00:00.000Z');
    const fixedClock = { now: () => fixedNow };
    clock.set(fixedClock);

    try {
      // 1. Enqueue job with maxAttempts = 3
      const eventId = await OutboxService.emit('test.retry', { fail: true }, 3);

      // 2. First attempt fails
      await JobQueue.processJobs('test.retry', async () => {
        throw new Error('Simulated failure');
      });

      const failedEvent1 = await testDb.outboxEvent.findUnique({ where: { id: eventId } });
      expect(failedEvent1?.status).toBe('PENDING'); // Still pending because it will retry
      expect(failedEvent1?.attempts).toBe(1);
      expect(failedEvent1?.error).toBe('Simulated failure');
      expect(failedEvent1?.readyAt).not.toBeNull();

      // Check backoff (2^1 * 5000 = 10000ms).
      const expectedReadyAt = fixedNow.getTime() + 10000;
      const actualReadyAt = failedEvent1?.readyAt?.getTime() ?? 0;
      expect(Math.abs(actualReadyAt - expectedReadyAt)).toBeLessThan(2000);

      // 3. If we try to process immediately, it should NOT pick it up
      //    because readyAt is in the future.
      let pickedUp = false;
      await JobQueue.processJobs('test.retry', async () => {
        pickedUp = true;
      });
      expect(pickedUp).toBe(false);

      // 4. Time travel past readyAt
      fixedNow.setTime(fixedNow.getTime() + 10001);

      // 5. Picked up again and fails again
      await JobQueue.processJobs('test.retry', async () => {
        throw new Error('Simulated failure 2');
      });

      const failedEvent2 = await testDb.outboxEvent.findUnique({ where: { id: eventId } });
      expect(failedEvent2?.status).toBe('PENDING');
      expect(failedEvent2?.attempts).toBe(2);

      // Check new backoff (2^2 * 5000 = 20000ms). Allow ±2s skew.
      const expectedReadyAt2 = fixedNow.getTime() + 20000;
      const actualReadyAt2 = failedEvent2?.readyAt?.getTime() ?? 0;
      expect(Math.abs(actualReadyAt2 - expectedReadyAt2)).toBeLessThan(2000);

      // 6. Time travel again and fail a third time (maxAttempts reached)
      fixedNow.setTime(fixedNow.getTime() + 20001);

      await JobQueue.processJobs('test.retry', async () => {
        throw new Error('Simulated failure 3');
      });

      const finalEvent = await testDb.outboxEvent.findUnique({ where: { id: eventId } });
      expect(finalEvent?.status).toBe('FAILED'); // Now it should be FAILED
      expect(finalEvent?.attempts).toBe(3);
      expect(finalEvent?.readyAt).toBeNull();
    } finally {
      // Always reset so subsequent tests use the real clock.
      clock.reset();
    }
  });
});
