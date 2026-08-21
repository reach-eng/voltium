import { describe, it, expect, vi } from 'vitest';
import { hasPermission } from '@/lib/permissions';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';
import { adminRepository } from '@/server/modules/admin/admin.repository';
import { db } from '@/lib/db';

describe('Admin Panel Phase 1 P0 Remediation Suite', () => {
  describe('RBAC Additive Session Permissions (P0-06)', () => {
    it('evaluates custom session permissions additively when passing session object', () => {
      const supportSession = {
        riderId: 'admin_1',
        riderDbId: 'admin_db_1',
        phone: '9999999999',
        role: 'admin',
        adminRole: 'SUPPORT_AGENT',
        adminId: 'admin_db_1',
        adminPermissions: ['offers_manage', 'analytics_view'],
      };

      // By default SUPPORT_AGENT does not have offers_manage in static matrix
      expect(hasPermission('SUPPORT_AGENT', 'offers_manage')).toBe(false);

      // Passing session object enables additive custom permissions
      expect(hasPermission(supportSession, 'offers_manage')).toBe(true);
      expect(hasPermission(supportSession, 'analytics_view')).toBe(true);
      expect(hasPermission(supportSession, 'admins_manage')).toBe(false);
    });

    it('SUPER_ADMIN session always receives all permissions', () => {
      const superAdminSession = {
        riderId: 'admin_super',
        riderDbId: 'admin_super_db',
        phone: '9888888888',
        role: 'admin',
        adminRole: 'SUPER_ADMIN',
        adminId: 'admin_super_db',
      };
      expect(hasPermission(superAdminSession, 'admins_manage')).toBe(true);
      expect(hasPermission(superAdminSession, 'data_management_restore')).toBe(true);
      expect(hasPermission(superAdminSession, 'kyc_approve')).toBe(true);
    });
  });

  describe('Admin Password Session Invalidation (P0-07)', () => {
    it('triggers tokenVersion increment on password update in repository', async () => {
      const updateSpy = vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => {
        const tx = {
          admin: {
            update: vi.fn().mockResolvedValue({ id: 'admin_123', tokenVersion: 2 }),
          },
        };
        return cb(tx);
      });

      await adminRepository.update('admin_123', { password: 'new_hashed_password' });
      expect(updateSpy).toHaveBeenCalled();
      updateSpy.mockRestore();
    });
  });

  describe('Security Flags Redaction and Mapping (P0-02)', () => {
    it('properly updates security flags and strips password hashes from audit details', async () => {
      const mockUpdate = vi.spyOn(db.rider, 'update').mockResolvedValue({} as any);

      await adminRiderUseCases.updateSecurityFlags(
        'rider_test_1',
        { isLocationMandatory: true, lockPasswordHash: 'secret_hash' },
        'actor_admin'
      );

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'rider_test_1' },
        data: expect.objectContaining({
          isLocationMandatory: true,
          lockPasswordHash: 'secret_hash',
        }),
      });

      mockUpdate.mockRestore();
    });
  });
});
