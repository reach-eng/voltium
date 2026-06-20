/**
 * Data Management — Authorization Policy
 *
 * Only SUPER_ADMIN can create/restore/download backups.
 * READ_ONLY can view backup history.
 */

import { AdminRole } from '../admin/admin.types';

export const backupPolicy = {
  canViewBackups(adminRole: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.READ_ONLY].includes(adminRole);
  },

  canCreateBackup(adminRole: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN].includes(adminRole);
  },

  canRestoreBackup(adminRole: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN].includes(adminRole);
  },

  canDownloadBackup(adminRole: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN].includes(adminRole);
  },

  canManageSchedule(adminRole: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN].includes(adminRole);
  },

  canDeleteBackup(adminRole: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN].includes(adminRole);
  },
};
