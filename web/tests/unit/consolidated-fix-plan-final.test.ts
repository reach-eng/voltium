import { describe, it, expect } from 'vitest';

describe('Consolidated Fix Plan Final Verification Contracts', () => {
  it('OutboxEventTypes: contains all required outbox types including WALLET_RECONCILIATION', async () => {
    const { OutboxEventTypes } = await import('@/server/workers/outbox');
    expect(OutboxEventTypes.WALLET_RECONCILIATION).toBe('wallet.reconciliation');
    expect(OutboxEventTypes.RENT_PAID).toBe('rent.paid');
    expect(OutboxEventTypes.ANNOUNCEMENT_BROADCAST).toBe('announcement.broadcast');
  });

  it('approveTransactionSchema: validates min 10 char rejectionReason when action is REJECT', async () => {
    const { approveTransactionSchema } = await import('@/lib/validators');
    const valid = approveTransactionSchema.safeParse({
      id: 'tx_888',
      action: 'REJECT',
      rejectionReason: 'Invalid payment screenshot provided',
    });
    expect(valid.success).toBe(true);

    const invalid = approveTransactionSchema.safeParse({
      id: 'tx_888',
      action: 'REJECT',
      rejectionReason: 'bad',
    });
    expect(invalid.success).toBe(false);
  });
});
