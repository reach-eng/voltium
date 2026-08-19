import { describe, it, expect } from 'vitest';

describe('Consolidated Fix Plan & Pass 6 Comprehensive Contracts', () => {
  it('OutboxEventTypes: contains all required event bus types', async () => {
    const { OutboxEventTypes } = await import('@/server/workers/outbox');
    expect(OutboxEventTypes.RENT_PAID).toBe('rent.paid');
    expect(OutboxEventTypes.WALLET_RECONCILIATION).toBe('wallet.reconciliation');
    expect(OutboxEventTypes.ANNOUNCEMENT_BROADCAST).toBe('announcement.broadcast');
    expect(OutboxEventTypes.DEVICE_VIOLATION_SCAN).toBe('device.violation_scan');
    expect(OutboxEventTypes.ADMIN_JOB_TELEMETRY_CLEANUP).toBe('admin.job.telemetry_cleanup');
  });

  it('approveTransactionSchema: validates min 10 char rejectionReason when action is REJECT', async () => {
    const { approveTransactionSchema } = await import('@/lib/validators');
    const valid = approveTransactionSchema.safeParse({
      id: 'tx_999',
      action: 'REJECT',
      rejectionReason: 'Invalid payment proof submitted for verification',
    });
    expect(valid.success).toBe(true);

    const invalid = approveTransactionSchema.safeParse({
      id: 'tx_999',
      action: 'REJECT',
      rejectionReason: 'short',
    });
    expect(invalid.success).toBe(false);
  });

  it('updateProfileSchema: accepts both ISO and legacy DOB formats', async () => {
    const { updateProfileSchema } = await import('@/lib/validators');
    const isoDob = updateProfileSchema.safeParse({ dob: '1995-10-20' });
    expect(isoDob.success).toBe(true);

    const legacyDob = updateProfileSchema.safeParse({ dob: '20-10-1995' });
    expect(legacyDob.success).toBe(true);
  });

  it('earningUseCases: create method exists and is callable', async () => {
    const { earningUseCases } = await import('@/server/modules/earnings/earning.use-cases');
    expect(typeof earningUseCases.create).toBe('function');
  });
});
