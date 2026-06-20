/**
 * Support module - Use cases.
 *
 * Orchestrates support ticket management, FAQ, and chat workflows.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { randomBytes } from 'crypto';
import { supportRepository } from './support.repository';
import { createAuditLog } from '@/lib/audit-log';
import { notificationService } from '@/lib/notification-service';
import type { CreateTicketDto, TicketReplyDto } from './support.schemas';

export const supportUseCases = {
  async createTicket(riderDbId: string, input: CreateTicketDto) {
    // Generate unique ticket ID
    const count = await db.supportTicket.count();
    const random = randomBytes(2).toString('hex').toUpperCase();
    const ticketId = `#${String(count + 1).padStart(4, '0')}-${random}`;

    return supportRepository.create(riderDbId, {
      ...input,
      ticketId,
      status: 'OPEN',
    });
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
      input.message,
      input.attachments
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
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) {
      (where as any).OR = [
        { ticketId: { contains: search } },
        { subject: { contains: search } },
        { rider: { fullName: { contains: search } } },
      ];
    }

    const [tickets, total] = await Promise.all([
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
    ]);

    const formatted = tickets.map((t: any) => ({
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
      resolvedAt: t.resolvedAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return {
      tickets: formatted,
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
    const ticket: any = await supportRepository.findByIdWithMessages(ticketId);
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
