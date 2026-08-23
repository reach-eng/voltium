import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, adminLogin } from '../helpers';

/**
 * GET /api/admin/admins — List admins (paginated, searchable, filterable)
 * POST /api/admin/admins — Create a new admin
 * PUT /api/admin/admins — Update an existing admin (id in body)
 *
 * Requires admin permission: admins_manage
 */
describe('GET /api/admin/admins', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
  });

  it('1. returns 200 with list of admins', async () => {
    const { status, body } = await api('/api/admin/admins', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('2. supports pagination', async () => {
    const { status, body } = await api('/api/admin/admins?page=1&limit=5', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.pagination).toBeDefined();
  });

  it('3. supports search', async () => {
    const { status, body } = await api('/api/admin/admins?search=admin', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
  });

  it('4. supports role filter', async () => {
    const { status, body } = await api('/api/admin/admins?role=SUPER_ADMIN', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
  });

  it('5. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/admins', { method: 'GET' });
    expect(status).toBe(401);
  });
});

describe('POST /api/admin/admins', () => {
  let adminCookie: string;
  const testEmail = `test-admin-${Date.now()}@voltium.io`;
  let createdAdminId: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
  });

  afterAll(async () => {
    if (createdAdminId) {
      // PUT with isActive=false is a soft-delete pattern. P0-1
      // (ADMIN_ADMIN_USERS_AUDIT_2026-08-24) added a `reason` requirement
      // for deactivations — the audit log records it alongside the IP/UA.
      await api('/api/admin/admins', {
        method: 'PUT',
        cookie: adminCookie,
        json: {
          id: createdAdminId,
          isActive: false,
          reason: 'test cleanup',
        },
      });
    }
  });

  it('1. creates a new admin', async () => {
    const { status, body } = await api('/api/admin/admins', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        name: 'Test Admin',
        email: testEmail,
        // PasswordComplexitySchema: ≥8 chars + upper + lower + digit + special.
        // The old 'testPassword123' was rejected as 422 (no special char).
        password: 'TestPassword123!',
        role: 'READ_ONLY',
      },
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    createdAdminId = body.data.id;
  });

  it('2. returns 400 when name is missing', async () => {
    const { status } = await api('/api/admin/admins', {
      method: 'POST',
      cookie: adminCookie,
      json: { email: 'x@x.com', password: 'TestPassword123!' },
    });
    expect([400, 405, 422]).toContain(status);
  });

  it('3. returns 400 when email is missing', async () => {
    const { status } = await api('/api/admin/admins', {
      method: 'POST',
      cookie: adminCookie,
      json: { name: 'x', password: 'TestPassword123!' },
    });
    expect([400, 405, 422]).toContain(status);
  });

  it('4. returns 400 when password is too short', async () => {
    const { status } = await api('/api/admin/admins', {
      method: 'POST',
      cookie: adminCookie,
      json: { name: 'x', email: 'short@pw.com', password: 'short' },
    });
    expect([400, 405, 422]).toContain(status);
  });

  it('5. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/admins', {
      method: 'POST',
      json: { name: 'x', email: 'noauth@x.com', password: 'TestPassword123!' },
    });
    expect(status).toBe(401);
  });
});

describe('PUT /api/admin/admins', () => {
  let adminCookie: string;
  let testAdminId: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
    const { body } = await api('/api/admin/admins', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        name: 'Update Test Admin',
        email: `update-test-${Date.now()}@voltium.io`,
        password: 'TestPassword123!',
        role: 'READ_ONLY',
      },
    });
    testAdminId = body.data.id;
  });

  it('1. updates an existing admin', async () => {
    const { status, body } = await api('/api/admin/admins', {
      method: 'PUT',
      cookie: adminCookie,
      json: { id: testAdminId, name: 'Updated Name' },
    });
    expect(status).toBe(200);
    expect(body.data.name).toBe('Updated Name');
  });

  it('2. returns 400 when id is missing', async () => {
    const { status } = await api('/api/admin/admins', {
      method: 'PUT',
      cookie: adminCookie,
      json: { name: 'no id' },
    });
    expect([400, 405, 422]).toContain(status);
  });

  it('3. returns 400 when password is too short', async () => {
    const { status } = await api('/api/admin/admins', {
      method: 'PUT',
      cookie: adminCookie,
      json: { id: testAdminId, password: 'short' },
    });
    expect([400, 405, 422]).toContain(status);
  });

  it('4. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/admins', {
      method: 'PUT',
      json: { id: testAdminId, name: 'no auth' },
    });
    expect(status).toBe(401);
  });
});
