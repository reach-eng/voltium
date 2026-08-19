import { describe, it, expect } from 'vitest';
import { consentSchema, updateProfileSchema } from '../../src/lib/validators';

describe('updateProfileSchema strictness (P0-4)', () => {
  it('rejects extra fields not in the schema', () => {
    const result = updateProfileSchema.safeParse({
      fullName: 'Test Rider',
      kycRejectionReason: 'manually injected',  // not in schema
    });
    expect(result.success).toBe(false);
  });

  it('rejects admin-only fields from rider-side request', () => {
    const result = updateProfileSchema.safeParse({
      fullName: 'Test Rider',
      adminNote: 'injected admin field',  // admin-only, not in updateProfileSchema
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid partial update', () => {
    const result = updateProfileSchema.safeParse({
      fullName: 'Valid Name',
      email: 'test@example.com',
    });
    expect(result.success).toBe(true);
  });
});

describe('consentSchema strictness (P0-4)', () => {
  it('rejects extra fields', () => {
    const result = consentSchema.safeParse({
      consentType: 'LOCATION',
      granted: true,
      extraField: 'injected',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid consentType', () => {
    const result = consentSchema.safeParse({
      consentType: 'MICROPHONE',
      granted: true,
    });
    expect(result.success).toBe(false);
  });
});
