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
import { maskPhone } from '@/lib/pii';
import type { CreateTicketDto, TicketReplyDto } from './support.schemas';
import { validateTicketTransition, type TicketStatus } from './ticket-state-machine';

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
        // Attachments may be a JSON array (new clients) or CSV (legacy).
        // Normalize + cap at 5 URLs; drop blanks.
        let attachments: string | undefined;
        const raw = (input as { attachments?: unknown }).attachments;
        if (Array.isArray(raw)) {
          const urls = (raw as unknown[])
            .filter((u): u is string => typeof u === 'string' && u.length > 0)
            .slice(0, 5);
          attachments = urls.length > 0 ? JSON.stringify(urls) : undefined;
        } else if (typeof raw === 'string' && raw.trim().length > 0) {
          attachments = raw.trim().slice(0, 5000);
        }
        return await supportRepository.create(riderDbId, {
          ...input,
          subject: sanitizeHtml(input.subject),
          message: sanitizeHtml(input.message),
          attachments: attachments as string | undefined,
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

  /**
   * Tenant-scoped read. Pass `riderDbId` on rider-facing paths —
   * cross-rider access returns null (callers map to 404, no oracle).
   * Admin paths omit it (permission-checked at the route layer).
   */
  async getTicket(ticketId: string, riderDbId?: string) {
    const ticket = await supportRepository.findById(ticketId);
    if (!ticket) return null;
    if (riderDbId && (ticket as { riderId?: string }).riderId !== riderDbId) {
      return null;
    }
    return ticket;
  },

  async updateTicket(ticketId: string, input: Record<string, unknown>) {
    // Strip schema-accepted but non-column fields (e.g.
    // `refundAmountInPaise` from updateTicketSchema) — passing them to
    // Prisma throws an unknown-field error → 500. Only real columns pass.
    const { refundAmountInPaise: _refund, ...columnInput } = input;
    void _refund;
    input = columnInput;
    if (input.status) {
      const existing = await db.supportTicket.findUnique({
        where: { id: ticketId },
        select: { status: true },
      });
      if (existing) {
        validateTicketTransition(existing.status as TicketStatus, input.status as TicketStatus);
      }
    }
    // P1: `assignedTo` was free text — typos/deleted admins produced dangling
    // assignments. Resolve against live admins: set the FK pointer alongside
    // the legacy string (UI compat). Unknown ids are rejected, not stored.
    if (input.assignedTo !== undefined && input.assignedTo !== null) {
      const { db } = await import('@/lib/db');
      const admin = await db.admin.findUnique({
        where: { id: String(input.assignedTo) },
        select: { id: true, isActive: true },
      });
      if (!admin) throw new Error('Assigned admin not found');
      if (!admin.isActive) throw new Error('Assigned admin is not active');
      (input as Record<string, unknown>).assignedToId = admin.id;
    } else if (input.assignedTo === null) {
      (input as Record<string, unknown>).assignedToId = null;
    }
    return supportRepository.update(ticketId, input);
  },

  async replyToTicket(
    ticketId: string,
    senderId: string,
    senderType: 'RIDER' | 'ADMIN',
    input: TicketReplyDto,
    expectedRiderId?: string
  ) {
    const ticket = await supportRepository.findById(ticketId);
    if (!ticket) throw new Error('Ticket not found');
    // Defense-in-depth tenant check — even if a future caller forgets
    // the route-layer ownership check, a rider can never reply to
    // another rider's ticket. No oracle: same generic message.
    if (expectedRiderId && ticket.riderId !== expectedRiderId) {
      throw new Error('Ticket not found');
    }
    // Validate + normalize message attachments (URLs only, max 5).
    let replyAttachments: string | undefined;
    const rawAtt = (input as { attachments?: unknown }).attachments;
    if (Array.isArray(rawAtt)) {
      const urls = (rawAtt as unknown[])
        .filter(
          (u): u is string =>
            typeof u === 'string' && u.length > 0 && /^https?:\/\//.test(u)
        )
        .slice(0, 5);
      replyAttachments = urls.length > 0 ? JSON.stringify(urls) : undefined;
    } else if (typeof rawAtt === 'string' && rawAtt.trim().length > 0) {
      replyAttachments = /^https?:\/\//.test(rawAtt.trim())
        ? rawAtt.trim().slice(0, 5000)
        : undefined;
    }

    const message = await supportRepository.addMessage(
      ticketId,
      senderId,
      senderType,
      sanitizeHtml(input.message),
      replyAttachments
    );

    // A rider reply answers the WAITING_ON_RIDER state — advance to
    // IN_PROGRESS so the ticket doesn't stall in the wrong state.
    const nextStatus =
      senderType === 'RIDER' &&
      (ticket as { status?: string }).status === 'WAITING_ON_RIDER'
        ? { status: 'IN_PROGRESS' as const, updatedAt: new Date() }
        : { updatedAt: new Date() };
    await supportRepository.update(ticketId, nextStatus);

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
   * Recent SOS triggers for the safety banners. SOS alerts are NOT
   * support tickets (TicketCategory has no SOS member) — they are
   * `emergency.sos_triggered` audit-log events. Returns newest-first,
   * with best-effort location/contact context parsed from details.
   */
  async getRecentSosEvents({ hours = 24, limit = 10 }: { hours?: number; limit?: number } = {}) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const [total, rows] = await Promise.all([
      db.auditLog.count({
        where: { action: 'emergency.sos_triggered', createdAt: { gte: since } },
      }),
      db.auditLog.findMany({
        where: { action: 'emergency.sos_triggered', createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(limit, 1), 50),
        select: { id: true, actorId: true, entityId: true, details: true, createdAt: true },
      }),
    ]);

    const events = rows.map((row) => {
      let details: Record<string, unknown> = {};
      try {
        const parsed: unknown = JSON.parse(row.details ?? '{}');
        if (parsed && typeof parsed === 'object') details = parsed as Record<string, unknown>;
      } catch {
        details = {};
      }
      const num = (v: unknown): number | null =>
        typeof v === 'number' && Number.isFinite(v) ? v : null;
      return {
        id: row.id,
        riderId: row.entityId,
        createdAt: row.createdAt,
        latitude: num(details.latitude),
        longitude: num(details.longitude),
        contactCount: typeof details.contactCount === 'number' ? details.contactCount : null,
        triggeredVia: typeof details.triggeredVia === 'string' ? details.triggeredVia : null,
      };
    });

    return { events, total };
  },

  /**
   * Admin ticket listing with search, pagination, and rider info.
   */
  async getAdminTickets(
    query: {
      status?: string;
      priority?: string;
      search?: string;
      page?: number;
      limit?: number;
      /**
       * Lean projection for high-frequency pollers (dashboard). Drops
       * rider PII (`riderName`/`riderPhone`), message bodies, and
       * attachments — the dashboard card renders id/subject/category/
       * priority/status only. Default false (tickets screen needs it all).
       */
      lean?: boolean;
    }
  ) {
    const { status, priority, search, page = 1, limit = 20, lean = false } = query;
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

    const [tickets, total, openCount, inProgressCount, waitingOnRiderCount, resolvedCount, closedCount] =
      await Promise.all([
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

    const formatted = tickets.map((t) =>
      lean
        ? {
            id: t.id,
            ticketId: t.ticketId,
            category: t.category,
            priority: t.priority,
            subject: t.subject,
            status: t.status,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          }
        : {
            id: t.id,
            ticketId: t.ticketId,
            riderId: t.riderId,
            // Mask the display fallback — the raw phone stays in riderPhone.
            riderName: t.rider?.fullName || maskPhone(t.rider?.phone ?? null) || 'Unknown',
            riderPhone: t.rider?.phone,
            category: t.category,
            priority: t.priority,
            subject: t.subject,
            message: t.message,
            status: t.status,
            assignedTo: t.assignedTo,
            attachments: t.attachments,
            resolvedAt: t.resolvedAt,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          }
    );

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
      riderName:
        ticket.rider?.fullName || maskPhone(ticket.rider?.phone ?? null) || 'Unknown',
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
    let skippedCount = 0;
    let auditAction = '';

    // Bulk transitions must respect the state machine per ticket.
    // Illegal edges are skipped (counted) instead of written.
    const transitionOne = async (
      id: string,
      target: TicketStatus,
      extra: Record<string, unknown> = {}
    ): Promise<boolean> => {
      const existing = await db.supportTicket.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!existing) {
        skippedCount++;
        return false;
      }
      try {
        validateTicketTransition(
          existing.status as TicketStatus,
          target
        );
      } catch {
        skippedCount++;
        return false;
      }
      await supportRepository.update(id, { status: target, ...extra });
      updatedCount++;
      return true;
    };

    switch (action) {
      case 'changeStatus': {
        if (!value) throw new Error('Status value is required');
        const target = value as TicketStatus;
        const extra: Record<string, unknown> =
          value === 'RESOLVED' || value === 'CLOSED'
            ? { resolvedAt: new Date() }
            : value === 'OPEN' || value === 'IN_PROGRESS'
              ? { resolvedAt: null }
              : {};
        for (const id of ids) {
          await transitionOne(id, target, extra);
        }
        auditAction = 'ticket.bulk_change_status';
        break;
      }
      case 'revert': {
        // Revert is an explicit admin UNDO override, not a normal lifecycle
        // edge (the machine has no re-open path by design). Bypass the
        // machine intentionally and record the override in audit.
        const result = await supportRepository.bulkUpdate(ids, {
          status: 'OPEN',
          resolvedAt: null,
        });
        updatedCount = result.count;
        skippedCount = ids.length - result.count;
        auditAction = 'ticket.bulk_revert';
        break;
      }
      case 'assign': {
        if (!value) throw new Error('Admin ID is required');
        // P1: resolve against live admins like the single-ticket path —
        // bulk previously stored any string (dangling assignments).
        if (value !== '_none') {
          const admin = await db.admin.findUnique({
            where: { id: value },
            select: { id: true, isActive: true },
          });
          if (!admin) throw new Error('Assigned admin not found');
          if (!admin.isActive) throw new Error('Assigned admin is not active');
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
        // P1: an invalid priority string reached Prisma → 500.
        if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(value)) {
          throw new Error(`Invalid priority value: "${value}"`);
        }
        const result = await supportRepository.bulkUpdate(ids, { priority: value });
        updatedCount = result.count;
        auditAction = 'ticket.bulk_change_priority';
        break;
      }
      case 'escalate': {
        // `ticketBulkActionSchema` allows 'escalate' — flag escalation
        // metadata without touching the state machine status.
        const result = await db.supportTicket.updateMany({
          where: { id: { in: ids } },
          data: { isEscalated: true, escalatedAt: new Date(), escalatedBy: actorId },
        });
        updatedCount = result.count;
        skippedCount = ids.length - result.count;
        auditAction = 'ticket.bulk_escalate';
        break;
      }
      case 'closeResolved': {
        // RESOLVED → CLOSED is the only legal close edge; updateMany is
        // safe here because the where clause already enforces it.
        const result = await db.supportTicket.updateMany({
          where: { id: { in: ids }, status: 'RESOLVED' },
          data: { status: 'CLOSED', resolvedAt: new Date() },
        });
        updatedCount = result.count;
        skippedCount = ids.length - result.count;
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
      details: {
        ids,
        ...(value ? { value } : {}),
        count: updatedCount,
        skipped: skippedCount,
      },
    }).catch((e: unknown) => logger.error('Audit log failed for bulk ticket action', e));

    return { count: updatedCount, skipped: skippedCount };
  },
};
