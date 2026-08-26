import { describe, it, expect } from 'vitest';
import { dataDeletionApproveSchema, dataDeletionRejectSchema } from '@/lib/validators/admin';

describe('Data Deletion Approval & Reject Schemas (PR-P / Ticket #59)', () => {
  it('validates dataDeletionApproveSchema with valid requestId', () => {
    const valid = dataDeletionApproveSchema.safeParse({
      requestId: 'req-123',
      notes: 'Approved after compliance review',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects dataDeletionApproveSchema with empty requestId', () => {
    const invalid = dataDeletionApproveSchema.safeParse({
      requestId: '',
    });
    expect(invalid.success).toBe(false);
  });

  it('validates dataDeletionRejectSchema with valid reason', () => {
    const valid = dataDeletionRejectSchema.safeParse({
      requestId: 'req-123',
      reason: 'Rider has an active lease agreement.',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects dataDeletionRejectSchema with short or missing reason', () => {
    const invalid = dataDeletionRejectSchema.safeParse({
      requestId: 'req-123',
      reason: 'No',
    });
    expect(invalid.success).toBe(false);
  });
});
