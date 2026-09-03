import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { LEGAL_DOCUMENT_TYPES } from '@/lib/validators/admin';

vi.mock('@/lib/rbac', () => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: () => new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
  adminForbidden: () => new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
}));

vi.mock('@/lib/auth', () => ({
  hasPermission: vi.fn().mockReturnValue(true),
}));

vi.mock('@/server/modules/legal/legal.use-cases', () => ({
  legalUseCases: {
    list: vi.fn(),
    upsert: vi.fn(),
  },
}));

const { GET, PUT } = await import('@/app/api/admin/legal/route');
const { requireAdmin } = await import('@/lib/rbac');
const { legalUseCases } = await import('@/server/modules/legal/legal.use-cases');

describe('Admin Legal API — 6 Document Types & Active Toggling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({
      adminId: 'admin_1',
      adminRole: 'super_admin',
    } as any);
  });

  it('contains all 6 legal document types', () => {
    const keys = LEGAL_DOCUMENT_TYPES.map((d) => d.key);
    expect(keys).toEqual([
      'terms',
      'privacy',
      'rental_safety',
      'refund',
      'guarantor',
      'lease',
    ]);
  });

  it('GET /api/admin/legal returns all documents with isActive state', async () => {
    const docs = [
      { id: '1', type: 'terms', title: 'Terms of Service', content: '...', isActive: true, updatedAt: new Date() },
      { id: '2', type: 'privacy', title: 'Privacy Policy', content: '...', isActive: false, updatedAt: new Date() },
    ];
    vi.mocked(legalUseCases.list).mockResolvedValue(docs as any);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].isActive).toBe(true);
    expect(body.data[1].isActive).toBe(false);
  });

  it('PUT /api/admin/legal toggles isActive to false (deactivation)', async () => {
    vi.mocked(legalUseCases.upsert).mockResolvedValue({
      id: '1',
      type: 'terms',
      title: 'Terms of Service',
      content: '...',
      isActive: false,
      updatedAt: new Date(),
    } as any);

    const req = new NextRequest('http://localhost/api/admin/legal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'terms',
        isActive: false,
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.isActive).toBe(false);
    expect(legalUseCases.upsert).toHaveBeenCalledWith(
      { type: 'terms', isActive: false },
      'admin_1'
    );
  });

  it('PUT /api/admin/legal toggles isActive to true (activation)', async () => {
    vi.mocked(legalUseCases.upsert).mockResolvedValue({
      id: '3',
      type: 'rental_safety',
      title: 'Rental & Safety Agreement',
      content: '...',
      isActive: true,
      updatedAt: new Date(),
    } as any);

    const req = new NextRequest('http://localhost/api/admin/legal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'rental_safety',
        isActive: true,
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.isActive).toBe(true);
  });
});
