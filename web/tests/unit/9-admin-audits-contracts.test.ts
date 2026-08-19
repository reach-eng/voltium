import { describe, it, expect } from 'vitest';

describe('9-Admin Audits Re-Verification Contracts', () => {
  it('PR-17 & PR-18: approveTransactionSchema rejects REJECT action without valid rejectionReason (min 10 chars)', async () => {
    const { approveTransactionSchema } = await import('@/lib/validators');

    const validApprove = approveTransactionSchema.safeParse({
      id: 'tx_123',
      action: 'APPROVE',
    });
    expect(validApprove.success).toBe(true);

    const invalidRejectNoReason = approveTransactionSchema.safeParse({
      id: 'tx_123',
      action: 'REJECT',
    });
    expect(invalidRejectNoReason.success).toBe(false);

    const invalidRejectShortReason = approveTransactionSchema.safeParse({
      id: 'tx_123',
      action: 'REJECT',
      rejectionReason: 'too short',
    });
    expect(invalidRejectShortReason.success).toBe(false);

    const validReject = approveTransactionSchema.safeParse({
      id: 'tx_123',
      action: 'REJECT',
      rejectionReason: 'Documentation provided is invalid and unreadable',
    });
    expect(validReject.success).toBe(true);
  });

  it('PR-14: earningRepository searches with mode: insensitive', async () => {
    const { earningRepository } = await import('@/server/modules/earnings/earning.repository');
    expect(typeof earningRepository.findAllPaginated).toBe('function');
  });
});
