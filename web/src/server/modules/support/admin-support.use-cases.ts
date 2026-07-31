import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { supportRepository } from './support.repository';
import { createAuditLog } from '@/lib/audit-log';
import { notificationService } from '@/lib/notification-service';
import { validateTicketTransition, getValidSourceTicketStates, type TicketStatus } from './ticket-state-machine';
import { NotFoundError, ValidationError } from "@/lib/api-error";

export const adminSupportUseCases = {
  async updateTicket(ticketId: string, input: Record<string, unknown>, actorId?: string) {
    const existing = await supportRepository.findById(ticketId);
    if (!existing) throw new NotFoundError('Ticket not found');

    // Enforce state machine transitions
    if (input.status && typeof input.status === 'string' && input.status !== existing.status) {
      validateTicketTransition(existing.status as TicketStatus, input.status as TicketStatus);
    }

    const updateData: Record<string, unknown> = { ...input };

    if (input.status === 'RESOLVED' || input.status === 'CLOSED') {
      updateData.resolvedAt = new Date();
    }

    if (input.isEscalated === true || input.action === 'escalate') {
      updateData.isEscalated = true;
      updateData.escalatedAt = new Date();
      if (actorId) updateData.escalatedBy = actorId;
      delete updateData.action;
    }

    // Process dispute refund if specified with idempotency guard
    const refundAmountInPaise = typeof input.refundAmountInPaise === 'number' ? input.refundAmountInPaise : undefined;
    delete updateData.refundAmountInPaise;

    if (refundAmountInPaise && refundAmountInPaise > 0) {
      if ((existing as any).refundAmountInPaise && (existing as any).refundAmountInPaise > 0) {
        throw new ValidationError('REFUND_ALREADY_PROCESSED');
      }
      updateData.refundAmountInPaise = refundAmountInPaise;
      await db.$transaction(async (tx: any) => {
        const wallet = await tx.wallet.findUnique({ where: { riderId: existing.riderId } });
        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balanceInPaise: { increment: refundAmountInPaise } },
          });
          await tx.transaction.create({
            data: {
              riderId: existing.riderId,
              type: 'CREDIT',
              amount: Math.round(refundAmountInPaise / 100),
              status: 'APPROVED',
              purpose: 'REFUND',
              approvedAt: new Date(),
              approvedBy: actorId || null,
              description: `Support dispute resolution refund for ticket ${existing.ticketId}`,
            },
          });
        }
      });
    }

    const updated = await supportRepository.update(ticketId, updateData);

    // Send FCM notification if ticket was resolved or closed
    if (input.status === 'RESOLVED' || input.status === 'CLOSED') {
      notificationService
        .notifySupportReply(existing.riderId, existing.id, `Ticket ${existing.ticketId} has been ${String(input.status).toLowerCase()}`)
        .catch((e: unknown) => logger.error('Failed to send resolution notification', e));
    }

    return updated;
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
        if (!value) throw new ValidationError('Status value is required');
        const validSources = getValidSourceTicketStates(value as TicketStatus);
        const statusData: Record<string, unknown> = { status: value };
        if (value === 'RESOLVED' || value === 'CLOSED') {
          statusData.resolvedAt = new Date();
        }
        const result = await db.supportTicket.updateMany({
          where: { id: { in: ids }, status: { in: validSources } },
          data: statusData as any,
        });
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
        if (!value) throw new ValidationError('Admin ID is required');
        const result = await supportRepository.bulkUpdate(ids, {
          assignedTo: value === '_none' ? null : value,
        });
        updatedCount = result.count;
        auditAction = 'ticket.bulk_assign';
        break;
      }
      case 'changePriority': {
        if (!value) throw new ValidationError('Priority value is required');
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
        const result = await supportRepository.bulkUpdate(ids, {
          isEscalated: true,
          escalatedAt: new Date(),
          escalatedBy: actorId,
          priority: 'HIGH',
        });
        updatedCount = result.count;
        auditAction = 'ticket.bulk_escalate';
        break;
      }
      default:
        throw new ValidationError('Invalid action');
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
