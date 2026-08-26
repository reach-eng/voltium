import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, adminLogin } from '../helpers';

/**
 * GET /api/admin/legal — List all legal documents
 * PUT /api/admin/legal — Upsert a legal document (type + content)
 *
 * Requires admin permission: legal_manage
 */
describe('GET /api/admin/legal', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
  });

  it('1. returns 200 with list of legal documents', async () => {
    const { status, body } = await api('/api/admin/legal', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('2. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/legal', { method: 'GET' });
    expect(status).toBe(401);
  });
});

describe('PUT /api/admin/legal', () => {
  let adminCookie: string;
  const originalTerms = { type: 'terms' as const, title: 'Original Terms', content: 'Original content' };

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
  });

  afterAll(async () => {
    // Restore original content.
    await api('/api/admin/legal', {
      method: 'PUT',
      cookie: adminCookie,
      json: originalTerms,
    });
    // W9 / L-1: restores land as DRAFT — republish so riders keep seeing
    // live terms on the shared environment.
    await api('/api/admin/legal/terms/publish', {
      method: 'POST',
      cookie: adminCookie,
    });
  });

  it('1. upserts a legal document', async () => {
    const { status, body } = await api('/api/admin/legal', {
      method: 'PUT',
      cookie: adminCookie,
      json: {
        type: 'terms',
        title: 'Updated Terms of Service',
        content: 'New terms content for testing',
      },
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.type).toBe('terms');
    // W9 / L-1: a changed save drops the doc to DRAFT.
    expect(body.data.status).toBe('DRAFT');
    // Republish so subsequent suites / riders see live terms again.
    const pub = await api('/api/admin/legal/terms/publish', {
      method: 'POST',
      cookie: adminCookie,
    });
    expect(pub.status).toBe(200);
    expect(pub.body.data.status).toBe('PUBLISHED');
  });

  it('2. supports all document types (save + publish keeps riders covered)', async () => {
    for (const type of ['terms', 'privacy', 'refund', 'lease']) {
      const { status } = await api('/api/admin/legal', {
        method: 'PUT',
        cookie: adminCookie,
        json: { type, title: `Test ${type}`, content: `Content for ${type}` },
      });
      expect(status).toBe(200);
      // W9 / L-1: without publishing, these docs would be invisible to
      // riders on the shared environment after the suite finishes.
      const pub = await api(`/api/admin/legal/${type}/publish`, {
        method: 'POST',
        cookie: adminCookie,
      });
      expect(pub.status).toBe(200);
    }
  });

  it('3. returns 422 when type is invalid', async () => {
    const { status } = await api('/api/admin/legal', {
      method: 'PUT',
      cookie: adminCookie,
      json: { type: 'invalid_type', content: 'test' },
    });
    expect(status).toBe(422);
  });

  it('4. returns 422 when content is missing', async () => {
    const { status } = await api('/api/admin/legal', {
      method: 'PUT',
      cookie: adminCookie,
      json: { type: 'terms' },
    });
    expect(status).toBe(422);
  });

  it('5. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/legal', {
      method: 'PUT',
      json: { type: 'terms', content: 'no auth' },
    });
    expect(status).toBe(401);
  });
});

// W9 / L-1: end-to-end draft lifecycle — a changed save must NOT be
// rider-visible until published.
describe('L-1 draft/publish flow', () => {
  let adminCookie: string;
  const sentinel = `L1-SENTINEL-${Date.now()}`;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
  });

  afterAll(async () => {
    await api('/api/admin/legal', {
      method: 'PUT',
      cookie: adminCookie,
      json: originalTerms,
    });
    await api('/api/admin/legal/terms/publish', {
      method: 'POST',
      cookie: adminCookie,
    });
  });

  it('save → hidden from riders → publish → visible', async () => {
    // Save new content (lands as DRAFT).
    const put = await api('/api/admin/legal', {
      method: 'PUT',
      cookie: adminCookie,
      json: { type: 'terms', content: sentinel },
    });
    expect(put.status).toBe(200);
    expect(put.body.data.status).toBe('DRAFT');

    // Rider surface must NOT include the sentinel yet.
    const before = await api('/api/rider/legal');
    const beforeBody = before.body.data.find?.((d: { type: string }) => d.type === 'terms');
    expect(beforeBody?.content ?? '').not.toContain(sentinel);

    // Publish → rider surface shows it.
    const pub = await api('/api/admin/legal/terms/publish', {
      method: 'POST',
      cookie: adminCookie,
    });
    expect(pub.status).toBe(200);

    const after = await api('/api/rider/legal');
    const afterBody = after.body.data.find((d: { type: string }) => d.type === 'terms');
    expect(afterBody.content).toContain(sentinel);
  });

  it('publish returns 401 without auth', async () => {
    const { status } = await api('/api/admin/legal/terms/publish', {
      method: 'POST',
    });
    expect(status).toBe(401);
  });
});
