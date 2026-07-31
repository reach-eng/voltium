/**
 * Support module - Routes.
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 */

import { NextRequest } from 'next/server';
import { requireRiderSession } from '@/lib/rider-auth';
import { requirePermission } from '@/lib/rbac';
import { supportUseCases } from './support.use-cases';
import {
  createTicketSchema,
  updateTicketSchema,
  ticketReplySchema,
  supportQuerySchema,
} from './support.schemas';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';

export async function POST_createTicket(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const body = await request.json();
  const validation = validateBody(createTicketSchema, body);
  if (!validation.success) return errors.validation(validation.error);

  const ticket = await supportUseCases.createTicket(session.riderDbId, validation.data);
  return success(ticket, 'Ticket created');
}

export async function GET_myTickets(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const tickets = await supportUseCases.getTickets(session.riderDbId);
  return success(tickets);
}

export async function GET_ticketById(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const ticket = await supportUseCases.getTicket(params.id);
  if (!ticket) return errors.notFound('Ticket not found');
  return success(ticket);
}

export async function POST_reply(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const body = await request.json();
  const validation = validateBody(ticketReplySchema, body);
  if (!validation.success) return errors.validation(validation.error);

  const message = await supportUseCases.replyToTicket(
    params.id,
    session.riderDbId,
    'RIDER',
    validation.data
  );
  return success(message, 'Reply sent');
}

export async function GET_adminTickets(request: NextRequest) {
  const admin = await requirePermission('tickets_view');
  if (!admin) return errors.forbidden('Insufficient permissions');

  const { searchParams } = request.nextUrl;
  const query = supportQuerySchema.parse(Object.fromEntries(searchParams));
  const tickets = await supportUseCases.getAdminTickets(query);
  return success(tickets);
}

export async function PUT_updateTicket(request: NextRequest) {
  const admin = await requirePermission('tickets_manage');
  if (!admin) return errors.forbidden('Insufficient permissions');

  const body = await request.json();
  const validation = validateBody(updateTicketSchema, body);
  if (!validation.success) return errors.validation(validation.error);

  const ticket = await supportUseCases.updateTicket(validation.data.id, validation.data);
  return success(ticket, 'Ticket updated');
}
