import { describe, it, expect } from 'vitest';

describe('Pass 3 Audit Contracts', () => {
  it('converts discountValue to discountValueInPaise correctly for update payload', () => {
    const processUpdateData = (data: { discountValue?: number; discountType?: string }) => {
      const updateData = { ...data } as Record<string, unknown>;
      if (updateData.discountValue !== undefined) {
        const discountType = updateData.discountType ?? 'FIXED';
        updateData.discountValueInPaise =
          discountType === 'FIXED'
            ? Number(updateData.discountValue) * 100
            : Number(updateData.discountValue);
        delete updateData.discountValue;
      }
      return updateData;
    };

    const fixedPayload = processUpdateData({ discountValue: 50, discountType: 'FIXED' });
    expect(fixedPayload.discountValueInPaise).toBe(5000);
    expect(fixedPayload.discountValue).toBeUndefined();

    const percentagePayload = processUpdateData({ discountValue: 15, discountType: 'PERCENTAGE' });
    expect(percentagePayload.discountValueInPaise).toBe(15);
    expect(percentagePayload.discountValue).toBeUndefined();
  });

  it('supports multi-section expansion set logic for legal screen', () => {
    const expandedIds = new Set<string>();
    const toggleSection = (id: string) => {
      if (expandedIds.has(id)) {
        expandedIds.delete(id);
      } else {
        expandedIds.add(id);
      }
    };

    toggleSection('terms');
    expect(expandedIds.has('terms')).toBe(true);

    toggleSection('privacy');
    expect(expandedIds.has('terms')).toBe(true);
    expect(expandedIds.has('privacy')).toBe(true);

    toggleSection('terms');
    expect(expandedIds.has('terms')).toBe(false);
    expect(expandedIds.has('privacy')).toBe(true);
  });
});
