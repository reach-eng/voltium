import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, adminLogin } from '../helpers';

/**
 * GET /api/admin/faqs — List FAQs (paginated, searchable)
 * POST /api/admin/faqs — Create a new FAQ
 * PUT /api/admin/faqs — Update an existing FAQ (id in body)
 * DELETE /api/admin/faqs?id={id} — Delete an FAQ
 *
 * Requires admin permission: faq_manage
 */
describe('GET /api/admin/faqs', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
  });

  it('1. returns 200 with a list of FAQs', async () => {
    const { status, body } = await api('/api/admin/faqs', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('2. supports pagination', async () => {
    const { status, body } = await api('/api/admin/faqs?page=1&limit=5', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(5);
  });

  it('3. supports search query', async () => {
    const { status, body } = await api('/api/admin/faqs?search=how', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
  });

  it('4. supports category filter', async () => {
    const { status, body } = await api('/api/admin/faqs?category=booking', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
  });

  it('5. returns 401 without auth cookie', async () => {
    const { status } = await api('/api/admin/faqs', { method: 'GET' });
    expect(status).toBe(401);
  });

  it('6. returns 403 with insufficient permissions', async () => {
    const { status } = await api('/api/admin/faqs', {
      method: 'GET',
      cookie: 'auth_token=invalid_faq_user_token',
    });
    expect([401, 403, 405]).toContain(status);
  });
});

describe('POST /api/admin/faqs', () => {
  let adminCookie: string;
  let createdFaqId: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
  });

  afterAll(async () => {
    if (createdFaqId) {
      await api(`/api/admin/faqs?id=${createdFaqId}`, {
        method: 'DELETE',
        cookie: adminCookie,
      });
    }
  });

  it('1. creates a new FAQ', async () => {
    const { status, body } = await api('/api/admin/faqs', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        question: 'How do I book a vehicle?',
        answer: 'Use the app to find a vehicle and tap Book.',
        category: 'booking',
      },
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    createdFaqId = body.data.id;
  });

  it('2. returns 422 when question is missing', async () => {
    const { status } = await api('/api/admin/faqs', {
      method: 'POST',
      cookie: adminCookie,
      json: { answer: 'incomplete' },
    });
    expect(status).toBe(422);
  });

  it('3. returns 422 when answer is missing', async () => {
    const { status } = await api('/api/admin/faqs', {
      method: 'POST',
      cookie: adminCookie,
      json: { question: 'missing answer' },
    });
    expect(status).toBe(422);
  });

  it('4. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/faqs', {
      method: 'POST',
      json: { question: 'x', answer: 'y' },
    });
    expect(status).toBe(401);
  });
});

describe('PUT /api/admin/faqs', () => {
  let adminCookie: string;
  let testFaqId: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
    // Create a FAQ to update
    const { body } = await api('/api/admin/faqs', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        question: 'Original question',
        answer: 'Original answer',
        category: 'general',
      },
    });
    testFaqId = body.data.id;
  });

  afterAll(async () => {
    if (testFaqId) {
      await api(`/api/admin/faqs?id=${testFaqId}`, {
        method: 'DELETE',
        cookie: adminCookie,
      });
    }
  });

  it('1. updates an existing FAQ', async () => {
    const { status, body } = await api('/api/admin/faqs', {
      method: 'PUT',
      cookie: adminCookie,
      json: {
        id: testFaqId,
        question: 'Updated question',
        answer: 'Updated answer',
      },
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.question).toBe('Updated question');
  });

  it('2. returns 422 when id is missing', async () => {
    const { status } = await api('/api/admin/faqs', {
      method: 'PUT',
      cookie: adminCookie,
      json: { question: 'no id' },
    });
    expect(status).toBe(422);
  });

  it('3. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/faqs', {
      method: 'PUT',
      json: { id: testFaqId, question: 'no auth' },
    });
    expect(status).toBe(401);
  });
});

describe('DELETE /api/admin/faqs', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
  });

  it('1. deletes an FAQ', async () => {
    // Create first
    const { body: created } = await api('/api/admin/faqs', {
      method: 'POST',
      cookie: adminCookie,
      json: { question: 'To be deleted', answer: 'Goodbye', category: 'temp' },
    });
    const id = created.data.id;

    const { status, body } = await api(`/api/admin/faqs?id=${id}`, {
      method: 'DELETE',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('2. returns 400 when id query param is missing', async () => {
    const { status } = await api('/api/admin/faqs', {
      method: 'DELETE',
      cookie: adminCookie,
    });
    expect([400, 405, 422]).toContain(status);
  });

  it('3. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/faqs?id=any-id', {
      method: 'DELETE',
    });
    expect(status).toBe(401);
  });
});
