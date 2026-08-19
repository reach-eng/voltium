import { describe, it, expect } from 'vitest';
import { transactionBulkActionSchema } from '@/lib/validators';

describe('Bulk Transaction Action Schema Validation', () => {
  it('validates approve action without reason', () => {
    const parsed = transactionBulkActionSchema.safeParse({
      ids: ['tx_1', 'tx_2'],
      action: 'approve',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects bulk reject action when rejectionReason is missing or empty', () => {
    const parsed = transactionBulkActionSchema.safeParse({
      ids: ['tx_1', 'tx_2'],
      action: 'reject',
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts bulk reject action when rejectionReason is provided', () => {
    const parsed = transactionBulkActionSchema.safeParse({
      ids: ['tx_1', 'tx_2'],
      action: 'reject',
      rejectionReason: 'Duplicate transaction proof provided',
    });
    expect(parsed.success).toBe(true);
  });
});
