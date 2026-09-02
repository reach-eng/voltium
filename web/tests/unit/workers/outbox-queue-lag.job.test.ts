/**
 * Outbox queue-lag alerter (audit batch 7 P0-1).
 *
 * Verifies the metric + alert logic:
 *   - counts PENDING + PROCESSING (excludes COMPLETED + FAILED)
 *   - flags stuck PROCESSING events older than 5 min
 *   - fires the alerter when total >= threshold OR when stuck > 0
 *   - does NOT fire the alerter when within bounds and no stuck events
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = vi.hoisted(() => ({
  outboxEvent: {
    count: vi.fn(),
  },
}));

const mockAlerter = vi.hoisted(() => ({
  send: vi.fn().mockResolvedValue(undefined),
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/alerter', () => ({ alerter: mockAlerter }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

const { getOutboxQueueLag, checkOutboxQueueLag } = await import(
  '@/server/workers/jobs/outbox-queue-lag.job'
);

describe('outbox-queue-lag.job — metric', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns total = pending + processing (excludes COMPLETED + FAILED)', async () => {
    mockDb.outboxEvent.count
      .mockResolvedValueOnce(12) // PENDING
      .mockResolvedValueOnce(3)  // PROCESSING
      .mockResolvedValueOnce(0); // stuck PROCESSING (no stuck)

    const snap = await getOutboxQueueLag(new Date('2026-09-02T12:00:00Z'));
    expect(snap.total).toBe(15);
    expect(snap.pending).toBe(12);
    expect(snap.processing).toBe(3);
    expect(snap.stuckProcessing).toBe(0);
    expect(snap.measuredAt).toBe('2026-09-02T12:00:00.000Z');
  });

  it('counts a PROCESSING event older than 5 min as stuck', async () => {
    mockDb.outboxEvent.count
      .mockResolvedValueOnce(0)  // PENDING
      .mockResolvedValueOnce(2)  // PROCESSING
      .mockResolvedValueOnce(1); // stuck PROCESSING (1 of the 2 is >5 min old)

    const snap = await getOutboxQueueLag();
    expect(snap.total).toBe(2);
    expect(snap.stuckProcessing).toBe(1);
  });
});

describe('outbox-queue-lag.job — alerter (audit batch 7 P0-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT alert when within threshold and no stuck events', async () => {
    mockDb.outboxEvent.count
      .mockResolvedValueOnce(10) // PENDING — under default threshold of 50
      .mockResolvedValueOnce(0)  // PROCESSING
      .mockResolvedValueOnce(0); // stuck

    const result = await checkOutboxQueueLag();
    expect(result.alerted).toBe(false);
    expect(result.total).toBe(10);
    expect(result.threshold).toBe(50);
    expect(mockAlerter.send).not.toHaveBeenCalled();
  });

  it('alerts when total >= threshold (default 50)', async () => {
    mockDb.outboxEvent.count
      .mockResolvedValueOnce(45) // PENDING
      .mockResolvedValueOnce(10) // PROCESSING — total 55
      .mockResolvedValueOnce(0); // stuck

    const result = await checkOutboxQueueLag();
    expect(result.alerted).toBe(true);
    expect(result.total).toBe(55);
    expect(mockAlerter.send).toHaveBeenCalledTimes(1);
    expect(mockAlerter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        title: expect.stringContaining('55 unprocessed event(s)'),
        source: 'outbox-queue-lag',
        details: expect.objectContaining({
          total: 55,
          pending: 45,
          processing: 10,
          stuckProcessing: 0,
          threshold: 50,
        }),
      })
    );
  });

  it('escalates to critical level when stuck PROCESSING events are present', async () => {
    mockDb.outboxEvent.count
      .mockResolvedValueOnce(0) // PENDING
      .mockResolvedValueOnce(1) // PROCESSING
      .mockResolvedValueOnce(1); // stuck (worker crash signal)

    const result = await checkOutboxQueueLag();
    expect(result.alerted).toBe(true);
    expect(mockAlerter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'critical',
        source: 'outbox-queue-lag',
      })
    );
  });

  it('does NOT throw if alerter.send rejects (best-effort)', async () => {
    mockDb.outboxEvent.count
      .mockResolvedValueOnce(100) // over threshold
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockAlerter.send.mockRejectedValueOnce(new Error('slack down'));

    // The job must complete even if the alerter is broken — the metric
    // is the source of truth and the alerter is a notification layer.
    const result = await checkOutboxQueueLag();
    expect(result.alerted).toBe(true);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('alerter.send failed'),
      expect.any(Object)
    );
  });
});
