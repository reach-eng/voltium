/**
 * GET  /api/support/tickets — List rider's support tickets
 * POST /api/support/tickets — Create a new support ticket
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 * Business logic lives in riderSupportUseCases (ticket creation, ID generation, state management).
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, createTicketSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { riderSupportUseCases } from '@/server/modules/support/rider-support.use-cases';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    const tickets = await riderSupportUseCases.getTickets(riderDbId, page, limit);
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

    const rateLimit = await checkRateLimit(`create_ticket:${riderDbId}`, {
      windowMs: 10 * 60 * 1000,
      maxRequests: 5,
    });
    if (!rateLimit.allowed) {
      return errors.tooManyRequests('Too many support tickets created. Please try again later.');
    }

    const body = await request.json();
    const validation = validateBody(createTicketSchema, {
      ...body,
      riderId: body.riderId || riderDbId,
    });
    if (!validation.success) return errors.validation(validation.error);

    const { category, priority, subject, message, attachments } = validation.data;

    const ticket = await riderSupportUseCases.createTicket(riderDbId, {
      riderId: riderDbId,
      category: category || 'GENERAL',
      priority: priority || 'MEDIUM',
      subject: subject || '',
      message,
      attachments: attachments || undefined,
    });

    return success(ticket, 'Ticket created successfully');
  } catch (err) {
    logger.error('[POST /api/support/tickets]', err);
    return errors.internal('Failed to create ticket');
  }
}
