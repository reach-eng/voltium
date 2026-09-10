import { describe, it, expect } from 'vitest';
import {
  evaluateOutboxHealth,
  OUTBOX_QUEUE_DEPTH_DEGRADED,
  OUTBOX_FAILED_DEGRADED,
  OUTBOX_FAILED_UNHEALTHY,
  OUTBOX_STUCK_DEGRADED,
  OUTBOX_STUCK_UNHEALTHY,
  type OutboxStatus,
} from '@/lib/outbox-health';

describe('evaluateOutboxHealth — shared threshold table (P1-4)', () => {
  it('returns healthy when every count is below the degraded threshold', () => {
    const status: OutboxStatus = evaluateOutboxHealth({
      pending: OUTBOX_QUEUE_DEPTH_DEGRADED - 1,
      failed: OUTBOX_FAILED_DEGRADED - 1,
      stuck: OUTBOX_STUCK_DEGRADED,
      oldestPendingAgeSeconds: 10,
    });
    expect(status).toBe('healthy');
  });

  it('returns degraded when stuck > 0 (PROCESSING @ 5m or PENDING @ 15m)', () => {
    const status = evaluateOutboxHealth({
      pending: 0,
      failed: 0,
      stuck: OUTBOX_STUCK_DEGRADED + 1,
      oldestPendingAgeSeconds: null,
    });
    expect(status).toBe('degraded');
  });

  it('returns degraded when failed > 10', () => {
    const status = evaluateOutboxHealth({
      pending: 0,
      failed: OUTBOX_FAILED_DEGRADED + 1,
      stuck: 0,
      oldestPendingAgeSeconds: null,
    });
    expect(status).toBe('degraded');
  });

  it('returns degraded when queue depth > 100', () => {
    const status = evaluateOutboxHealth({
      pending: OUTBOX_QUEUE_DEPTH_DEGRADED + 1,
      failed: 0,
      stuck: 0,
      oldestPendingAgeSeconds: null,
    });
    expect(status).toBe('degraded');
  });

  it('returns unhealthy when stuck > 10', () => {
    const status = evaluateOutboxHealth({
      pending: 0,
      failed: 0,
      stuck: OUTBOX_STUCK_UNHEALTHY + 1,
      oldestPendingAgeSeconds: null,
    });
    expect(status).toBe('unhealthy');
  });

  it('returns unhealthy when failed > 50', () => {
    const status = evaluateOutboxHealth({
      pending: 0,
      failed: OUTBOX_FAILED_UNHEALTHY + 1,
      stuck: 0,
      oldestPendingAgeSeconds: null,
    });
    expect(status).toBe('unhealthy');
  });

  it('escalates from degraded to unhealthy when both stuck and failed breach the higher threshold', () => {
    const status = evaluateOutboxHealth({
      pending: 200,
      failed: 60,
      stuck: 11,
      oldestPendingAgeSeconds: null,
    });
    expect(status).toBe('unhealthy');
  });
});
