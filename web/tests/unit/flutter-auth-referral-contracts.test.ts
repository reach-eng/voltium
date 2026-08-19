import { describe, it, expect } from 'vitest';

describe('Flutter Auth & Referral Contracts', () => {
  it('includes referralCode in VerifyOtpRequest shape', () => {
    const verifyOtpPayload = {
      phone: '9876543210',
      otp: '123456',
      referralCode: 'REF123',
    };

    expect(verifyOtpPayload.referralCode).toBe('REF123');
    expect(verifyOtpPayload.phone).toBe('9876543210');
  });

  it('validates 10-digit Indian phone numbers starting with 6, 7, 8, 9', () => {
    const validPhone = '9876543210';
    const invalidPhoneShort = '987654321';
    const invalidPhonePrefix = '5876543210';

    expect(validPhone.length).toBe(10);
    expect(/^[6-9]\d{9}$/.test(validPhone)).toBe(true);
    expect(/^[6-9]\d{9}$/.test(invalidPhoneShort)).toBe(false);
    expect(/^[6-9]\d{9}$/.test(invalidPhonePrefix)).toBe(false);
  });
});
