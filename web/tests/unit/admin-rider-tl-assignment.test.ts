import { describe, it, expect, vi } from 'vitest';
import { updateRiderSchema } from '@/app/api/admin/riders/route';

describe('P1-1: updateRiderSchema and TL Assignment', () => {
  it('accepts teamLeaderId in updateRiderSchema', () => {
    const parsed = updateRiderSchema.safeParse({
      id: 'rider_123',
      teamLeaderId: 'clh8x7jkl000008l07b6h5q5a',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.teamLeaderId).toBe('clh8x7jkl000008l07b6h5q5a');
    }
  });

  it('accepts null or empty string for unassigning teamLeaderId', () => {
    const parsedNull = updateRiderSchema.safeParse({
      id: 'rider_123',
      teamLeaderId: null,
    });
    expect(parsedNull.success).toBe(true);

    const parsedEmpty = updateRiderSchema.safeParse({
      id: 'rider_123',
      teamLeaderId: '',
    });
    expect(parsedEmpty.success).toBe(true);
  });
});
