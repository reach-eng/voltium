import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeadLetterQueue } from '@/lib/dead-letter-queue';
import { alerter } from '@/lib/alerter';

const mockDb = vi.hoisted(() => ({
  outboxEvent: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/alerter', () => ({
  alerter: {
    send: vi.fn().mockResolvedValue(true),
  },
}));

describe('Dead-Letter Queue (DLQ) Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handleDeadLetter logs and sends critical alert when max retries exceeded', async () => {
    await DeadLetterQueue.handleDeadLetter({
      id: 'job_dead_1',
      eventType: 'wallet.topup_approved',
      attempts: 3,
      maxAttempts: 3,
      error: 'Connection timeout to gateway',
    });

    expect(alerter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'critical',
        title: expect.stringContaining('Job Dead-Lettered: wallet.topup_approved'),
        message: expect.stringContaining('failed after 3/3 attempts'),
        source: 'lib/dead-letter-queue',
      })
    );
  });

  it('listDeadLetterJobs queries failed events with pagination', async () => {
    const mockJobs = [
      { id: 'job_1', status: 'FAILED', eventType: 'notification.send', updatedAt: new Date() },
    ];
    mockDb.outboxEvent.findMany.mockResolvedValue(mockJobs);
    mockDb.outboxEvent.count.mockResolvedValue(1);

    const result = await DeadLetterQueue.listDeadLetterJobs({ limit: 10, offset: 0 });

    expect(result.jobs).toEqual(mockJobs);
    expect(result.total).toBe(1);
    expect(mockDb.outboxEvent.findMany).toHaveBeenCalledWith({
      where: { status: 'FAILED' },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      skip: 0,
    });
  });

  it('retryJob re-arms a failed job to PENDING with 0 attempts', async () => {
    mockDb.outboxEvent.findUnique.mockResolvedValue({
      id: 'job_1',
      status: 'FAILED',
      eventType: 'notification.send',
    });
    mockDb.outboxEvent.update.mockResolvedValue({ id: 'job_1', status: 'PENDING' });

    const success = await DeadLetterQueue.retryJob('job_1');

    expect(success).toBe(true);
    expect(mockDb.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'job_1' },
      data: {
        status: 'PENDING',
        attempts: 0,
        readyAt: null,
        error: null,
      },
    });
  });

  it('retryJob returns false if job is not found or not in FAILED status', async () => {
    mockDb.outboxEvent.findUnique.mockResolvedValue({
      id: 'job_2',
      status: 'COMPLETED',
    });

    const success = await DeadLetterQueue.retryJob('job_2');
    expect(success).toBe(false);
    expect(mockDb.outboxEvent.update).not.toHaveBeenCalled();
  });

  it('purgeJob deletes the dead-lettered job', async () => {
    mockDb.outboxEvent.delete.mockResolvedValue({ id: 'job_1' });

    const success = await DeadLetterQueue.purgeJob('job_1');
    expect(success).toBe(true);
    expect(mockDb.outboxEvent.delete).toHaveBeenCalledWith({ where: { id: 'job_1' } });
  });
});
