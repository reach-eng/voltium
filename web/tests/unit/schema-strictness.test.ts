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

  // EDIT-PROFILE-AUDIT P0-3 (2026-09-08): `guarantorStatus` was a
  // dead field — the schema accepted it, the allowlist
  // accepted it, the upsert overwrote it with `status:
  // 'SUBMITTED'`. Removing from the schema (this file) +
  // SAFE_GUARANTOR_FIELDS (rider.use-cases.ts:107) closes the
  // confusion. A rider PUT carrying `guarantorStatus` now
  // returns 400 with a clear "unrecognized key" error, since
  // the schema runs in strict mode.
  it('P0-3: rejects guarantorStatus (server-only status field)', () => {
    const result = updateProfileSchema.safeParse({
      fullName: 'Test Rider',
      guarantorStatus: 'APPROVED', // server-only; rider cannot set
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
