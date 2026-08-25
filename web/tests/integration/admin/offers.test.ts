import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, adminLogin } from '../helpers';

describe('GET /api/admin/offers', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
  });

  it('1. returns 200 with list of offers', async () => {
    const { status, body } = await api('/api/admin/offers', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('2. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/offers', { method: 'GET' });
    expect(status).toBe(401);
  });
});

describe('POST /api/admin/offers', () => {
  let adminCookie: string;
  let createdOfferId: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
  });

  afterAll(async () => {
    if (createdOfferId) {
      await api('/api/admin/offers', {
        method: 'DELETE',
        cookie: adminCookie,
        json: { id: createdOfferId },
      });
    }
  });

  it('1. creates a new offer', async () => {
    const { status, body } = await api('/api/admin/offers', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        title: 'Test Offer',
        description: 'This is a test offer for integration tests',
        validFrom: '2026-07-01T00:00:00Z',
        validUntil: '2026-07-31T00:00:00Z',
        isActive: true,
      },
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    createdOfferId = body.data?.id;
  });

  it('2. returns 422 when title is missing', async () => {
    const { status } = await api('/api/admin/offers', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        description: 'no title',
        validFrom: '2026-07-01T00:00:00Z',
        validUntil: '2026-07-31T00:00:00Z'
      },
    });
    expect(status).toBe(422);
  });

  it('3. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/offers', {
      method: 'POST',
      json: {
        title: 'x',
        description: 'y',
        validFrom: '2026-07-01T00:00:00Z',
        validUntil: '2026-07-31T00:00:00Z'
      },
    });
    expect(status).toBe(401);
  });
});

describe('PUT /api/admin/offers', () => {
  let adminCookie: string;
  let testOfferId: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
    const { body } = await api('/api/admin/offers', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        title: 'Update Test',
        description: 'Offer for update testing',
        validFrom: '2026-07-01T00:00:00Z',
        validUntil: '2026-07-31T00:00:00Z',
      },
    });
    testOfferId = body.data?.id;
  });

  afterAll(async () => {
    if (testOfferId) {
      await api('/api/admin/offers', {
        method: 'DELETE',
        cookie: adminCookie,
        json: { id: testOfferId },
      });
    }
  });

  it('1. updates an existing offer', async () => {
    const { status, body } = await api('/api/admin/offers', {
      method: 'PUT',
      cookie: adminCookie,
      json: { id: testOfferId, title: 'Updated Title' },
    });
    expect(status).toBe(200);
    expect(body.data.title).toBe('Updated Title');
  });

  it('2. returns 422 when id is missing', async () => {
    const { status } = await api('/api/admin/offers', {
      method: 'PUT',
      cookie: adminCookie,
      json: { title: 'no id' },
    });
    expect(status).toBe(422);
  });

  it('3. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/offers', {
      method: 'PUT',
      json: { id: testOfferId, title: 'no auth' },
    });
    expect(status).toBe(401);
  });
});

describe('DELETE /api/admin/offers', () => {
  let adminCookie: string;
  let testOfferId: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
    const { body } = await api('/api/admin/offers', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        title: 'Delete Test',
        description: 'Will be deleted',
        validFrom: '2026-07-01T00:00:00Z',
        validUntil: '2026-07-31T00:00:00Z',
      },
    });
    testOfferId = body.data?.id;
  });

  it('1. deletes an offer', async () => {
    const { status, body } = await api('/api/admin/offers', {
      method: 'DELETE',
      cookie: adminCookie,
      json: { id: testOfferId },
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('2. returns 422 when id is missing', async () => {
    const { status } = await api('/api/admin/offers', {
      method: 'DELETE',
      cookie: adminCookie,
      json: {},
    });
    expect(status).toBe(422);
  });

  it('3. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/offers', {
      method: 'DELETE',
      json: { id: 'any-id' },
    });
    expect(status).toBe(401);
  });
});
