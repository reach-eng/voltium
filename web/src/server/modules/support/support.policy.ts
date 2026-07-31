import { NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { hasPermission } from '@/lib/permissions';
import { AdminAuthError, AdminForbiddenError } from '@/server/modules/admin/admin.policy';
import { SessionPayload } from '@/lib/session-payload';

/**
 * Require admin authentication AND tickets_view permission.
 * Throws AdminForbiddenError if the admin lacks the required permission.
 */
export async function requireSupportAgent(request?: NextRequest) {
  const session = await getAdminSession(request);
  if (!session) {
    throw new AdminAuthError('Admin authentication required');
  }

  if (!hasPermission(session, 'tickets_view')) {
    throw new AdminForbiddenError("Insufficient permissions: requires 'tickets_view'");
  }

  return session;
}

/**
 * Check if the session has permission to view a ticket
 */
export function canViewTicket(ticket: { id: string }, session: SessionPayload): boolean {
  return hasPermission(session, 'tickets_view');
}

/**
 * Check if the session has permission to reply to a ticket
 */
export function canReplyToTicket(ticket: { id: string }, session: SessionPayload): boolean {
  return hasPermission(session, 'tickets_resolve') || hasPermission(session, 'tickets_manage');
}
