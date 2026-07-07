import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, adminLogin } from '../helpers';

/**
 * GET /api/admin/coupons — List coupons (paginated)
 * POST /api/admin/coupons — Create a new coupon
 * PUT /api/admin/coupons — Update an existing coupon (id in body)
 * DELETE /api/admin/coupons — Delete a coupon (id in body)
 *
 * Requires admin permission: offers_manage
 */
describe('GET /api/admin/coupons', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();
  });

  it('1. returns 200 with list of coupons', async () => {
    const { status, body } = await api('/api/admin/coupons', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('2. supports pagination', async () => {
    const { status, body } = await api('/api/admin/coupons?page=1&limit=5', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.pagination).toBeDefined();
  });

  it('3. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/coupons', { method: 'GET' });
    expect(status).toBe(401);
  });
});

describe('POST /api/admin/coupons', () => {
  let adminCookie: string;
  const testCode = `TEST${Date.now().toString().slice(-6)}`;
  let createdCouponId: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();
  });

  afterAll(async () => {
    if (createdCouponId) {
      await api('/api/admin/coupons', {
        method: 'DELETE',
        cookie: adminCookie,
        json: { id: createdCouponId },
      });
    }
  });

  it('1. creates a new coupon', async () => {
    const { status, body } = await api('/api/admin/coupons', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        code: testCode,
        description: 'Test coupon for integration tests',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        validFrom: '01-07-2026',
        validUntil: '31-07-2026',
      },
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    createdCouponId = body.data.id;
  });

  it('2. returns 422 when code is missing', async () => {
    const { status } = await api('/api/admin/coupons', {
      method: 'POST',
      cookie: adminCookie,
      json: { description: 'no code', discountType: 'PERCENTAGE', discountValue: 5, validFrom: '01-07-2026', validUntil: '31-07-2026' },
    });
    expect(status).toBe(422);
  });

  it('3. returns 422 when discountType is invalid', async () => {
    const { status } = await api('/api/admin/coupons', {
      method: 'POST',
      cookie: adminCookie,
      json: { code: 'INVALID_TYPE', description: 'bad type', discountType: 'INVALID', discountValue: 5, validFrom: '01-07-2026', validUntil: '31-07-2026' },
    });
    expect(status).toBe(422);
  });

  it('4. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/coupons', {
      method: 'POST',
      json: { code: 'X', description: 'x', discountType: 'PERCENTAGE', discountValue: 1, validFrom: '01-07-2026', validUntil: '31-07-2026' },
    });
    expect(status).toBe(401);
  });
});

describe('PUT /api/admin/coupons', () => {
  let adminCookie: string;
  const testCode = `UPD${Date.now().toString().slice(-6)}`;
  let testCouponId: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();
    const { body } = await api('/api/admin/coupons', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        code: testCode,
        description: 'Coupon for update testing',
        discountType: 'FIXED',
        discountValue: 50,
        validFrom: '01-07-2026',
        validUntil: '31-07-2026',
      },
    });
    testCouponId = body.data.id;
  });

  afterAll(async () => {
    if (testCouponId) {
      await api('/api/admin/coupons', {
        method: 'DELETE',
        cookie: adminCookie,
        json: { id: testCouponId },
      });
    }
  });

  it('1. updates an existing coupon', async () => {
    const { status, body } = await api('/api/admin/coupons', {
      method: 'PUT',
      cookie: adminCookie,
      json: { id: testCouponId, description: 'Updated description' },
    });
    expect(status).toBe(200);
    expect(body.data.description).toBe('Updated description');
  });

  it('2. returns 422 when id is missing', async () => {
    const { status } = await api('/api/admin/coupons', {
      method: 'PUT',
      cookie: adminCookie,
      json: { description: 'no id' },
    });
    expect(status).toBe(422);
  });

  it('3. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/coupons', {
      method: 'PUT',
      json: { id: testCouponId, description: 'no auth' },
    });
    expect(status).toBe(401);
  });
});

describe('DELETE /api/admin/coupons', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();
  });

  it('1. deletes a coupon', async () => {
    const { body: created } = await api('/api/admin/coupons', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        code: `DEL${Date.now().toString().slice(-6)}`,
        description: 'To be deleted',
        discountType: 'PERCENTAGE',
        discountValue: 5,
        validFrom: '01-07-2026',
        validUntil: '31-07-2026',
      },
    });
    const id = created.data.id;

    const { status, body } = await api('/api/admin/coupons', {
      method: 'DELETE',
      cookie: adminCookie,
      json: { id },
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('2. returns 422 when id is missing', async () => {
    const { status } = await api('/api/admin/coupons', {
      method: 'DELETE',
      cookie: adminCookie,
      json: {},
    });
    expect(status).toBe(422);
  });

  it('3. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/coupons', {
      method: 'DELETE',
      json: { id: 'any-id' },
    });
    expect(status).toBe(401);
  });
});
