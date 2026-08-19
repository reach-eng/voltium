import { describe, it, expect } from 'vitest';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';
import { adminRepository } from '@/server/modules/admin/admin.repository';

describe('Admin Permissions Shape (P0-6)', () => {
  it('getMe parses the JSON-string permissions column', async () => {
    const mockAdmin = {
      id: 'admin-1',
      email: 'admin@voltium.in',
      permissions: '["riders_view","kyc_view"]', // DB column: JSON string
    };

    const originalFindById = adminRepository.findById;
    adminRepository.findById = async () => mockAdmin as any;

    try {
      const me = await adminUseCases.getMe('admin-1');
      expect(me?.permissions).toEqual(['riders_view', 'kyc_view']);
      expect(me?.adminPermissions).toEqual(['riders_view', 'kyc_view']);
    } finally {
      adminRepository.findById = originalFindById;
    }
  });

  it('getMe tolerates invalid JSON in the permissions column', async () => {
    const mockAdmin = {
      id: 'admin-1',
      permissions: '{not-json',
    };

    const originalFindById = adminRepository.findById;
    adminRepository.findById = async () => mockAdmin as any;

    try {
      const me = await adminUseCases.getMe('admin-1');
      expect(me?.permissions).toEqual([]);
    } finally {
      adminRepository.findById = originalFindById;
    }
  });

  it('getMe returns null when the admin does not exist', async () => {
    const originalFindById = adminRepository.findById;
    adminRepository.findById = async () => null;

    try {
      const me = await adminUseCases.getMe('missing-admin');
      expect(me).toBeNull();
    } finally {
      adminRepository.findById = originalFindById;
    }
  });

  it('getMe propagates DB errors instead of swallowing them (P0-8)', async () => {
    const originalFindById = adminRepository.findById;
    adminRepository.findById = async () => {
      throw new Error('connection refused');
    };

    try {
      await expect(adminUseCases.getMe('admin-1')).rejects.toThrow('connection refused');
    } finally {
      adminRepository.findById = originalFindById;
    }
  });
});
