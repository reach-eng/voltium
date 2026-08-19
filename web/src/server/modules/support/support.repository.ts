import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type { TicketCategory, TicketPriority, SupportTicketStatus } from '@prisma/client';

export const supportRepository = {
  async create(
    riderDbId: string,
    data: {
      ticketId: string;
      category: string;
      subject: string;
      message: string;
      priority?: string;
      status?: string;
      vehicleId?: string | null;
      attachments?: string | null;
    }
  ) {
    // Typed sweep (2026-08-16): input strings are validated upstream (route
    // zod schema / caller defaults); cast to the schema enums at the Prisma
    // boundary rather than widening the create input.
    return db.supportTicket.create({
      data: {
        ticketId: data.ticketId,
        category: data.category as TicketCategory,
        subject: data.subject,
        message: data.message,
        priority: (data.priority || 'MEDIUM') as TicketPriority,
        riderId: riderDbId,
        status: (data.status ?? 'OPEN') as SupportTicketStatus,
        vehicleId: data.vehicleId || null,
        attachments: data.attachments || null,
      },
    });
  },

  async findById(ticketId: string) {
    const direct = await db.supportTicket.findUnique({
      where: { id: ticketId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (direct) return direct;

    const formattedTicketId = ticketId.startsWith('#') ? ticketId : `#${ticketId}`;
    return db.supportTicket.findFirst({
      where: {
        OR: [{ ticketId }, { ticketId: formattedTicketId }],
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  },

  async findByRiderId(riderDbId: string) {
    return db.supportTicket.findMany({
      where: { riderId: riderDbId },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            message: true,
            senderType: true,
            createdAt: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });
  },

  async findAll(query: {
    status?: string;
    category?: string;
    priority?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, category, priority, page = 1, limit = 20 } = query;
    const where: Prisma.SupportTicketWhereInput = {};
    if (status && typeof status === 'string') where.status = status as Prisma.SupportTicketWhereInput['status'];
    if (category && typeof category === 'string') where.category = category as Prisma.SupportTicketWhereInput['category'];
    if (priority && typeof priority === 'string') where.priority = priority as Prisma.SupportTicketWhereInput['priority'];

    const skip = (page - 1) * limit;
    const [tickets, total] = await Promise.all([
      db.supportTicket.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      db.supportTicket.count({ where }),
    ]);

    return {
      tickets,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async update(ticketId: string, data: Prisma.SupportTicketUpdateInput) {
    return db.supportTicket.update({ where: { id: ticketId }, data });
  },

  async addMessage(
    ticketId: string,
    senderId: string,
    senderType: 'RIDER' | 'ADMIN',
    message: string,
    attachments?: string
  ) {
    return db.ticketMessage.create({
      data: { ticketId, senderId, senderType, message, attachments },
    });
  },

  async findMessages(ticketId: string) {
    return db.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
  },

  async getFaqs() {
    return db.faq.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } });
  },

  async findByIdWithMessages(ticketId: string) {
    const direct = await db.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        rider: { select: { fullName: true, riderId: true, phone: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            senderId: true,
            senderType: true,
            message: true,
            attachments: true,
            createdAt: true,
          },
        },
      },
    });
    if (direct) return direct;

    const formattedTicketId = ticketId.startsWith('#') ? ticketId : `#${ticketId}`;
    return db.supportTicket.findFirst({
      where: {
        OR: [{ ticketId }, { ticketId: formattedTicketId }],
      },
      include: {
        rider: { select: { fullName: true, riderId: true, phone: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            senderId: true,
            senderType: true,
            message: true,
            attachments: true,
            createdAt: true,
          },
        },
      },
    });
  },

  async bulkUpdate(ids: string[], data: Record<string, unknown>) {
    return db.supportTicket.updateMany({ where: { id: { in: ids } }, data });
  },
};
