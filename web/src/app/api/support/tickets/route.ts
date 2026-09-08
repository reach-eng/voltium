/**
 * GET  /api/support/tickets — List rider's support tickets
 * POST /api/support/tickets — Create a new support ticket
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 * Business logic lives in supportUseCases (ticket creation, ID generation, state management).
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, createTicketSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { supportUseCases } from '@/server/modules/support/support.use-cases';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const rl = await checkRateLimit(`rider:tickets:list:${riderDbId}`, {
      windowMs: 60_000,
      maxRequests: 60,
    });
    if (!rl.allowed) {
      return errors.tooManyRequests('Too many requests. Please try again later.');
    }

    const tickets = await supportUseCases.getTickets(riderDbId);
    return success({ tickets }, `${tickets.length} tickets fetched`);
  } catch (err) {
    logger.error('[GET /api/support/tickets]', err);
    return errors.internal('Failed to fetch tickets');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    // Ticket creation spams DB + notifications — strict per-rider cap.
    const rl = await checkRateLimit(`rider:tickets:create:${riderDbId}`, {
      windowMs: 60_000,
      maxRequests: 10,
    });
    if (!rl.allowed) {
      return errors.tooManyRequests('Too many tickets. Please try again later.');
    }

    const body = await request.json();
    const validation = validateBody(createTicketSchema, {
      ...body,
      riderId: body.riderId || riderDbId,
    });
    if (!validation.success) return errors.validation(validation.error);

    const { category, priority, subject, message, attachments, troubleshootPath } =
      validation.data;

    const ticket = await supportUseCases.createTicket(riderDbId, {
      riderId: riderDbId,
      category: category || 'GENERAL',
      priority: priority || 'MEDIUM',
      subject: subject || '',
      message,
      attachments: attachments as string | undefined,
      troubleshootPath: troubleshootPath || undefined,
    });

    return success(ticket, 'Ticket created successfully', 201);
  } catch (err) {
    logger.error('[POST /api/support/tickets]', err);
    return errors.internal('Failed to create ticket');
  }
}
