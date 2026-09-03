import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  metricsRegistry,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  outboxProcessedTotal,
  outboxPendingCount,
  outboxOldestPendingAgeSeconds,
} from '@/lib/prometheus';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    outboxEvent: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Prometheus Metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports metricsRegistry and standard metrics', () => {
    expect(metricsRegistry).toBeDefined();
    expect(httpRequestsTotal).toBeDefined();
    expect(httpRequestDurationSeconds).toBeDefined();
    expect(outboxProcessedTotal).toBeDefined();
    expect(outboxPendingCount).toBeDefined();
    expect(outboxOldestPendingAgeSeconds).toBeDefined();
  });

  it('records HTTP request metrics without throwing', () => {
    expect(() => {
      httpRequestsTotal.inc({ method: 'GET', route: '/api/health', status: '200' });
      const timer = httpRequestDurationSeconds.startTimer({ method: 'GET', route: '/api/health' });
      timer();
    }).not.toThrow();
  });

  it('records Outbox processed metric counts', () => {
    expect(() => {
      outboxProcessedTotal.inc({ status: 'success', event_type: 'sms.send' });
      outboxProcessedTotal.inc({ status: 'failed', event_type: 'notification.send' });
    }).not.toThrow();
  });

  it('collects outbox_pending_count from db', async () => {
    vi.mocked(db.outboxEvent.count).mockResolvedValue(42);
    const metricValue = await outboxPendingCount.get();
    expect(metricValue.values[0].value).toBe(42);
  });

  it('handles db error in outbox_pending_count collect gracefully', async () => {
    vi.mocked(db.outboxEvent.count).mockRejectedValue(new Error('DB Connection Failed'));
    await expect(outboxPendingCount.get()).resolves.toBeDefined();
  });

  it('collects outbox_oldest_pending_age_seconds from db when oldest event exists', async () => {
    const twoMinutesAgo = new Date(Date.now() - 120 * 1000);
    vi.mocked(db.outboxEvent.findFirst).mockResolvedValue({
      createdAt: twoMinutesAgo,
    } as any);

    const metricValue = await outboxOldestPendingAgeSeconds.get();
    expect(metricValue.values[0].value).toBeGreaterThanOrEqual(119);
  });

  it('sets 0 for outbox_oldest_pending_age_seconds when no pending events exist', async () => {
    vi.mocked(db.outboxEvent.findFirst).mockResolvedValue(null);

    const metricValue = await outboxOldestPendingAgeSeconds.get();
    expect(metricValue.values[0].value).toBe(0);
  });

  it('handles db error in outbox_oldest_pending_age_seconds collect gracefully', async () => {
    vi.mocked(db.outboxEvent.findFirst).mockRejectedValue(new Error('Timeout'));
    await expect(outboxOldestPendingAgeSeconds.get()).resolves.toBeDefined();
  });

  it('renders prometheus text format from registry', async () => {
    const text = await metricsRegistry.metrics();
    expect(text).toContain('http_requests_total');
    expect(text).toContain('outbox_processed_total');
  });
});
