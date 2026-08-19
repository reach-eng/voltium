import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock('@/server/modules/support/support.repository', () => ({
  supportRepository: { create: mocks.create },
}));

import { riderSupportUseCases } from '@/server/modules/support/rider-support.use-cases';

describe('Rider Ticket ID Collision Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates ticket ID with randomBytes(4) without relying on sequential count', async () => {
    mocks.create.mockResolvedValue({ id: 't_1', ticketId: 'TICKET-A1B2C3D4' });

    const ticket = await riderSupportUseCases.createTicket('r_1', {
      subject: 'Battery Issue',
      message: 'Vehicle stops working',
    });

    expect(mocks.create).toHaveBeenCalledWith(
      'r_1',
      expect.objectContaining({
        ticketId: expect.stringMatching(/^TICKET-[0-9A-F]{8}$/),
      })
    );
    expect(ticket.id).toBe('t_1');
  });
});
