/**
 * GET  /api/admin/tickets — List all tickets with rider info and pagination
 * PUT  /api/admin/tickets — Update ticket status / assignment
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 * Business logic lives in adminSupportUseCases and riderSupportUseCases (admin queries, state transitions, audit logging).
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, updateTicketSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { adminSupportUseCases } from '@/server/modules/support/admin-support.use-cases';
import { riderSupportUseCases } from '@/server/modules/support/rider-support.use-cases';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'tickets_view')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const status = url.searchParams.get('status') || '';
    const priority = url.searchParams.get('priority') || '';
    const search = url.searchParams.get('search') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20')), 100);

    const result = await adminSupportUseCases.getAdminTickets({ status, priority, search, page, limit });
    return success(result.tickets, undefined, 200, result.pagination);
  } catch (error) {
    logger.error('GET /api/admin/tickets error:', error);
    return errors.internal('Failed to fetch tickets');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'tickets_resolve')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(updateTicketSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { id, status, assignedTo, refundAmountInPaise, isEscalated, action } = validation.data;
    if (!id) return errors.validation('Ticket ID is required');

    if (refundAmountInPaise && refundAmountInPaise > 0) {
      if (!hasPermission(session.adminRole || '', 'transactions_approve')) {
        return adminForbidden('Financial transaction authorization (transactions_approve) required to issue dispute refunds');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
    }
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (isEscalated !== undefined) updateData.isEscalated = isEscalated;
    if (action) updateData.action = action;
    if (refundAmountInPaise !== undefined) updateData.refundAmountInPaise = refundAmountInPaise;

    const ticket = await adminSupportUseCases.updateTicket(id, updateData, session.adminId);

    await adminSupportUseCases.logAdminAction(session.adminId || '', {
      action: status ? `ticket.${status.toLowerCase()}` : 'ticket.assign',
      ticketId: id,
      details: updateData,
    });

    return success(ticket);
  } catch (error) {
    logger.error('PUT /api/admin/tickets error:', error);
    return errors.internal('Failed to update ticket');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'tickets_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const { riderDbId, category, priority, subject, message } = body;
    if (!riderDbId || !subject || !message) return errors.validation('Missing required fields');

    const ticket = await riderSupportUseCases.createTicket(riderDbId, {
      riderId: riderDbId,
      category: category || 'GENERAL',
      priority: priority || 'LOW',
      subject,
      message,
    });

    await adminSupportUseCases.logAdminAction(session.adminId || '', {
      action: 'ticket.created_by_admin',
      ticketId: ticket.id,
      details: { category, priority, subject },
    });

    return success(ticket);
  } catch (error) {
    logger.error('POST /api/admin/tickets error:', error);
    return errors.internal('Failed to create ticket');
  }
}

