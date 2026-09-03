import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  db: {
    systemSetting: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: () => new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
  adminForbidden: () => new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
}));

vi.mock('@/lib/auth', () => ({
  hasPermission: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
  invalidateCache: vi.fn(),
}));

vi.mock('@/server/modules/settings/setting.use-cases', () => ({
  settingUseCases: {
    update: vi.fn(),
  },
}));

const { GET, PUT } = await import('@/app/api/admin/config/skip-guarantor/route');
const { db } = await import('@/lib/db');
const { requireAdmin } = await import('@/lib/rbac');
const { hasPermission } = await import('@/lib/auth');
const { settingUseCases } = await import('@/server/modules/settings/setting.use-cases');
const { invalidateCache } = await import('@/lib/cache');

describe('Skip-Guarantor Config API (/api/admin/config/skip-guarantor)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns default 1000 rupees when setting is not present in DB', async () => {
      vi.mocked(db.systemSetting.findUnique).mockResolvedValue(null);

      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.extraDepositRupees).toBe(1000);
    });

    it('returns converted rupees when custom paise setting is in DB', async () => {
      vi.mocked(db.systemSetting.findUnique).mockResolvedValue({
        id: '1',
        key: 'skipGuarantorExtraDeposit',
        value: '150000',
        category: 'BUSINESS',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.extraDepositRupees).toBe(1500);
    });

    it('falls back gracefully to 1000 rupees if DB throws', async () => {
      vi.mocked(db.systemSetting.findUnique).mockRejectedValue(new Error('DB Connection down'));

      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.extraDepositRupees).toBe(1000);
    });
  });

  describe('PUT', () => {
    it('rejects with 401 when admin is unauthenticated', async () => {
      vi.mocked(requireAdmin).mockResolvedValue(null as any);

      const req = new NextRequest('http://localhost/api/admin/config/skip-guarantor', {
        method: 'PUT',
        body: JSON.stringify({ extraDepositRupees: 1500 }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unauthorized');
    });

    it('rejects with 403 when admin lacks settings_manage permission', async () => {
      vi.mocked(requireAdmin).mockResolvedValue({
        adminId: 'admin_1',
        adminRole: 'viewer',
      } as any);
      vi.mocked(hasPermission).mockReturnValue(false);

      const req = new NextRequest('http://localhost/api/admin/config/skip-guarantor', {
        method: 'PUT',
        body: JSON.stringify({ extraDepositRupees: 1500 }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Forbidden');
    });

    it('rejects with 422 when extraDepositRupees is invalid or non-positive', async () => {
      vi.mocked(requireAdmin).mockResolvedValue({
        adminId: 'admin_1',
        adminRole: 'super_admin',
      } as any);
      vi.mocked(hasPermission).mockReturnValue(true);

      const req = new NextRequest('http://localhost/api/admin/config/skip-guarantor', {
        method: 'PUT',
        body: JSON.stringify({ extraDepositRupees: -500 }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('successfully updates skip guarantor deposit config and invalidates cache', async () => {
      vi.mocked(requireAdmin).mockResolvedValue({
        adminId: 'admin_1',
        adminRole: 'super_admin',
      } as any);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(settingUseCases.update).mockResolvedValue({} as any);

      const req = new NextRequest('http://localhost/api/admin/config/skip-guarantor', {
        method: 'PUT',
        body: JSON.stringify({ extraDepositRupees: 2000 }),
      });

      const res = await PUT(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.extraDepositRupees).toBe(2000);
      expect(settingUseCases.update).toHaveBeenCalledWith(
        { skipGuarantorExtraDeposit: 2000 },
        'admin_1'
      );
      expect(invalidateCache).toHaveBeenCalledWith('admin:settings:*');
    });
  });
});
