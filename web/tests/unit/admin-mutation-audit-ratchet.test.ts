import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAdminMutation, getExpiresAt, RETENTION_PERIODS } from '@/lib/audit-log';
import { db } from '@/lib/db';

vi.mock('@/lib/rbac', () => ({
  requireAdmin: vi.fn().mockResolvedValue({
    adminId: 'admin_test_123',
    adminRole: 'SUPER_ADMIN',
    email: 'admin@voltium.io',
  }),
  adminUnauthorized: vi.fn(() => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
  adminForbidden: vi.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
}));

describe('Phase W3: Admin Mutation Audit Ratchet & Retention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RETENTION_PERIODS and getExpiresAt', () => {
    it('sets emergency and SOS actions to 30 days retention', () => {
      expect(RETENTION_PERIODS.sos).toBe(30);
      expect(RETENTION_PERIODS.emergency).toBe(30);

      const sosExpires = getExpiresAt('emergency.sos_triggered');
      const now = new Date();
      const diffDays = Math.round((sosExpires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(30);
    });

    it('sets financial and transaction actions to 365 days retention', () => {
      const txExpires = getExpiresAt('transaction.bulk_approve');
      const now = new Date();
      const diffDays = Math.round((txExpires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(365);
    });
  });

  describe('logAdminMutation helper', () => {
    it('creates an audit log using session.adminId', async () => {
      const spy = vi.spyOn(db.auditLog, 'create').mockResolvedValue({} as any);

      await logAdminMutation({
        session: { adminId: 'admin_123', adminRole: 'SUPER_ADMIN' },
        action: 'notification.send',
        entity: 'Notification',
        entityId: 'notif_1',
        details: { title: 'Test Alert' },
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'admin_123',
            actorType: 'ADMIN',
            action: 'notification.send',
            entity: 'Notification',
            entityId: 'notif_1',
            details: JSON.stringify({ title: 'Test Alert' }),
          }),
        })
      );
    });

    it('falls back to session.riderDbId or system when adminId is missing', async () => {
      const spy = vi.spyOn(db.auditLog, 'create').mockResolvedValue({} as any);

      await logAdminMutation({
        session: { riderDbId: 'rider_db_99' },
        action: 'kyc.reveal_pii',
        entity: 'KycProfile',
        entityId: 'rider_1',
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'rider_db_99',
            action: 'kyc.reveal_pii',
          }),
        })
      );
    });
  });

  describe('Admin Audit-Log POST Endpoint', () => {
    it('records an audit log entry on valid POST', async () => {
      const { POST } = await import('@/app/api/admin/audit-logs/route');
      const spy = vi.spyOn(db.auditLog, 'create').mockResolvedValue({} as any);

      const req = new Request('http://localhost/api/admin/audit-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: 'voltium_admin_token=mock-admin-token',
        },
        body: JSON.stringify({
          action: 'kyc.reveal_pii',
          entity: 'KycProfile',
          entityId: 'rider_abc',
          details: { riderName: 'Test Rider' },
        }),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(201);
      expect(spy).toHaveBeenCalled();
    });

    it('rejects POST with missing action or entity', async () => {
      const { POST } = await import('@/app/api/admin/audit-logs/route');

      const req = new Request('http://localhost/api/admin/audit-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: 'voltium_admin_token=mock-admin-token',
        },
        body: JSON.stringify({
          details: { note: 'missing action' },
        }),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });
  });
});
