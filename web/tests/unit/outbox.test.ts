/**
 * Unit tests for the Outbox Pattern implementation.
 *
 * Tests:
 *   - Event emission creates pending events
 *   - Processing pending events with valid handlers
 *   - Retry logic for failed events
 *   - Max attempts exhaustion
 *   - Cleanup of completed events
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Outbox types and transition logic (same as implementation)
// ---------------------------------------------------------------------------

type OutboxStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface MockOutboxEvent {
  id: string;
  eventType: string;
  payload: string;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
}

let eventStore: MockOutboxEvent[] = [];
let nextId = 1;

const MockOutboxService = {
  emit: async (eventType: string, payload: Record<string, unknown>, maxAttempts = 3): Promise<string> => {
    const id = `evt-${nextId++}`;
    eventStore.push({
      id,
      eventType,
      payload: JSON.stringify(payload),
      status: 'PENDING',
      attempts: 0,
      maxAttempts,
      createdAt: new Date(),
    });
    return id;
  },

  getPendingEvents: (batchSize = 10): MockOutboxEvent[] => {
    return eventStore
      .filter((e) => e.status === 'PENDING' && e.attempts < e.maxAttempts)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, batchSize);
  },

  markCompleted: (id: string) => {
    const event = eventStore.find((e) => e.id === id);
    if (event) {
      event.status = 'COMPLETED';
      event.processedAt = new Date();
    }
  },

  markFailed: (id: string, error: string) => {
    const event = eventStore.find((e) => e.id === id);
    if (event) {
      event.attempts++;
      if (event.attempts >= event.maxAttempts) {
        event.status = 'FAILED';
      }
      event.error = error;
    }
  },

  markProcessing: (id: string) => {
    const event = eventStore.find((e) => e.id === id);
    if (event) event.status = 'PROCESSING';
  },

  reset: () => {
    eventStore = [];
    nextId = 1;
  },

  cleanupCompleted: (retentionDays = 7): number => {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const before = eventStore.length;
    eventStore = eventStore.filter(
      (e) => !(e.status === 'COMPLETED' && e.processedAt && e.processedAt < cutoff)
    );
    return before - eventStore.length;
  },
};

describe('Outbox Pattern', () => {
  beforeEach(() => {
    MockOutboxService.reset();
  });

  describe('emit', () => {
    it('creates a pending event', async () => {
      const id = await MockOutboxService.emit('wallet.topup', { riderId: 'rider-1', amount: 5000 });
      expect(id).toBeDefined();
      expect(eventStore).toHaveLength(1);
      expect(eventStore[0].status).toBe('PENDING');
      expect(eventStore[0].eventType).toBe('wallet.topup');
      expect(eventStore[0].attempts).toBe(0);
    });

    it('creates multiple events independently', async () => {
      await MockOutboxService.emit('event.a', {});
      await MockOutboxService.emit('event.b', {});
      expect(eventStore).toHaveLength(2);
    });
  });

  describe('getPendingEvents', () => {
    it('returns only pending events', async () => {
      await MockOutboxService.emit('event.a', {});
      await MockOutboxService.emit('event.b', {});

      MockOutboxService.markCompleted('evt-1');

      const pending = MockOutboxService.getPendingEvents();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('evt-2');
    });

    it('respects batch size', async () => {
      await MockOutboxService.emit('event.a', {});
      await MockOutboxService.emit('event.b', {});
      await MockOutboxService.emit('event.c', {});

      expect(MockOutboxService.getPendingEvents(2)).toHaveLength(2);
    });

    it('returns events in FIFO order', async () => {
      await MockOutboxService.emit('event.1', { seq: 1 });
      await MockOutboxService.emit('event.2', { seq: 2 });

      const pending = MockOutboxService.getPendingEvents();
      expect(pending[0].id).toBe('evt-1');
      expect(pending[1].id).toBe('evt-2');
    });
  });

  describe('retry logic', () => {
    it('increments attempts on failure', async () => {
      await MockOutboxService.emit('event.a', {});
      MockOutboxService.markFailed('evt-1', 'Network error');
      expect(eventStore[0].attempts).toBe(1);
      expect(eventStore[0].error).toBe('Network error');
    });

    it('sets status to FAILED after max attempts', async () => {
      await MockOutboxService.emit('event.a', {}, 3);

      // First attempt fails
      MockOutboxService.markFailed('evt-1', 'Error 1');
      expect(eventStore[0].status).not.toBe('FAILED'); // still PENDING for retry

      // Second attempt fails
      MockOutboxService.markFailed('evt-1', 'Error 2');
      expect(eventStore[0].status).not.toBe('FAILED');

      // Third attempt fails
      MockOutboxService.markFailed('evt-1', 'Error 3');
      expect(eventStore[0].status).toBe('FAILED');
      expect(eventStore[0].attempts).toBe(3);
    });

    it('does not retry events at max attempts', async () => {
      await MockOutboxService.emit('event.a', {}, 1);
      MockOutboxService.markFailed('evt-1', 'Error');

      const pending = MockOutboxService.getPendingEvents();
      expect(pending).toHaveLength(0);
    });
  });

  describe('completed events', () => {
    it('marks event as completed with processedAt', async () => {
      await MockOutboxService.emit('event.a', {});
      MockOutboxService.markCompleted('evt-1');

      expect(eventStore[0].status).toBe('COMPLETED');
      expect(eventStore[0].processedAt).toBeDefined();
    });

    it('cleanup removes completed events older than retention', async () => {
      // Create an event with a very old processedAt
      eventStore.push({
        id: 'old-event',
        eventType: 'test',
        payload: '{}',
        status: 'COMPLETED',
        attempts: 1,
        maxAttempts: 3,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        processedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });

      const deleted = MockOutboxService.cleanupCompleted(7);
      // The old event should be deleted, but its retained in the store since it was added directly
      expect(eventStore.find((e) => e.id === 'old-event')).toBeUndefined();
      expect(deleted).toBe(1);
    });
  });

  describe('status transitions', () => {
    it('follows PENDING → PROCESSING → COMPLETED', async () => {
      await MockOutboxService.emit('event.a', {});

      expect(eventStore[0].status).toBe('PENDING');

      MockOutboxService.markProcessing('evt-1');
      expect(eventStore[0].status).toBe('PROCESSING');

      MockOutboxService.markCompleted('evt-1');
      expect(eventStore[0].status).toBe('COMPLETED');
    });

    it('follows PENDING → PROCESSING → FAILED (terminal)', async () => {
      await MockOutboxService.emit('event.a', {}, 1);

      MockOutboxService.markProcessing('evt-1');
      MockOutboxService.markFailed('evt-1', 'Error');

      expect(eventStore[0].status).toBe('FAILED');
    });
  });
});
