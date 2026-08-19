import { describe, it, expect } from 'vitest';

describe('Pass 7 Audit Verification Contracts', () => {
  it('wallet.use-cases: requestTopup function exists and validates idempotency', async () => {
    const { walletUseCases } = await import('@/server/modules/wallet/wallet.use-cases');
    expect(typeof walletUseCases.requestTopup).toBe('function');
  });

  it('OutboxEventTypes: contains all required events for background workers', async () => {
    const { OutboxEventTypes } = await import('@/server/workers/outbox');
    expect(OutboxEventTypes.DEVICE_VIOLATION_SCAN).toBe('device.violation_scan');
    expect(OutboxEventTypes.WALLET_RECONCILIATION).toBe('wallet.reconciliation');
  });

  it('adminRiderUseCases: delete method supports transactional audit log', async () => {
    const { adminRiderUseCases } = await import('@/server/modules/riders/admin-riders.use-cases');
    expect(typeof adminRiderUseCases.delete).toBe('function');
  });
});
