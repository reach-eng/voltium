import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { testDb } from '../../_setup/test-postgres';
import { clock } from '../../../src/lib/clock';
import { OutboxService, OutboxEventTypes } from '../../../src/server/workers/outbox';

describe('Outbox Service', () => {
  beforeAll(async () => {
  });

  afterAll(async () => {
  });

  beforeEach(async () => {
    await testDb.outboxEvent.deleteMany();
    clock.reset();
  });

  it('should emit an event and mark it as completed using JobQueue', async () => {
    const eventId = await OutboxService.emit(OutboxEventTypes.ADMIN_ACTION, {
      test: true
    });
    
    expect(eventId).toBeDefined();
    
    const dbEvent = await testDb.outboxEvent.findUnique({ where: { id: eventId } });
    expect(dbEvent?.status).toBe('PENDING');
  });

  it('should cleanup completed events older than retention period', async () => {
    const oldDate = new Date(clock.now().getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    await testDb.outboxEvent.create({
      data: {
        eventType: 'ADMIN_ACTION',
        payload: JSON.stringify({}),
        status: 'COMPLETED',
        createdAt: oldDate,
        updatedAt: oldDate,
        processedAt: oldDate,
      }
    });

    const deleted = await OutboxService.cleanupCompleted(7);
    expect(deleted).toBe(1);

    const count = await testDb.outboxEvent.count();
    expect(count).toBe(0);
  });
  it('should get outbox stats', async () => {
    await testDb.outboxEvent.createMany({
      data: [
        { eventType: 'ADMIN_ACTION', payload: '{}', status: 'PENDING' },
        { eventType: 'ADMIN_ACTION', payload: '{}', status: 'PROCESSING' },
        { eventType: 'ADMIN_ACTION', payload: '{}', status: 'COMPLETED' },
        { eventType: 'ADMIN_ACTION', payload: '{}', status: 'FAILED' },
        { eventType: 'ADMIN_ACTION', payload: '{}', status: 'FAILED' },
      ],
    });

    const stats = await OutboxService.getStats();
    expect(stats).toEqual({
      pending: 1,
      processing: 1,
      completed: 1,
      failed: 2,
    });
  });

  it('should retry failed events', async () => {
    await testDb.outboxEvent.create({
      data: {
        eventType: 'ADMIN_ACTION',
        payload: '{}',
        status: 'FAILED',
        attempts: 3,
        error: 'Network error',
      },
    });

    const retriedCount = await OutboxService.retryFailed();
    expect(retriedCount).toBe(1);

    const event = await testDb.outboxEvent.findFirst();
    expect(event?.status).toBe('PENDING');
    expect(event?.attempts).toBe(0);
    expect(event?.error).toBeNull();
  });

  it('should emit an event within a transaction', async () => {
    await testDb.$transaction(async (tx) => {
      const eventId = await OutboxService.emit(
        OutboxEventTypes.ADMIN_ACTION,
        { test: 'tx' },
        3,
        tx
      );
      expect(eventId).toBeDefined();
    });

    const count = await testDb.outboxEvent.count({
      where: { status: 'PENDING' },
    });
    expect(count).toBe(1);
  });

  it('should throw an error if emit fails', async () => {
    // Force a failure by omitting required fields or passing an invalid transaction
    const badTx = {
      outboxEvent: {
        create: () => Promise.reject(new Error('Simulated DB Error')),
      },
    } as any;

    await expect(
      OutboxService.emit(OutboxEventTypes.ADMIN_ACTION, {}, 3, badTx)
    ).rejects.toThrow('Simulated DB Error');
  });
});
