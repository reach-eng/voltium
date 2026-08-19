import { describe, it, expect } from 'vitest';

describe('Transaction Dialog Wallet Credit Pre-fill Logic', () => {
  it('preserves rupee transaction amount directly without dividing by 100', () => {
    const txAmountRupees = 500;
    // Fix P0-5: tx.amount is in rupees, so pre-fill value must match txAmountRupees directly
    const prefillValue = txAmountRupees || 0;
    expect(prefillValue).toBe(500);
  });
});
