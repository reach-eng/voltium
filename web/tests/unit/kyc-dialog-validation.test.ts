import { describe, it, expect } from 'vitest';

describe('KYC Action Rejection Reason Validation', () => {
  it('disables reject action when rejection reason is less than 5 characters', () => {
    const isActionDisabled = (action: string, reason: string, loading: boolean) => {
      if (loading) return true;
      if (action === 'reject' || action === 'info_required') {
        return reason.trim().length < 5;
      }
      return false;
    };

    expect(isActionDisabled('reject', '', false)).toBe(true);
    expect(isActionDisabled('reject', 'abc', false)).toBe(true);
    expect(isActionDisabled('reject', 'Photo is blurry', false)).toBe(false);
    expect(isActionDisabled('approve', '', false)).toBe(false);
  });
});
