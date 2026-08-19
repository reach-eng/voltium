/**
 * Support module - Policy.
 *
 * Authorization rules for support ticket operations.
 */
import { getAdminSession } from '@/lib/get-session';
import { AdminAuthError, AdminForbiddenError } from '../admin/admin.policy';
import { AdminRole } from '../admin/admin.types';

const VIEW_ROLES = ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'HUB_MANAGER', 'TEAM_LEADER', 'SUPPORT_AGENT'];
const RESOLVE_ROLES = ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'HUB_MANAGER', 'TEAM_LEADER', 'SUPPORT_AGENT'];

export async function requireSupportAgent(request?: Request) {
  const session = await getAdminSession(request);
  if (!session) {
    throw new AdminAuthError('Authentication required');
  }

  const role = session.adminRole;
  if (!role || !VIEW_ROLES.includes(role)) {
    throw new AdminForbiddenError('Permission denied: tickets_view required');
  }

  return session;
}

export function canViewTicket(_ticket: unknown, session: { adminRole?: string }): boolean {
  if (!session || !session.adminRole) return false;
  return VIEW_ROLES.includes(session.adminRole);
}

export function canReplyToTicket(_ticket: unknown, session: { adminRole?: string }): boolean {
  if (!session || !session.adminRole) return false;
  return RESOLVE_ROLES.includes(session.adminRole);
}


export const supportPolicy = {
  canViewTicket(actorRole: string, ticketRiderId: string, sessionRiderId?: string): boolean {
    if (actorRole === 'admin') return true;
    return sessionRiderId === ticketRiderId;
  },

  canCreateTicket(): boolean {
    return true; // Any authenticated rider can create tickets
  },

  canManageTickets(adminRole: AdminRole): boolean {
    return [
      AdminRole.SUPER_ADMIN,
      AdminRole.OPERATIONS_ADMIN,
      AdminRole.HUB_MANAGER,
      AdminRole.TEAM_LEADER,
      AdminRole.SUPPORT_AGENT,
    ].includes(adminRole);
  },

  canResolveTicket(adminRole: AdminRole): boolean {
    return [
      AdminRole.SUPER_ADMIN,
      AdminRole.OPERATIONS_ADMIN,
      AdminRole.HUB_MANAGER,
      AdminRole.TEAM_LEADER,
      AdminRole.SUPPORT_AGENT,
    ].includes(adminRole);
  },
};
