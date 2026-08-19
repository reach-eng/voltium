import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
  db: {
    paymentGateway: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  },
  createAuditLog: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: () =>
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
}));
vi.mock('@/lib/permissions', () => ({ hasPermission: mocks.hasPermission }));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));

import { GET, POST } from '@/app/api/admin/payment-gateways/route';
import { PATCH, DELETE } from '@/app/api/admin/payment-gateways/[id]/route';

describe('Payment Gateways Admin API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ adminId: 'admin_1', adminRole: 'SUPER_ADMIN' });
    mocks.hasPermission.mockReturnValue(true);
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.db.paymentGateway.updateMany.mockResolvedValue({ count: 1 });
  });

  it('GET /api/admin/payment-gateways returns list of gateways', async () => {
    mocks.db.paymentGateway.findMany.mockResolvedValue([
      { id: 'gw_1', name: 'Razorpay', provider: 'RAZORPAY', isActive: true },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe('Razorpay');
  });

  it('POST /api/admin/payment-gateways creates new gateway and deactivates others if active', async () => {
    mocks.db.paymentGateway.create.mockResolvedValue({
      id: 'gw_new',
      name: 'Cashfree',
      provider: 'CASHFREE',
      isActive: true,
    });

    const req = new NextRequest('http://localhost/api/admin/payment-gateways', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Cashfree',
        provider: 'CASHFREE',
        isActive: true,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.name).toBe('Cashfree');
    expect(mocks.db.paymentGateway.updateMany).toHaveBeenCalledWith({
      where: { isActive: true },
      data: { isActive: false },
    });
  });

  it('PATCH /api/admin/payment-gateways/[id] updates gateway and deactivates others when activated', async () => {
    mocks.db.paymentGateway.findUnique.mockResolvedValue({ id: 'gw_1', name: 'Razorpay' });
    mocks.db.paymentGateway.update.mockResolvedValue({ id: 'gw_1', isActive: true });

    const req = new NextRequest('http://localhost/api/admin/payment-gateways/gw_1', {
      method: 'PATCH',
      body: JSON.stringify({ isActive: true }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: 'gw_1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.isActive).toBe(true);
    expect(mocks.db.paymentGateway.updateMany).toHaveBeenCalledWith({
      where: { id: { not: 'gw_1' }, isActive: true },
      data: { isActive: false },
    });
  });

  it('DELETE /api/admin/payment-gateways/[id] deletes gateway', async () => {
    mocks.db.paymentGateway.findUnique.mockResolvedValue({ id: 'gw_1', name: 'Razorpay' });
    mocks.db.paymentGateway.delete.mockResolvedValue({ id: 'gw_1' });

    const req = new NextRequest('http://localhost/api/admin/payment-gateways/gw_1', {
      method: 'DELETE',
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: 'gw_1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
