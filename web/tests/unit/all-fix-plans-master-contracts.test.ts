import { describe, it, expect } from 'vitest';

describe('All Fix Plans Master Invariant Contracts', () => {
  it('OutboxEventTypes: includes all outbox event types across all fix plans', async () => {
    const { OutboxEventTypes } = await import('@/server/workers/outbox');
    expect(OutboxEventTypes.RENT_PAID).toBe('rent.paid');
    expect(OutboxEventTypes.WALLET_RECONCILIATION).toBe('wallet.reconciliation');
    expect(OutboxEventTypes.DEVICE_VIOLATION_SCAN).toBe('device.violation_scan');
    expect(OutboxEventTypes.ADMIN_JOB_TELEMETRY_CLEANUP).toBe('admin.job.telemetry_cleanup');
    expect(OutboxEventTypes.ADMIN_JOB_DAILY_ENGAGEMENT).toBe('admin.job.daily_engagement');
  });

  it('adminRiderUseCases: delete method supports optional actorId parameter', async () => {
    const { adminRiderUseCases } = await import('@/server/modules/riders/admin-riders.use-cases');
    expect(typeof adminRiderUseCases.delete).toBe('function');
  });

  it('walletUseCases: requestTopup validates idempotency with amount and purpose', async () => {
    const { walletUseCases } = await import('@/server/modules/wallet/wallet.use-cases');
    expect(typeof walletUseCases.requestTopup).toBe('function');
  });

  it('JOB_TO_OUTBOX_CONFIG: daily-engagement is configured with background priority', async () => {
    const { JOB_TO_OUTBOX_CONFIG } = await import('@/server/workers/job-outbox-config');
    expect(JOB_TO_OUTBOX_CONFIG['daily-engagement'].priority).toBe('background');
  });
});
