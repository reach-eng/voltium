import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export const supportRepository = {
  async create(riderDbId: string, data: any) {
    return db.supportTicket.create({
      data: {
        ticketId: data.ticketId,
        category: data.category,
        subject: data.subject,
        message: data.message,
        priority: data.priority || 'MEDIUM',
        riderId: riderDbId,
        status: 'OPEN',
        vehicleId: data.vehicleId || null,
        attachments: data.attachments || null,
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
      where: where as any,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    });
  },

  async update(ticketId: string, data: Prisma.SupportTicketUpdateInput) {
    return db.supportTicket.update({ where: { id: ticketId }, data });
  },

  async addMessage(ticketId: string, senderId: string, senderType: 'RIDER' | 'ADMIN', message: string, attachments?: string) {
    return db.ticketMessage.create({
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
