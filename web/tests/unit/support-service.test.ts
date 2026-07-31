import { describe, it, expect, vi, beforeEach } from 'vitest';
import { riderSupportUseCases } from '@/server/modules/support/rider-support.use-cases';
import { supportRepository } from '@/server/modules/support/support.repository';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: { supportTicket: { count: vi.fn() } }
}));

vi.mock('@/server/modules/support/support.repository', () => ({
  supportRepository: {
    create: vi.fn(),
    findByRiderId: vi.fn(),
    findById: vi.fn(),
    addMessage: vi.fn(),
    update: vi.fn(),
  }
}));

describe('Support Use Cases - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createTicket sanitizes input and generates ticket ID', async () => {
    (db.supportTicket.count as any).mockResolvedValue(42);
    (supportRepository.create as any).mockResolvedValue({ id: 'ticket-1' });

    const result = await riderSupportUseCases.createTicket('rider-1', {
      subject: '<script>alert(1)</script>Help',
      message: '<b>Need</b> help',
      category: 'GENERAL'
    } as any);

    expect(supportRepository.create).toHaveBeenCalledWith('rider-1', expect.objectContaining({
      subject: 'Help', // Sanitized (assuming sanitizeHtml strips scripts)
      message: '<b>Need</b> help', // Allows some html
      status: 'OPEN',
      ticketId: expect.stringMatching(/^TICKET-\d+-[A-Z0-9]+$/),
    }));
    expect(result).toBeDefined();
  });

  it('getTickets returns rider tickets', async () => {
    (supportRepository.findByRiderId as any).mockResolvedValue([]);
    const result = await riderSupportUseCases.getTickets('rider-1');
    expect(supportRepository.findByRiderId).toHaveBeenCalledWith('rider-1', undefined, undefined);
    expect(result).toEqual([]);
  });

  it('getTicket returns specific ticket', async () => {
    (supportRepository.findById as any).mockResolvedValue({ id: 'ticket-1' });
    const result = await riderSupportUseCases.getTicket('ticket-1');
    expect(supportRepository.findById).toHaveBeenCalledWith('ticket-1');
    expect(result).toBeDefined();
  });
});
