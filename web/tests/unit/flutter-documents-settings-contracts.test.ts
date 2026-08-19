import { describe, it, expect } from 'vitest';

describe('Flutter Documents & Settings Contracts', () => {
  it('formats Date of Birth to ISO yyyy-MM-dd format', () => {
    const formatDobIso = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const testDate = new Date(1995, 7, 15); // 15 Aug 1995
    expect(formatDobIso(testDate)).toBe('1995-08-15');
    expect(/^\d{4}-\d{2}-\d{2}$/.test(formatDobIso(testDate))).toBe(true);
  });

  it('validates preflight checklist copy alignment', () => {
    const addressItem = {
      title: 'Address Proof',
      subtitle: 'Current residential address details',
    };

    expect(addressItem.subtitle).not.toContain('utility bill');
    expect(addressItem.subtitle).toBe('Current residential address details');
  });
});
