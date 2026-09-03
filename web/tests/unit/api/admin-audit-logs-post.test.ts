import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/rbac', () => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
  adminForbidden: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue({ id: 'audit_1' }),
}));

vi.mock('@/server/modules/admin/admin.use-cases', () => ({
  adminUseCases: {
    getAuditLogs: vi.fn(),
  },
}));

const { POST } = (await import('@/app/api/admin/audit-logs/route')) as any;
const { requireAdmin } = await import('@/lib/rbac');
const { createAuditLog } = await import('@/lib/audit-log');

describe('POST /api/admin/audit-logs (PII reveal tracking)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthorized access when session is missing', async () => {
    (requireAdmin as any).mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/admin/audit-logs', {
      method: 'POST',
      body: JSON.stringify({ riderId: 'rd_1' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('records audit log when admin reveals rider PII', async () => {
    (requireAdmin as any).mockResolvedValueOnce({
      adminId: 'adm_1',
      adminRole: 'OPS_SUPERVISOR',
    });

    const req = new NextRequest('http://localhost/api/admin/audit-logs', {
      method: 'POST',
      body: JSON.stringify({
        riderId: 'rd_1',
        action: 'admin.kyc_pii_revealed',
      }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'adm_1',
        actorType: 'ADMIN',
        action: 'admin.kyc_pii_revealed',
        entity: 'Rider',
        entityId: 'rd_1',
      })
    );
  });
});
