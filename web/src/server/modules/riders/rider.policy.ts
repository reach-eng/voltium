/**
 * Riders module - Policy.
 *
 * Authorization rules for rider operations.
 */

export const riderPolicy = {
  canViewProfile(actorRole: string, targetRiderId: string, sessionRiderId?: string): boolean {
    // Rider can view their own profile; admins can view any
    if (actorRole === 'admin') return true;
    return sessionRiderId === targetRiderId;
  },

  canUpdateProfile(actorRole: string, targetRiderId: string, sessionRiderId?: string): boolean {
    if (actorRole === 'admin') return true;
    return sessionRiderId === targetRiderId;
  },
};
