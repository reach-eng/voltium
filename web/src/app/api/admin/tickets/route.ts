/**
 * GET  /api/admin/tickets — List all tickets with rider info and pagination
 * PUT  /api/admin/tickets — Update ticket status / assignment
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 * Business logic lives in supportUseCases (admin queries, state transitions, audit logging).
 */

import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { supportUseCases } from '@/server/modules/support/support.use-cases';

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

    const result = await supportUseCases.getAdminTickets({ status, priority, search, page, limit });
    return withCacheHeaders(success(result.tickets, undefined, 200, result.pagination), 5);
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
    const { id, status, assignedTo } = body;
    if (!id) return errors.validation('Ticket ID is required');

    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
      updateData.resolvedAt = ['RESOLVED', 'CLOSED'].includes(status) ? new Date() : null;
    }
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

    const ticket = await supportUseCases.updateTicket(id, updateData);

    await supportUseCases.logAdminAction(session.adminId || '', {
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

    const ticket = await supportUseCases.createTicket(riderDbId, {
      riderId: riderDbId,
      category: category || 'GENERAL',
      priority: priority || 'LOW',
      subject,
      message,
    });

    await supportUseCases.logAdminAction(session.adminId || '', {
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

