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
import {
  type TicketStatus,
  validateTicketTransition,
} from './ticket-state-machine';
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
    // Admin Panel Phase 2 P1-12 (2026-08-23): enforce the
    // ticket state machine. Read the current status, validate
    // the transition via the state machine, and throw
    // `TicketStateError` on any invalid move.
    if (input && typeof input === 'object' && 'status' in input && input.status) {
      const targetStatus = input.status as TicketStatus;
      const existing = await supportRepository.findById(ticketId);
      if (!existing) throw new Error('Ticket not found');
      validateTicketTransition(existing.status as TicketStatus, targetStatus);
    }

    // T-2 (W9): validate that assignedTo is an active admin
    if (input && typeof input === 'object' && input.assignedTo !== undefined && input.assignedTo !== null && input.assignedTo !== '_none') {
      const admin = await db.admin.findFirst({
        where: { id: input.assignedTo as string, isActive: true },
        select: { id: true },
      });
      if (!admin) {
        throw new Error('Assignee must be an active admin');
      }
    }

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
    return db.faq.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        category: true,
        question: true,
        answer: true,
      },
    });
  },

  /**
   * Admin ticket listing with search, pagination, and rider info.
   *
   * Admin Panel Phase 4 / Batch C (2026-08-23): the `statusCounts`
   * summary now includes `WAITING_ON_RIDER`. Tickets in this state
   * are waiting for the rider to respond (e.g. additional KYC docs
   * or a clarification) and are common enough to deserve a tab on
   * the admin screen. Without this entry the tab badge would show
   * zero and admins would have to manually scan the OPEN column.
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

    const [
      tickets,
      total,
      openCount,
      inProgressCount,
      waitingOnRiderCount,
      resolvedCount,
      closedCount,
    ] = await Promise.all([
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
      db.supportTicket.count({ where: { ...searchWhere, status: 'WAITING_ON_RIDER' } }),
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
      resolvedAt: t.resolvedAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return {
      tickets: formatted,
      statusCounts: {
        all: openCount + inProgressCount + waitingOnRiderCount + resolvedCount + closedCount,
        OPEN: openCount,
        IN_PROGRESS: inProgressCount,
        WAITING_ON_RIDER: waitingOnRiderCount,
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
        // T-1 (W9): validate ticket state transition for all targeted tickets
        const targetStatus = value as TicketStatus;
        const currentTickets = await db.supportTicket.findMany({
          where: { id: { in: ids } },
          select: { id: true, status: true },
        });
        for (const ticket of currentTickets) {
          validateTicketTransition(ticket.status as TicketStatus, targetStatus);
        }

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
        // T-1 (W9): validate transition to OPEN for each ticket.
        // CLOSED tickets cannot transition directly to OPEN per state machine.
        const currentTickets = await db.supportTicket.findMany({
          where: { id: { in: ids } },
          select: { id: true, status: true },
        });
        for (const ticket of currentTickets) {
          validateTicketTransition(ticket.status as TicketStatus, 'OPEN');
        }

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
        // T-2 (W9): validate that assignee is an active admin
        if (value !== '_none') {
          const admin = await db.admin.findFirst({
            where: { id: value, isActive: true },
            select: { id: true },
          });
          if (!admin) throw new Error('Assignee must be an active admin');
        }

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
      case 'escalate': {
        // T-3 (W9): implement escalate action
        const result = await db.supportTicket.updateMany({
          where: { id: { in: ids } },
          data: {
            isEscalated: true,
            escalatedAt: new Date(),
            escalatedBy: actorId,
            priority: 'CRITICAL',
          },
        });
        updatedCount = result.count;
        auditAction = 'ticket.bulk_escalate';
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
