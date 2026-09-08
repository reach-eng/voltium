/**
 * GET  /api/support/tickets/[id]/messages — Rider reads own ticket thread.
 * POST /api/support/tickets/[id]/messages — Rider replies to own ticket.
 * Both scoped to the session rider (cross-rider → 404). Closed tickets
 * reject new replies.
 */
import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, ticketReplySchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { supportUseCases } from '@/server/modules/support/support.use-cases';
import { supportRepository } from '@/server/modules/support/support.repository';
import { checkRateLimit } from '@/lib/rate-limit';

async function loadOwnedTicket(id: string, riderDbId: string) {
  const ticket = await supportRepository.findById(id);
  if (!ticket || (ticket as { riderId?: string }).riderId !== riderDbId) {
    return null;
  }
  return ticket;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const owned = await loadOwnedTicket(id, auth.riderDbId);
    if (!owned) return errors.notFound('Ticket not found');

    const messages = await supportRepository.findMessages(id);
    return success({ messages }, `${messages.length} messages fetched`);
  } catch (err) {
    logger.error('[GET /api/support/tickets/[id]/messages]', err);
    return errors.internal('Failed to fetch messages');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const owned = await loadOwnedTicket(id, auth.riderDbId);
    if (!owned) return errors.notFound('Ticket not found');
    if ((owned as { status?: string }).status === 'CLOSED') {
      return errors.badRequest('Cannot reply to a closed ticket');
    }

    // P0: reply spam fans out to DB + push notifications — cap per ticket.
    const rl = await checkRateLimit(`rider:ticket:reply:${auth.riderDbId}:${id}`, {
      windowMs: 60_000,
      maxRequests: 20,
    });
    if (!rl.allowed) {
      return errors.tooManyRequests('Too many replies. Please try again later.');
    }

    const body = await request.json();
    const validation = validateBody(ticketReplySchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const message = await supportUseCases.replyToTicket(
      id,
      auth.riderDbId,
      'RIDER',
      validation.data,
      auth.riderDbId
    );
    return success({ message }, 'Reply sent', 201);
  } catch (err) {
    logger.error('[POST /api/support/tickets/[id]/messages]', err);
    return errors.internal('Failed to send reply');
  }
}
