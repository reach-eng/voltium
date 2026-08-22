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
import { validateBody } from '@/lib/validators';
import {
  createAdminTicketSchema,
  updateAdminTicketSchema,
} from '@/lib/validators/admin';
import { supportUseCases } from '@/server/modules/support/support.use-cases';
import { parsePositiveInt } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'tickets_view')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const status = url.searchParams.get('status') || '';
    const priority = url.searchParams.get('priority') || '';
    const search = url.searchParams.get('search') || '';
    // PR-4b (13th audit P0-6): NaN-safe pagination.
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 100);

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
  if (!hasPermission(session, 'tickets_resolve')) return adminForbidden();

  try {
    const body = await req.json();
    // P1-10/P2-10: the PUT used to read body fields directly — `status:
    // 'banana'` reached the DB and `updateData: Record<string, unknown>`
    // erased the types. Now validated (status is an enum; assignedTo may be
    // null for unassign, which the admin UI sends).
    const validation = validateBody(updateAdminTicketSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { id, status, assignedTo } = validation.data;

    const updateData: { status?: string; assignedTo?: string | null; resolvedAt?: Date | null } =
      {};
    if (status) {
      updateData.status = status;
      updateData.resolvedAt = ['RESOLVED', 'CLOSED'].includes(status) ? new Date() : null;
    }
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

    const ticket = await supportUseCases.updateTicket(id, updateData);

    // P3-8: log only the status/assignment change — never a raw payload that
    // could carry sensitive notes into the audit trail.
    await supportUseCases.logAdminAction(session.adminId || '', {
      action: status ? `ticket.${status.toLowerCase()}` : 'ticket.assign',
      ticketId: id,
      details: { status, assignedTo },
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
  if (!hasPermission(session, 'tickets_manage')) return adminForbidden();

  try {
    const body = await req.json();
    // P1-12/P3-7: the POST previously had NO validation — an empty-string
    // subject sailed through (`!subject` is false for ''). Now schema-checked
    // (subject/message min(1), category/priority enum'd, strict allowlist).
    const validation = validateBody(createAdminTicketSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { riderDbId, category, priority, subject, message } = validation.data;

    const ticket = await supportUseCases.createTicket(riderDbId, {
      riderId: riderDbId,
      category,
      priority,
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

