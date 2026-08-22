/**
 * POST /api/admin/tickets/[id]/messages — Admin replies to a support ticket
 *
 * PR-1 (2026-08-07 master fix plan): the admin "Send Reply" button called
 * this endpoint, but it never existed. The closest handler is the rider's
 * own /api/support/tickets/[id]/messages, which is the wrong surface for
 * an admin. This route lets a `tickets_view` admin post a message,
 * persists it as ADMIN sender type, and notifies the rider via the
 * centralised notification service.
 *
 * The handler mirrors the rider-side pattern in
 * `web/src/app/api/support/tickets/[id]/messages/route.ts` so the
 * TicketMessage Prisma model stays consistent across surfaces.
 */
import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { supportRepository } from '@/server/modules/support/support.repository';
import { supportUseCases } from '@/server/modules/support/support.use-cases';
import { db } from '@/lib/db';
import { sanitizeHtml } from '@/lib/sanitize';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit-log';

interface PostBody {
  message: string;
  attachments?: string[] | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'tickets_view')) {
    return adminForbidden('Requires tickets_view permission');
  }

  const { id } = await params;

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return errors.badRequest('Invalid JSON body');
  }

  const message = body?.message?.trim();
  if (!message) {
    return errors.badRequest('message is required and must be non-empty');
  }
  if (message.length > 5000) {
    return errors.badRequest('message must be at most 5000 characters');
  }

  try {
    const ticket: any = await supportRepository.findById(id);
    if (!ticket) return errors.notFound('Ticket not found');
    if (ticket.status === 'CLOSED') {
      return errors.badRequest('Cannot reply to a closed ticket');
    }

    const cleanedMessage = sanitizeHtml(message);

    const created = await supportRepository.addMessage(
      id,
      session.adminId || 'system',
      'ADMIN',
      cleanedMessage,
      Array.isArray(body.attachments) && body.attachments.length > 0
        ? JSON.stringify(body.attachments)
        : undefined
    );

    // Bump the ticket's updatedAt so the admin list reflects the new
    // activity. The status only moves from OPEN to IN_PROGRESS — we
    // do not auto-resolve, that's a separate admin action.
    const nextStatus = ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status;
    await supportRepository.update(id, { status: nextStatus });

    createAuditLog({
      actorId: session.adminId || 'system',
      action: 'ticket.admin_reply',
      entity: 'ticket',
      entityId: id,
      details: { messageLength: cleanedMessage.length, hasAttachments: Boolean(body.attachments?.length) },
    }).catch((e: unknown) => logger.error('Audit log failed for admin reply', e));

    // Best-effort rider notification. Failures are logged and do NOT
    // surface to the admin — the reply already persisted.
    db.rider
      .findUnique({ where: { id: ticket.riderId }, select: { id: true, phone: true } })
      .then((rider: { id: string; phone: string } | null) => {
        if (!rider) return;
        return import('@/lib/notification-service').then(({ notificationService }) =>
          notificationService.createAndSend(
            rider.id,
            'Support Reply',
            `Your ticket ${ticket.ticketId} received a reply`,
            'SUPPORT_REPLY',
            { ticketId: ticket.ticketId, subject: ticket.subject }
          ).catch((e: unknown) => logger.error('Notification failed for admin reply', e))
        );
      })
      .catch((e: unknown) => logger.error('Rider lookup failed for admin reply', e));

    return success(
      {
        id: created.id,
        ticketId: id,
        message: cleanedMessage,
        senderType: 'ADMIN',
        createdAt: created.createdAt,
      },
      'Reply sent'
    );
  } catch (error) {
    logger.error('POST /api/admin/tickets/[id]/messages error', error);
    return errors.internal('Failed to send reply');
  }
}
