import { describe, it, expect } from 'vitest';
import { ledgerCategoryForPurpose } from '@/server/modules/transactions/transaction.use-cases';

describe('ledgerCategoryForPurpose — approve credits carry their real purpose', () => {
  it('maps TOP_UP to TOP_UP', () => {
    expect(ledgerCategoryForPurpose('TOP_UP')).toBe('TOP_UP');
  });

  it('maps REWARD / REFUND / REVERSAL / RENT_PAYMENT to themselves', () => {
    expect(ledgerCategoryForPurpose('REWARD')).toBe('REWARD');
    expect(ledgerCategoryForPurpose('REFUND')).toBe('REFUND');
    expect(ledgerCategoryForPurpose('REVERSAL')).toBe('REVERSAL');
    expect(ledgerCategoryForPurpose('RENT_PAYMENT')).toBe('RENT_PAYMENT');
  });

  it('is case-insensitive', () => {
    expect(ledgerCategoryForPurpose('top_up')).toBe('TOP_UP');
    expect(ledgerCategoryForPurpose('reward')).toBe('REWARD');
  });

  it('falls back to ADMIN_ADJUSTMENT for unknown/empty purposes', () => {
    expect(ledgerCategoryForPurpose('ADMIN_ADJUSTMENT')).toBe('ADMIN_ADJUSTMENT');
    expect(ledgerCategoryForPurpose('SOMETHING_NEW')).toBe('ADMIN_ADJUSTMENT');
    expect(ledgerCategoryForPurpose('')).toBe('ADMIN_ADJUSTMENT');
  });
});
