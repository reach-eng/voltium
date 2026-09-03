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
    // AUDIT-RECON 2026-09-02 batch 6 P0-4: `attachments` is a scalar
    // column on SupportTicket (prisma/schema.prisma:645) — a
    // comma-separated list of uploaded photo URLs. It must be in
    // `select` (not `include`, which is for relations). Switched the
    // query to `select` so we can pull the scalar alongside the
    // `messages` relation. The list of columns matches what
    // `db.supportTicket.findUnique` returns by default minus the
    // heavy encrypted-PII fields the admin detail view doesn't need.
    const ticketSelect = {
      id: true,
      ticketId: true,
      riderId: true,
      vehicleId: true,
      category: true,
      priority: true,
      subject: true,
      message: true,
      status: true,
      troubleshootPath: true,
      assignedTo: true,
      isEscalated: true,
      escalatedAt: true,
      escalatedBy: true,
      resolvedAt: true,
      deletedAt: true,
      attachments: true,
      createdAt: true,
      updatedAt: true,
      messages: { orderBy: { createdAt: 'asc' as const } },
    } as const;
    const direct = await db.supportTicket.findUnique({
      where: { id: ticketId },
      select: ticketSelect,
    });
    if (direct) return direct;

    const formattedTicketId = ticketId.startsWith('#') ? ticketId : `#${ticketId}`;
    return db.supportTicket.findFirst({
      where: {
        OR: [{ ticketId }, { ticketId: formattedTicketId }],
      },
      select: ticketSelect,
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
    attachments?: string | string[]
  ) {
    const serializedAttachments = Array.isArray(attachments)
      ? JSON.stringify(attachments)
      : attachments;
    return db.ticketMessage.create({
      data: { ticketId, senderId, senderType, message, attachments: serializedAttachments },
    });
  },

  async findMessages(ticketId: string) {
    return db.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
  },

  async getFaqs() {
    // P1: bound — FAQs are a small reference table, but never unbounded.
    return db.faq.findMany({ where: { isActive: true }, orderBy: { order: 'asc' }, take: 200 });
  },

  async findByIdWithMessages(ticketId: string) {
    // AUDIT-RECON 2026-09-02 batch 6 P0-4: `attachments` is a
    // scalar column (schema.prisma:645), so it goes in `select` not
    // `include`. Restructured to a single `select` block that pulls
    // all SupportTicket columns the admin detail view needs
    // (incl. the existing rider + messages relations) plus the
    // previously-dropped attachments column.
    const ticketSelect = {
      id: true,
      ticketId: true,
      riderId: true,
      vehicleId: true,
      category: true,
      priority: true,
      subject: true,
      message: true,
      status: true,
      troubleshootPath: true,
      assignedTo: true,
      isEscalated: true,
      escalatedAt: true,
      escalatedBy: true,
      resolvedAt: true,
      deletedAt: true,
      attachments: true,
      createdAt: true,
      updatedAt: true,
      rider: { select: { fullName: true, riderId: true, phone: true } },
      messages: {
        orderBy: { createdAt: 'asc' as const },
        select: {
          id: true,
          senderId: true,
          senderType: true,
          message: true,
          attachments: true,
          createdAt: true,
        },
      },
    } as const;
    const direct = await db.supportTicket.findUnique({
      where: { id: ticketId },
      select: ticketSelect,
    });
    if (direct) return direct;

    const formattedTicketId = ticketId.startsWith('#') ? ticketId : `#${ticketId}`;
    return db.supportTicket.findFirst({
      where: {
        OR: [{ ticketId }, { ticketId: formattedTicketId }],
      },
      select: ticketSelect,
    });
  },

  async bulkUpdate(ids: string[], data: Record<string, unknown>) {
    return db.supportTicket.updateMany({ where: { id: { in: ids } }, data });
  },
};
