/**
 * Rider support use-cases — minimal stub.
 */

import { db } from '@/lib/db';

export const riderSupportUseCases = {
  async createTicket(riderId: string, input: { subject: string; message: string; category?: string }): Promise<{ ticket: { id: string; status: string } }> {
    const ticket = await db.supportTicket.create({
      data: {
        riderId,
        subject: input.subject,
        message: input.message,
        category: input.category ?? 'GENERAL',
        status: 'OPEN',
      },
    });
    return { ticket: { id: ticket.id, status: ticket.status } };
  },

  async getTickets(riderId: string): Promise<{ tickets: unknown[] }> {
    const tickets = await db.supportTicket.findMany({ where: { riderId } });
    return { tickets };
  },

  async getTicket(ticketId: string): Promise<{ ticket: unknown | null }> {
    const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
    return { ticket };
  },
};
