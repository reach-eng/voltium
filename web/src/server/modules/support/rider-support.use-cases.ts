import { randomBytes } from 'crypto';
import { supportRepository } from './support.repository';
import { sanitizeHtml } from '@/lib/sanitize';
import type { CreateTicketDto } from './support.schemas';

export const riderSupportUseCases = {
  async createTicket(riderDbId: string, input: CreateTicketDto) {
    // Generate unique timestamp-based ticket ID under high concurrency
    const random = randomBytes(2).toString('hex').toUpperCase();
    const ticketId = `TICKET-${Date.now()}-${random}`;

    return supportRepository.create(riderDbId, {
      ...input,
      subject: sanitizeHtml(input.subject),
      message: sanitizeHtml(input.message),
      ticketId,
      status: 'OPEN',
    });
  },

  async getTickets(riderDbId: string, page?: number, limit?: number) {
    return supportRepository.findByRiderId(riderDbId, page, limit);
  },

  async getTicket(ticketId: string) {
    return supportRepository.findById(ticketId);
  },

  async getFAQs() {
    return supportRepository.getFaqs();
  },
};
