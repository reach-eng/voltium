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
    // Restore original content
    await api('/api/admin/legal', {
      method: 'PUT',
      cookie: adminCookie,
      json: originalTerms,
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
  });

  it('2. supports all document types', async () => {
    for (const type of ['terms', 'privacy', 'refund', 'lease']) {
      const { status } = await api('/api/admin/legal', {
        method: 'PUT',
        cookie: adminCookie,
        json: { type, title: `Test ${type}`, content: `Content for ${type}` },
      });
      expect(status).toBe(200);
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
