/**
 * Support module - Use cases.
 *
 * Orchestrates support ticket management, FAQ, and chat workflows.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { randomBytes } from 'crypto';
import { supportRepository } from './support.repository';
import { createAuditLog } from '@/lib/audit-log';
import { notificationService } from '@/lib/notification-service';
import { sanitizeHtml } from '@/lib/sanitize';
import type { CreateTicketDto, TicketReplyDto } from './support.schemas';

export const supportUseCases = {
  async createTicket(riderDbId: string, input: CreateTicketDto) {
    // PR-80: ticket id collision fix. The previous code used
    // `count + 1` + a 4-hex-char (65k space) random. Two parallel
    // creates could read the same count and collide on the random.
    // At ~300 tickets/day, birthday-bound collision is plausible.
    // Use 4 random bytes (4 billion space) and drop the count.
    // The DB `@@unique` constraint on `ticketId` is the real
    // collision guard; we add a small retry loop to handle the
    // (now extremely rare) race.
    let attempts = 0;
    // PR-80: ticket id collision fix. The previous code used
    // `count + 1` + a 4-hex-char (65k space) random. Two parallel
    // creates could read the same count and collide on the random.
    // At ~300 tickets/day, birthday-bound collision is plausible.
    // Use 4 random bytes (4 billion space) and drop the count.
    // The DB `@@unique` constraint on `ticketId` is the real
    // collision guard; we add a small retry loop to handle the
    // (now extremely rare) race.
    for (;;) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      const ticketId = `#${random}`;
      try {
        return await supportRepository.create(riderDbId, {
          ...input,
          subject: sanitizeHtml(input.subject),
          message: sanitizeHtml(input.message),
          ticketId,
          status: 'OPEN',
        });
      } catch (err: unknown) {
        // P2002 = unique constraint violation; retry with a new random
        const e = err as { code?: string };
        if (e?.code === 'P2002' && attempts < 5) {
          attempts++;
          continue;
        }
        throw err;
      }
    }
  },

  async getTickets(riderDbId: string) {
    return supportRepository.findByRiderId(riderDbId);
  },

  async getTicket(ticketId: string) {
    return supportRepository.findById(ticketId);
  },

  async updateTicket(ticketId: string, input: Record<string, unknown>) {
    return supportRepository.update(ticketId, input);
  },

  async replyToTicket(
    ticketId: string,
    senderId: string,
    senderType: 'RIDER' | 'ADMIN',
    input: TicketReplyDto
  ) {
    const ticket = await supportRepository.findById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const message = await supportRepository.addMessage(
      ticketId,
      senderId,
      senderType,
      sanitizeHtml(input.message),
      input.attachments ?? undefined
    );

    await supportRepository.update(ticketId, { updatedAt: new Date() });

    if (senderType === 'ADMIN') {
      notificationService
        .notifySupportReply(ticket.riderId, ticket.id, ticket.subject)
        .catch((e: unknown) => logger.error('Failed to send notification', e));
    }

    return message;
  },

  async getFAQs() {
    return supportRepository.getFaqs();
  },

  /**
   * Admin ticket listing with search, pagination, and rider info.
   */
  async getAdminTickets(query: {
    status?: string;
    priority?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, priority, search, page = 1, limit = 20 } = query;
    const searchWhere: Prisma.SupportTicketWhereInput = {};
    if (priority) searchWhere.priority = priority as Prisma.SupportTicketWhereInput['priority'];
    if (search) {
      const trimmed = search.trim();
      searchWhere.OR = [
        { ticketId: { contains: trimmed, mode: 'insensitive' } },
        { subject: { contains: trimmed, mode: 'insensitive' } },
        { rider: { fullName: { contains: trimmed, mode: 'insensitive' } } },
        { rider: { phone: { contains: trimmed } } },
        { rider: { riderId: { contains: trimmed, mode: 'insensitive' } } },
      ];
    }
    const where: Prisma.SupportTicketWhereInput = {
      ...searchWhere,
      ...(status ? { status: status as Prisma.SupportTicketWhereInput['status'] } : {}),
    };

    const [tickets, total, openCount, inProgressCount, resolvedCount, closedCount] = await Promise.all([
      db.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          rider: { select: { fullName: true, riderId: true, phone: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.supportTicket.count({ where }),
      db.supportTicket.count({ where: { ...searchWhere, status: 'OPEN' } }),
      db.supportTicket.count({ where: { ...searchWhere, status: 'IN_PROGRESS' } }),
      db.supportTicket.count({ where: { ...searchWhere, status: 'RESOLVED' } }),
      db.supportTicket.count({ where: { ...searchWhere, status: 'CLOSED' } }),
    ]);

    const formatted = tickets.map((t) => ({
      id: t.id,
      ticketId: t.ticketId,
      riderId: t.riderId,
      riderName: t.rider?.fullName || t.rider?.phone || 'Unknown',
      riderPhone: t.rider?.phone,
      category: t.category,
      priority: t.priority,
      subject: t.subject,
      message: t.message,
      status: t.status,
      assignedTo: t.assignedTo,
      // AUDIT-RECON 2026-09-02 batch 6 P0-4: include ticket-level
      // attachments (comma-separated URL list per the rider app)
      // so the admin can see evidence photos in the list row + the
      // detail dialog. The DB column was always populated; the
      // response was previously stripping it.
      attachments: t.attachments,
      resolvedAt: t.resolvedAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return {
      tickets: formatted,
      statusCounts: {
        all: openCount + inProgressCount + resolvedCount + closedCount,
        OPEN: openCount,
        IN_PROGRESS: inProgressCount,
        RESOLVED: resolvedCount,
        CLOSED: closedCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Creates an audit log entry for admin ticket actions.
   */
  async logAdminAction(
    actorId: string,
    params: {
      action: string;
      ticketId: string;
      details?: Record<string, unknown>;
    }
  ) {
    await createAuditLog({
      actorId,
      action: params.action,
      entity: 'ticket',
      entityId: params.ticketId,
      details: params.details ?? {},
    }).catch((e: unknown) => logger.error('Audit log failed for ticket', e));
  },

  async getAdminTicket(ticketId: string) {
    const ticket = await supportRepository.findByIdWithMessages(ticketId);
    if (!ticket) return null;

    return {
      id: ticket.id,
      ticketId: ticket.ticketId,
      riderId: ticket.riderId,
      riderName: ticket.rider?.fullName || ticket.rider?.phone || 'Unknown',
      riderPhone: ticket.rider?.phone,
      category: ticket.category,
      priority: ticket.priority,
      subject: ticket.subject,
      message: ticket.message,
      status: ticket.status,
      assignedTo: ticket.assignedTo,
      // AUDIT-RECON 2026-09-02 batch 6 P0-4: surface ticket-level
      // attachments so the admin detail dialog can render the
      // photos a rider submitted with the ticket. Was previously
      // dropped in the formatted response.
      attachments: ticket.attachments,
      resolvedAt: ticket.resolvedAt,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      messages: ticket.messages || [],
    };
  },

  async bulkUpdateTickets(
    ids: string[],
    action: string,
    value: string | undefined,
    actorId: string
  ) {
    let updatedCount = 0;
    let auditAction = '';

    switch (action) {
      case 'changeStatus': {
        if (!value) throw new Error('Status value is required');
        const statusData: Record<string, unknown> = { status: value };
        if (value === 'RESOLVED' || value === 'CLOSED') {
          statusData.resolvedAt = new Date();
        }
        const result = await supportRepository.bulkUpdate(ids, statusData);
        updatedCount = result.count;
        auditAction = 'ticket.bulk_change_status';
        break;
      }
      case 'revert': {
        const result = await supportRepository.bulkUpdate(ids, {
          status: 'OPEN',
          resolvedAt: null,
        });
        updatedCount = result.count;
        auditAction = 'ticket.bulk_revert';
        break;
      }
      case 'assign': {
        if (!value) throw new Error('Admin ID is required');
        const result = await supportRepository.bulkUpdate(ids, {
          assignedTo: value === '_none' ? null : value,
        });
        updatedCount = result.count;
        auditAction = 'ticket.bulk_assign';
        break;
      }
      case 'changePriority': {
        if (!value) throw new Error('Priority value is required');
        const result = await supportRepository.bulkUpdate(ids, { priority: value });
        updatedCount = result.count;
        auditAction = 'ticket.bulk_change_priority';
        break;
      }
      case 'closeResolved': {
        const result = await db.supportTicket.updateMany({
          where: { id: { in: ids }, status: 'RESOLVED' },
          data: { status: 'CLOSED', resolvedAt: new Date() },
        });
        updatedCount = result.count;
        auditAction = 'ticket.bulk_close_resolved';
        break;
      }
      default:
        throw new Error('Invalid action');
    }

    createAuditLog({
      actorId,
      action: auditAction,
      entity: 'ticket',
      entityId: 'multiple',
      details: { ids, ...(value ? { value } : {}), count: updatedCount },
    }).catch((e: unknown) => logger.error('Audit log failed for bulk ticket action', e));

    return { count: updatedCount };
  },
};
