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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

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

    const body = await request.json();
    const validation = validateBody(createTicketSchema, {
      ...body,
      riderId: body.riderId || riderDbId,
    });
    if (!validation.success) return errors.validation(validation.error);

    const { category, priority, subject, message, attachments } = validation.data;

    const ticket = await supportUseCases.createTicket(riderDbId, {
      category: category || 'GENERAL',
      priority: priority || 'MEDIUM',
      subject: subject || '',
      message,
      attachments: attachments || null,
    });

    return success(ticket, 'Ticket created successfully');
  } catch (err) {
    logger.error('[POST /api/support/tickets]', err);
    return errors.internal('Failed to create ticket');
  }
}
