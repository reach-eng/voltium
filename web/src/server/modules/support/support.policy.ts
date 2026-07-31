/**
 * Support module - Policy.
 *
 * Authorization rules for support ticket operations.
 */
import { AdminRole } from '../admin/admin.types';
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
    ].includes(adminRole);
  },

  canResolveTicket(adminRole: AdminRole): boolean {
    return [
      AdminRole.SUPER_ADMIN,
      AdminRole.OPERATIONS_ADMIN,
      AdminRole.HUB_MANAGER,
      AdminRole.TEAM_LEADER,
    ].includes(adminRole);
  },
};
