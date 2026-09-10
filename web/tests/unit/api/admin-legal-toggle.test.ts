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

  it('PUT /api/admin/legal updates document content (P0: no isActive toggle — the model has no such column)', async () => {
    vi.mocked(legalUseCases.upsert).mockResolvedValue({
      id: '1',
      type: 'terms',
      title: 'Terms of Service',
      content: 'Updated terms body',
      updatedAt: new Date(),
    } as any);

    const req = new NextRequest('http://localhost/api/admin/legal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'terms',
        content: 'Updated terms body',
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.content).toBe('Updated terms body');
    expect(legalUseCases.upsert).toHaveBeenCalledWith(
      { type: 'terms', content: 'Updated terms body', locale: 'en' },
      'admin_1'
    );
  });

  it('PUT /api/admin/legal updates title and locale together', async () => {
    vi.mocked(legalUseCases.upsert).mockResolvedValue({
      id: '3',
      type: 'rental_safety',
      title: 'Rental & Safety Agreement (v2)',
      content: '...',
      updatedAt: new Date(),
    } as any);

    const req = new NextRequest('http://localhost/api/admin/legal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'rental_safety',
        title: 'Rental & Safety Agreement (v2)',
        content: '...',
        locale: 'hi',
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('Rental & Safety Agreement (v2)');
    expect(legalUseCases.upsert).toHaveBeenCalledWith(
      {
        type: 'rental_safety',
        title: 'Rental & Safety Agreement (v2)',
        content: '...',
        locale: 'hi',
      },
      'admin_1'
    );
  });

  it('PUT /api/admin/legal REJECTS isActive (P0 regression pin — schema-strict, 422 not a downstream Prisma 500)', async () => {
    const req = new NextRequest('http://localhost/api/admin/legal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'terms',
        isActive: false,
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(422);
    expect(legalUseCases.upsert).not.toHaveBeenCalled();
  });

  // ── P1-2 Markdown stripper ────────────────────────────────────────────

  it('PUT strips ATX headings from content before reaching upsert', async () => {
    vi.mocked(legalUseCases.upsert).mockResolvedValue({ id: '1', type: 'terms', title: 'Terms of Service', content: '', updatedAt: new Date() } as any);
    // Blank line before each heading so the stripper preserves the paragraph
    // breaks (blank lines become blank lines in the output).
    const req = new NextRequest('http://localhost/api/admin/legal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'terms',
        content: '# Terms of Service\n\n## 1. Acceptance\n\n### 1.1 Eligibility',
      }),
    });
    await PUT(req);
    expect(legalUseCases.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Terms of Service\n\n1. Acceptance\n\n1.1 Eligibility' }),
      expect.any(String)
    );
  });

  it('PUT strips bold/italic/underscore emphasis from content', async () => {
    vi.mocked(legalUseCases.upsert).mockResolvedValue({ id: '1', type: 'privacy', title: 'Privacy Policy', content: '', updatedAt: new Date() } as any);
    const req = new NextRequest('http://localhost/api/admin/legal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'privacy',
        content: '**Bold text** and *italic text* and __underscore bold__ and _italic_',
      }),
    });
    await PUT(req);
    expect(legalUseCases.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Bold text and italic text and underscore bold and italic' }),
      expect.any(String)
    );
  });

  it('PUT strips unordered list markers (ordered lists preserved — see stripMarkdown comment)', async () => {
    vi.mocked(legalUseCases.upsert).mockResolvedValue({ id: '1', type: 'refund', title: 'Refund Policy', content: '', updatedAt: new Date() } as any);
    const req = new NextRequest('http://localhost/api/admin/legal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'refund',
        content: '## Refund Policy\n\n- Processed within 7 business days\n- Deducted for damages\n\n1. First item\n2. Second item',
      }),
    });
    await PUT(req);
    // Unordered markers (- *) are stripped; ordered markers (1. 2.) are
    // intentionally NOT stripped — "1. Acceptance of Terms" (a numbered
    // heading) and "1. First item" (a list) are indistinguishable at
    // line-start and the lookbehind can't reliably tell them apart.
    expect(legalUseCases.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Refund Policy\n\nProcessed within 7 business days\nDeducted for damages\n\n1. First item\n2. Second item' }),
      expect.any(String)
    );
  });

  it('PUT strips inline code and horizontal rules', async () => {
    vi.mocked(legalUseCases.upsert).mockResolvedValue({ id: '1', type: 'guarantor', title: 'Guarantor Agreement', content: '', updatedAt: new Date() } as any);
    const req = new NextRequest('http://localhost/api/admin/legal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'guarantor',
        content: '## Guarantor Agreement\n\nUse `Rs.5,000` as the minimum.\n\n---\n\nBy signing, you accept.',
      }),
    });
    await PUT(req);
    expect(legalUseCases.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Guarantor Agreement\n\nUse Rs.5,000 as the minimum.\n\nBy signing, you accept.' }),
      expect.any(String)
    );
  });

  it('PUT preserves paragraph breaks (double newlines)', async () => {
    vi.mocked(legalUseCases.upsert).mockResolvedValue({ id: '1', type: 'lease', title: 'Lease Agreement', content: '', updatedAt: new Date() } as any);
    const req = new NextRequest('http://localhost/api/admin/legal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'lease',
        content: '## Parties\n\nVoltium Electric Mobility (Lessor)\n\nRider (Lessee)\n\n## Terms\n\nSecurity Deposit: Rs.5,000',
      }),
    });
    await PUT(req);
    // Paragraph breaks (double newlines) survive the strip.
    expect(legalUseCases.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Parties\n\nVoltium Electric Mobility (Lessor)\n\nRider (Lessee)\n\nTerms\n\nSecurity Deposit: Rs.5,000' }),
      expect.any(String)
    );
  });

  // ── P1-3 locale routing ───────────────────────────────────────────────

  it('GET ?locale=hi returns only Hindi rows', async () => {
    const hiDocs = [{ id: 'h1', type: 'terms', title: 'सेवा की शर्तें', content: 'हिंदी सामग्री', updatedAt: new Date() }];
    vi.mocked(legalUseCases.list).mockResolvedValue(hiDocs as any);

    const res = await GET(new NextRequest('http://localhost/api/admin/legal?locale=hi'));
    expect(res.status).toBe(200);
    expect(legalUseCases.list).toHaveBeenCalledWith('hi');
  });

  it('GET ?locale=en returns only English rows', async () => {
    vi.mocked(legalUseCases.list).mockResolvedValue([] as any);
    const res = await GET(new NextRequest('http://localhost/api/admin/legal?locale=en'));
    expect(res.status).toBe(200);
    expect(legalUseCases.list).toHaveBeenCalledWith('en');
  });
});
