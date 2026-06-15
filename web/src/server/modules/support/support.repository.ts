/**
 * Support module - Repository.
 *
 * Data access for support tickets, messages, and FAQ entries.
 */

import { db } from '@/lib/db';

export const supportRepository = {
  async create(riderDbId: string, data: Record<string, unknown>) {
    return db.supportTicket.create({
      data: {
        ...data,
        riderId: riderDbId,
        status: 'OPEN',
      },
    });
  },

  async findById(ticketId: string) {
    return db.supportTicket.findUnique({
      where: { id: ticketId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  },

  async findByRiderId(riderDbId: string) {
    return db.supportTicket.findMany({
      where: { riderId: riderDbId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findAll(query: Record<string, unknown>) {
    const { status, category, priority, page = 1, limit = 20 } = query as any;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;

    const skip = (page - 1) * limit;
    return db.supportTicket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    });
  },

  async update(ticketId: string, data: Record<string, unknown>) {
    return db.supportTicket.update({ where: { id: ticketId }, data });
  },

  async addMessage(ticketId: string, senderId: string, senderType: string, message: string, attachments?: string) {
    return db.supportTicketMessage.create({
      data: { ticketId, senderId, senderType, message, attachments },
    });
  },

  async getFaqs() {
    return db.faq.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } });
  },

  async findByIdWithMessages(ticketId: string) {
    return db.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        rider: { select: { fullName: true, riderId: true, phone: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, senderId: true, senderType: true, message: true, attachments: true, createdAt: true },
        },
      },
    });
  },

  async bulkUpdate(ids: string[], data: Record<string, unknown>) {
    return db.supportTicket.updateMany({ where: { id: { in: ids } }, data });
  },
};
