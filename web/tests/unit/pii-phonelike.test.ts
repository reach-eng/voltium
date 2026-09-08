import { describe, it, expect } from 'vitest';
import { maskPhoneLike } from '@/lib/pii-redact';

describe('maskPhoneLike (dashboard P1 entityId/contact masking)', () => {
  it('masks bare 10-digit Indian mobiles', () => {
    expect(maskPhoneLike('9876543210')).toBe('******3210');
  });

  it('masks +91 / 91 prefixed numbers by last 4', () => {
    expect(maskPhoneLike('+919876543210')).toBe('******3210');
    expect(maskPhoneLike('919876543210')).toBe('******3210');
  });

  it('leaves UUIDs, riderIds, and short strings untouched', () => {
    expect(maskPhoneLike('cuid-abc-123')).toBe('cuid-abc-123');
    expect(maskPhoneLike('RDR001')).toBe('RDR001');
    expect(maskPhoneLike('12345')).toBe('12345');
  });

  it('leaves non-Indian digit strings untouched', () => {
    // 11-digit / wrong-prefix numbers are not masked (narrow rule).
    expect(maskPhoneLike('12345678901')).toBe('12345678901');
    expect(maskPhoneLike('5123456789')).toBe('5123456789');
  });

  it('passes non-strings through', () => {
    expect(maskPhoneLike(null)).toBeNull();
    expect(maskPhoneLike(42)).toBe(42);
  });
});
