import { describe, it, expect } from 'vitest';

describe('Consolidated Fix Plan 2026-08-06 Contracts', () => {
  it('OutboxEventTypes: includes RENT_PAID, ANNOUNCEMENT_BROADCAST, and WALLET_RECONCILIATION', async () => {
    const { OutboxEventTypes } = await import('@/server/workers/outbox');
    expect(OutboxEventTypes.RENT_PAID).toBeDefined();
    expect(OutboxEventTypes.ANNOUNCEMENT_BROADCAST).toBeDefined();
    expect(OutboxEventTypes.WALLET_RECONCILIATION).toBeDefined();
  });

  it('approveTransactionSchema: validates min 10 char rejectionReason when action is REJECT', async () => {
    const { approveTransactionSchema } = await import('@/lib/validators');
    const valid = approveTransactionSchema.safeParse({
      id: 'tx_999',
      action: 'REJECT',
      rejectionReason: 'Invalid document submitted for verification',
    });
    expect(valid.success).toBe(true);

    const invalid = approveTransactionSchema.safeParse({
      id: 'tx_999',
      action: 'REJECT',
      rejectionReason: 'short',
    });
    expect(invalid.success).toBe(false);
  });
});
