import { describe, it, expect } from 'vitest';

describe('Flutter Profile & Earnings Contracts', () => {
  it('formats dynamic growth percentage correctly', () => {
    const formatGrowth = (current: number, previous: number): string => {
      if (previous === 0) return current > 0 ? '+100%' : '—';
      const pct = Math.round(((current - previous) / previous) * 100);
      return pct >= 0 ? `+${pct}%` : `${pct}%`;
    };

    expect(formatGrowth(112, 100)).toBe('+12%');
    expect(formatGrowth(150, 100)).toBe('+50%');
    expect(formatGrowth(80, 100)).toBe('-20%');
    expect(formatGrowth(0, 0)).toBe('—');
  });
});
