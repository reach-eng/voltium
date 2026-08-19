import { supportRepository } from './support.repository';
import { sanitizeHtml } from '@/lib/sanitize';
import { randomBytes } from 'crypto';

export const riderSupportUseCases = {
  async createTicket(riderId: string, input: { subject: string; message: string; category?: string }) {
    let attempts = 0;
    for (;;) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      const ticketId = `TICKET-${random}`;
      try {
        return await supportRepository.create(riderId, {
          subject: sanitizeHtml(input.subject),
          message: sanitizeHtml(input.message),
          category: input.category ?? 'GENERAL',
          ticketId,
          status: 'OPEN',
        });
      } catch (err: unknown) {
        const e = err as { code?: string };
        if (e?.code === 'P2002' && attempts < 5) {
          attempts++;
          continue;
        }
        throw err;
      }
    }
  },

  async getTickets(riderId: string, limit?: number, offset?: number) {
    return supportRepository.findByRiderId(riderId);
  },

  async getTicket(ticketId: string) {
    return supportRepository.findById(ticketId);
  },

  async getFAQs() {
    return supportRepository.getFaqs();
  },
};
