import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// 2026-08-05 legal/device audit P0-3 (Flutter Onboarding P0-3): the rider
// legal screen must render documents served by the admin-managed legal module
// instead of a hardcoded copy, so legal edits reach riders. This gates the
// public GET endpoint the screen fetches (pre-login, so no session).

vi.mock('@/server/modules/legal/legal.use-cases', () => ({
  legalUseCases: {
    list: vi.fn(),
  },
}));

const { GET } = await import('@/app/api/rider/legal/route');
const { legalUseCases } = await import('@/server/modules/legal/legal.use-cases');

const mockDocs = [
  {
    type: 'terms',
    title: 'Terms of Service',
    content: 'You agree to the terms…',
    updatedAt: new Date('2026-08-05T10:00:00.000Z'),
  },
  {
    type: 'privacy',
    title: 'Privacy Policy',
    content: 'We collect limited data…',
    updatedAt: new Date('2026-08-05T10:00:00.000Z'),
  },
];

describe('GET /api/rider/legal — public legal documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(legalUseCases.list).mockResolvedValue(mockDocs);
  });

  it('returns the document list with type/title/content/updatedAt', async () => {
    const res = await GET(new NextRequest('http://localhost/api/rider/legal'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({
      type: 'terms',
      title: 'Terms of Service',
      content: 'You agree to the terms…',
    });
    // ISO string, not Date — the Flutter screen reads plain strings.
    expect(typeof body.data[0].updatedAt).toBe('string');
  });

  it('applies cache headers for the rarely-changing docs', async () => {
    const res = await GET(new NextRequest('http://localhost/api/rider/legal'));
    expect(res.headers.get('Cache-Control')).toContain('300');
  });

  it('returns 500 with a friendly error when the DB query fails', async () => {
    vi.mocked(legalUseCases.list).mockRejectedValue(new Error('db down'));
    const res = await GET(new NextRequest('http://localhost/api/rider/legal'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
