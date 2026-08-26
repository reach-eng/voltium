/**
 * Backup policy — RBAC enforcement for backup/restore operations.
 */

import { AdminRole } from '@/server/modules/admin/admin.types';

export const backupPolicy = {
  canViewBackups(role: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.READ_ONLY].includes(role);
  },

  canCreateBackup(role: AdminRole): boolean {
    return role === AdminRole.SUPER_ADMIN;
  },

  canRestoreBackup(role: AdminRole): boolean {
    return role === AdminRole.SUPER_ADMIN;
  },

  canDownloadBackup(role: AdminRole): boolean {
    return role === AdminRole.SUPER_ADMIN;
  },

  canManageSchedule(role: AdminRole): boolean {
    return role === AdminRole.SUPER_ADMIN;
  },

  canDeleteBackup(role: AdminRole): boolean {
    return role === AdminRole.SUPER_ADMIN;
  },
};
