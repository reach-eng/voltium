import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orphanEventConsumerJob } from '@/server/workers/jobs/orphan-event-consumer.job';
import { notificationService } from '@/lib/notification-service';
import { alerter } from '@/lib/alerter';
import { createAuditLog } from '@/lib/audit-log';

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/notification-service', () => ({
  notificationService: {
    notifyPaymentReminder: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/lib/alerter', () => ({
  alerter: {
    send: vi.fn(),
  },
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue({ id: 'audit_123' }),
}));

describe('Top-up 24h Proactive Prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers 24h proactive prompt notification when hoursUntilDebit <= 24', async () => {
    const jobPayload = {
      type: 'rent.overdue',
      payload: {
        eventType: 'rent.overdue',
        riderId: 'rdr_test_1',
        leaseId: 'lse_test_1',
        amountDue: 50000,
        balance: 2000,
        hoursUntilDebit: 18,
        periodNo: 2,
      },
    };

    await orphanEventConsumerJob.process(jobPayload as any);

    expect(notificationService.notifyPaymentReminder).toHaveBeenCalledWith(
      'rdr_test_1',
      50000,
      'proactive_24h'
    );

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'rent.prompt_24h',
        details: expect.objectContaining({
          hoursUntilDebit: 18,
        }),
      })
    );
  });

  it('triggers standard overdue notification when hoursUntilDebit is omitted or > 24', async () => {
    const jobPayload = {
      type: 'rent.overdue',
      payload: {
        eventType: 'rent.overdue',
        riderId: 'rdr_test_2',
        leaseId: 'lse_test_2',
        amountDue: 50000,
        balance: 2000,
      },
    };

    await orphanEventConsumerJob.process(jobPayload as any);

    expect(notificationService.notifyPaymentReminder).toHaveBeenCalledWith(
      'rdr_test_2',
      50000,
      'overdue'
    );

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'rent.overdue',
      })
    );
  });
});
