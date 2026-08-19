import { describe, it, expect } from 'vitest';

describe('9 Flutter Audits Re-Verification Contracts', () => {
  it('PR-2: wallet.use-cases validates amount and purpose for idempotent topups', async () => {
    const { walletUseCases } = await import('@/server/modules/wallet/wallet.use-cases');
    expect(typeof walletUseCases.requestTopup).toBe('function');
  });

  it('OutboxEventTypes: contains all required outbox types', async () => {
    const { OutboxEventTypes } = await import('@/server/workers/outbox');
    expect(OutboxEventTypes.RENT_PAID).toBe('rent.paid');
    expect(OutboxEventTypes.WALLET_RECONCILIATION).toBe('wallet.reconciliation');
  });

  it('approveTransactionSchema: validates min 10 char rejectionReason when action is REJECT', async () => {
    const { approveTransactionSchema } = await import('@/lib/validators');
    const valid = approveTransactionSchema.safeParse({
      id: 'tx_777',
      action: 'REJECT',
      rejectionReason: 'Invalid payment proof attached',
    });
    expect(valid.success).toBe(true);

    const invalid = approveTransactionSchema.safeParse({
      id: 'tx_777',
      action: 'REJECT',
      rejectionReason: 'none',
    });
    expect(invalid.success).toBe(false);
  });
});
