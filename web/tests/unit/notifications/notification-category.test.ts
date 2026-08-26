import { describe, it, expect } from 'vitest';
import { CATEGORY_MAP, deriveCategoryFromTitle } from '@/lib/notification-service';

describe('NotificationCategory derivation', () => {
  it('PAYMENT_DUE maps to PAYMENT', () => {
    expect(CATEGORY_MAP.PAYMENT_DUE).toBe('PAYMENT');
  });
  it('KYC_UPDATE maps to KYC', () => {
    expect(CATEGORY_MAP.KYC_UPDATE).toBe('KYC');
  });
  it('REWARD maps to ANNOUNCEMENT', () => {
    expect(CATEGORY_MAP.REWARD).toBe('ANNOUNCEMENT');
  });
  it('SHIFT_REMINDER maps to SYSTEM', () => {
    expect(CATEGORY_MAP.SHIFT_REMINDER).toBe('SYSTEM');
  });
  it('BIRTHDAY_WISH maps to ANNOUNCEMENT', () => {
    expect(CATEGORY_MAP.BIRTHDAY_WISH).toBe('ANNOUNCEMENT');
  });
  it('REFERRAL_REWARD maps to ANNOUNCEMENT', () => {
    expect(CATEGORY_MAP.REFERRAL_REWARD).toBe('ANNOUNCEMENT');
  });

  describe('deriveCategoryFromTitle (English title-keyword fallback)', () => {
    it('top-up notifications go to PAYMENT', () => {
      expect(deriveCategoryFromTitle('Wallet top-up successful')).toBe('PAYMENT');
    });
    it('rent notifications go to PAYMENT', () => {
      expect(deriveCategoryFromTitle('Daily Rent Deducted: ₹500')).toBe('PAYMENT');
    });
    it('KYC notifications go to KYC', () => {
      expect(deriveCategoryFromTitle('KYC Approved!')).toBe('KYC');
    });
    it('document notifications go to KYC', () => {
      expect(deriveCategoryFromTitle('Please re-upload your document')).toBe('KYC');
    });
    it('maintenance notifications go to MAINTENANCE', () => {
      expect(deriveCategoryFromTitle('Vehicle service due')).toBe('MAINTENANCE');
    });
    it('battery swap notifications go to MAINTENANCE', () => {
      expect(deriveCategoryFromTitle('Battery swap required')).toBe('MAINTENANCE');
    });
    it('reward notifications go to ANNOUNCEMENT', () => {
      expect(deriveCategoryFromTitle('Reward Earned!')).toBe('ANNOUNCEMENT');
    });
    it('offer notifications go to ANNOUNCEMENT', () => {
      expect(deriveCategoryFromTitle('Monsoon Special Offer')).toBe('ANNOUNCEMENT');
    });
    it('unknown titles go to SYSTEM', () => {
      expect(deriveCategoryFromTitle('Important account notice')).toBe('SYSTEM');
    });
    it('Hindi titles go to SYSTEM (not categorized — limitation acknowledged)', () => {
      expect(deriveCategoryFromTitle('दस्तावेज़ सत्यापन पूरा हुआ')).toBe('SYSTEM');
    });
  });
});