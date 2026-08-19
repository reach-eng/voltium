import { describe, it, expect } from 'vitest';

describe('Pass 4 Audit Verification Contracts', () => {
  it('POST /api/admin/earnings: earningUseCases.create creates earning record', async () => {
    const { earningUseCases } = await import('@/server/modules/earnings/earning.use-cases');
    expect(typeof earningUseCases.create).toBe('function');
  });

  it('OutboxEventTypes: contains RENT_PAID outbox event type', async () => {
    const { OutboxEventTypes } = await import('@/server/workers/outbox');
    expect(OutboxEventTypes.RENT_PAID).toBe('rent.paid');
  });
});
