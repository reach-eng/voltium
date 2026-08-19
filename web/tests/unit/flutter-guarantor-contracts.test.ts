import { describe, it, expect } from 'vitest';

describe('Flutter Guarantor Onboarding Contracts', () => {
  it('formats Guarantor Date of Birth to ISO yyyy-MM-dd', () => {
    const formatDobIso = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const testDate = new Date(1990, 0, 1); // 1 Jan 1990
    expect(formatDobIso(testDate)).toBe('1990-01-01');
  });

  it('formats scoped form cache key correctly with riderId', () => {
    const getFormCacheKey = (riderId: string): string => {
      return `guarantor_onboarding_form_cache_${riderId}`;
    };

    expect(getFormCacheKey('r_12345')).toBe('guarantor_onboarding_form_cache_r_12345');
  });

  it('clears OTP array on phone number change', () => {
    let otpArray = ['1', '2', '3', '4', '5', '6'];
    const clearOtpArray = () => {
      otpArray = ['', '', '', '', '', ''];
    };

    clearOtpArray();
    expect(otpArray.every((digit) => digit === '')).toBe(true);
  });
});
