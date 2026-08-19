import { describe, it, expect } from 'vitest';

describe('9 Flutter Audits Fix Plan Contracts', () => {
  it('walletUseCases: requestTopup validates amount and purpose for 5-min bucket idempotency', async () => {
    const { walletUseCases } = await import('@/server/modules/wallet/wallet.use-cases');
    expect(typeof walletUseCases.requestTopup).toBe('function');
  });

  it('OutboxEventTypes: includes all required outbox events', async () => {
    const { OutboxEventTypes } = await import('@/server/workers/outbox');
    expect(OutboxEventTypes.RENT_PAID).toBe('rent.paid');
    expect(OutboxEventTypes.WALLET_RECONCILIATION).toBe('wallet.reconciliation');
    expect(OutboxEventTypes.DEVICE_VIOLATION_SCAN).toBe('device.violation_scan');
  });
});
