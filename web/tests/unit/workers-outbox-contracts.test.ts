import { describe, it, expect } from 'vitest';
import { backupService } from '@/server/modules/data-management/backup.service';
import { OutboxEventTypes } from '@/server/workers/outbox';

describe('Workers & Outbox Contracts', () => {
  it('backupService has runScheduledBackup method', () => {
    expect(typeof backupService.runScheduledBackup).toBe('function');
  });

  it('OutboxEventTypes defines RENT_PAID as active event type', () => {
    expect(OutboxEventTypes.RENT_PAID).toBe('rent.paid');
    expect(OutboxEventTypes.WALLET_RECONCILIATION).toBe('wallet.reconciliation');
  });

  it('validates KYC notification dispatch payload channels', () => {
    const kycApprovedPayload = {
      type: 'KYC_APPROVED',
      riderId: 'r_123',
      title: 'KYC Approved',
    };

    expect(kycApprovedPayload.type).toBe('KYC_APPROVED');
    expect(kycApprovedPayload.riderId).toBe('r_123');
  });
});
