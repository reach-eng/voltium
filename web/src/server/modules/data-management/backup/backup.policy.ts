/**
 * Backup policy — minimal stub.
 * Permission checks for backup operations.
 */

import { AdminRole } from '@/server/modules/admin/admin.types';

export const backupPolicy = {
  canViewBackups(role: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN, AdminRole.READ_ONLY].includes(role);
  },

  canCreateBackup(role: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN].includes(role);
  },

  canRestoreBackup(role: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN].includes(role);
  },

  canDeleteBackup(role: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN].includes(role);
  },
};
