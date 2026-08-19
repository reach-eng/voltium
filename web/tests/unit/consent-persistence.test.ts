import { describe, it, expect, vi, beforeEach } from 'vitest';
import { consentSchema } from '../../src/lib/validators';

describe('consentSchema', () => {
  it('accepts valid LOCATION consent', () => {
    const result = consentSchema.safeParse({
      consentType: 'LOCATION',
      granted: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid CONTACTS consent', () => {
    const result = consentSchema.safeParse({
      consentType: 'CONTACTS',
      granted: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid CALL_LOGS consent', () => {
    const result = consentSchema.safeParse({
      consentType: 'CALL_LOGS',
      granted: true,
      policyVersion: 'public-beta-v2',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown consentType', () => {
    const result = consentSchema.safeParse({
      consentType: 'MICROPHONE',
      granted: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (strict)', () => {
    const result = consentSchema.safeParse({
      consentType: 'LOCATION',
      granted: true,
      extraField: 'should be rejected',
    });
    expect(result.success).toBe(false);
  });

  it('defaults policyVersion to public-beta-v1', () => {
    const result = consentSchema.safeParse({
      consentType: 'LOCATION',
      granted: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.policyVersion).toBe('public-beta-v1');
    }
  });

  // PR-VER-2026-08-07 (FLUTTER_CONSENT P1-1): the rider app records consent
  // for EVERY permission it requests — the enum must accept all 9 or the
  // sync 400s. Kept exhaustive so a newly added permission that the backend
  // doesn't know about fails this test.
  it.each([
    'LOCATION',
    'CONTACTS',
    'CALL_LOGS',
    'CAMERA',
    'PHONE',
    'MIC',
    'BATTERY',
    'NOTIFICATIONS',
    'DEVICE_ADMIN',
  ] as const)('accepts consentType %s', (consentType) => {
    const result = consentSchema.safeParse({
      consentType,
      granted: true,
    });
    expect(result.success).toBe(true);
  });
});
