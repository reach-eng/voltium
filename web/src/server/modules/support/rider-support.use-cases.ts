import { db } from '@/lib/db';
import { supportRepository } from './support.repository';
import { sanitizeHtml } from '@/lib/sanitize';
import { randomBytes } from 'crypto';

export const riderSupportUseCases = {
  async createTicket(riderId: string, input: { subject: string; message: string; category?: string }) {
    const count = (await db.supportTicket?.count?.()) ?? 1;
    const random = randomBytes(2).toString('hex').toUpperCase();
    const ticketId = `TICKET-${count + 1}-${random}`;

    return supportRepository.create(riderId, {
      subject: sanitizeHtml(input.subject),
      message: sanitizeHtml(input.message),
      category: input.category ?? 'GENERAL',
      ticketId,
      status: 'OPEN',
    });
  },

  async getTickets(riderId: string, limit?: number, offset?: number) {
    return (supportRepository as any).findByRiderId(riderId, limit, offset);
  },

  async getTicket(ticketId: string) {
    return supportRepository.findById(ticketId);
  },

  async getFAQs() {
    return (supportRepository as any).getFaqs?.() ?? [];
  },
};
