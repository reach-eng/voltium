import { describe, it, expect } from 'vitest';

describe('Consolidated Fix Plan 2026-08-06 Master Contracts', () => {
  it('OutboxEventTypes: contains all required event bus types', async () => {
    const { OutboxEventTypes } = await import('@/server/workers/outbox');
    expect(OutboxEventTypes.RENT_PAID).toBe('rent.paid');
    expect(OutboxEventTypes.ANNOUNCEMENT_BROADCAST).toBe('announcement.broadcast');
    expect(OutboxEventTypes.WALLET_RECONCILIATION).toBe('wallet.reconciliation');
    expect(OutboxEventTypes.ADMIN_JOB_TELEMETRY_CLEANUP).toBe('admin.job.telemetry_cleanup');
  });

  it('approveTransactionSchema: requires valid rejectionReason (min 10 chars) for REJECT action', async () => {
    const { approveTransactionSchema } = await import('@/lib/validators');

    const validReject = approveTransactionSchema.safeParse({
      id: 'tx_001',
      action: 'REJECT',
      rejectionReason: 'Invalid transaction receipt uploaded',
    });
    expect(validReject.success).toBe(true);

    const invalidReject = approveTransactionSchema.safeParse({
      id: 'tx_001',
      action: 'REJECT',
      rejectionReason: 'bad',
    });
    expect(invalidReject.success).toBe(false);
  });

  it('updateProfileSchema: accepts both ISO and legacy DOB formats', async () => {
    const { updateProfileSchema } = await import('@/lib/validators');

    const isoDob = updateProfileSchema.safeParse({ dob: '1998-05-15' });
    expect(isoDob.success).toBe(true);

    const legacyDob = updateProfileSchema.safeParse({ dob: '15-05-1998' });
    expect(legacyDob.success).toBe(true);
  });
});
