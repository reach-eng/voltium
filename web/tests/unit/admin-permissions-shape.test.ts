import { describe, it, expect } from 'vitest';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';
import { adminRepository } from '@/server/modules/admin/admin.repository';

describe('Admin Permissions Shape', () => {
  it('getMe resolves permissions from hasPermissions relation with fallback', async () => {
    // We mock the repository to return both legacy array and new relation
    const mockAdmin = {
      id: 'admin-1',
      permissions: ['LEGACY_PERMISSION'], // fallback
      hasPermissions: [
        { permission: 'NEW_PERMISSION' }
      ]
    };
    
    // Spy on findById
    const originalFindById = adminRepository.findById;
    adminRepository.findById = async () => mockAdmin as any;
    
    try {
      const me = await adminUseCases.getMe('admin-1');
      // Should prefer relation over legacy
      expect(me.permissions).toEqual(['NEW_PERMISSION']);
    } finally {
      adminRepository.findById = originalFindById;
    }
  });

  it('getMe falls back to legacy array if relation is missing or empty', async () => {
    const mockAdmin = {
      id: 'admin-1',
      permissions: ['LEGACY_PERMISSION'], // fallback
      hasPermissions: [] // empty relation
    };
    
    const originalFindById = adminRepository.findById;
    adminRepository.findById = async () => mockAdmin as any;
    
    try {
      const me = await adminUseCases.getMe('admin-1');
      expect(me.permissions).toEqual(['LEGACY_PERMISSION']);
    } finally {
      adminRepository.findById = originalFindById;
    }
  });
});
