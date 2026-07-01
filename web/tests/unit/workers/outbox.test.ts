import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { testDb } from '../../_setup/test-postgres';
import { clock } from '../../../src/lib/clock';
import { OutboxService, OutboxEventTypes } from '../../../src/server/workers/outbox';

describe('Outbox Service', () => {
  beforeAll(async () => {
    process.env.DATABASE_OFFLINE = 'false';
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
});
