/**
 * Unit tests for Data Management — Backup Authorization Policy
 *
 * Tests RBAC enforcement for backup/restore operations.
 * Only SUPER_ADMIN can create/restore/download/delete backups.
 * SUPER_ADMIN and READ_ONLY can view backups.
 */

import { describe, it, expect } from 'vitest';
import { backupPolicy } from '@/server/modules/data-management/backup.policy';
import { AdminRole } from '@/server/modules/admin/admin.types';

describe('Backup Policy — RBAC', () => {
  const allRoles = Object.values(AdminRole);

  describe('canViewBackups', () => {
    it('allows SUPER_ADMIN to view backups', () => {
      expect(backupPolicy.canViewBackups(AdminRole.SUPER_ADMIN)).toBe(true);
    });

    it('allows READ_ONLY to view backups', () => {
      expect(backupPolicy.canViewBackups(AdminRole.READ_ONLY)).toBe(true);
    });

    it('denies all other roles from viewing backups', () => {
      const deniedRoles = allRoles.filter(
        (r) => r !== AdminRole.SUPER_ADMIN && r !== AdminRole.READ_ONLY
      );
      for (const role of deniedRoles) {
        expect(backupPolicy.canViewBackups(role)).toBe(false);
      }
    });
  });

  describe('canCreateBackup', () => {
    it('allows SUPER_ADMIN to create backups', () => {
      expect(backupPolicy.canCreateBackup(AdminRole.SUPER_ADMIN)).toBe(true);
    });

    it('denies all other roles from creating backups', () => {
      const deniedRoles = allRoles.filter((r) => r !== AdminRole.SUPER_ADMIN);
      for (const role of deniedRoles) {
        expect(backupPolicy.canCreateBackup(role)).toBe(false);
      }
    });
  });

  describe('canRestoreBackup', () => {
    it('allows SUPER_ADMIN to restore backups', () => {
      expect(backupPolicy.canRestoreBackup(AdminRole.SUPER_ADMIN)).toBe(true);
    });

    it('denies all other roles from restoring backups', () => {
      const deniedRoles = allRoles.filter((r) => r !== AdminRole.SUPER_ADMIN);
      for (const role of deniedRoles) {
        expect(backupPolicy.canRestoreBackup(role)).toBe(false);
      }
    });
  });

  describe('canDownloadBackup', () => {
    it('allows SUPER_ADMIN to download backups', () => {
      expect(backupPolicy.canDownloadBackup(AdminRole.SUPER_ADMIN)).toBe(true);
    });

    it('denies all other roles from downloading backups', () => {
      const deniedRoles = allRoles.filter((r) => r !== AdminRole.SUPER_ADMIN);
      for (const role of deniedRoles) {
        expect(backupPolicy.canDownloadBackup(role)).toBe(false);
      }
    });
  });

  describe('canManageSchedule', () => {
    it('allows SUPER_ADMIN to manage schedule', () => {
      expect(backupPolicy.canManageSchedule(AdminRole.SUPER_ADMIN)).toBe(true);
    });

    it('denies all other roles from managing schedule', () => {
      const deniedRoles = allRoles.filter((r) => r !== AdminRole.SUPER_ADMIN);
      for (const role of deniedRoles) {
        expect(backupPolicy.canManageSchedule(role)).toBe(false);
      }
    });
  });

  describe('canDeleteBackup', () => {
    it('allows SUPER_ADMIN to delete backups', () => {
      expect(backupPolicy.canDeleteBackup(AdminRole.SUPER_ADMIN)).toBe(true);
    });

    it('denies all other roles from deleting backups', () => {
      const deniedRoles = allRoles.filter((r) => r !== AdminRole.SUPER_ADMIN);
      for (const role of deniedRoles) {
        expect(backupPolicy.canDeleteBackup(role)).toBe(false);
      }
    });
  });
});
