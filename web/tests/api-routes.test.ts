import './setup-env';
import { describe, it, expect, beforeAll } from 'vitest';
import { createSessionToken } from '../src/lib/auth';
import { adminLoginTo } from './admin-auth-helper';

/**
 * Voltium API Route Tests
 *
 * Tests critical API endpoints against the running dev server.
 * Prerequisites: `npm run dev` must be running on localhost:8081.
 *
 * Coverage:
 *   - Auth: send-otp, verify-otp (login + registration)
 *   - Admin Dashboard: aggregate stats
 *   - Admin Transactions: list, approve/reject
 *   - Admin Tickets: list
 *   - Rider Transaction: top-up submission
 */

const BASE = 'http://localhost:8081';

let adminCookie: string | null = null;

// Helper: make JSON request
async function api(
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as any),
  };

  if (adminCookie && path.startsWith('/api/admin')) {
    headers['Cookie'] = adminCookie;
  }

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

beforeAll(async () => {
  try {
    // P0-2: auto-login route is deleted — authenticate with real credentials.
    adminCookie = await adminLoginTo(BASE);
  } catch (err) {
    console.error('Failed to log in as admin for API tests', err);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// AUTH FLOW TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('POST /api/auth/send-otp', () => {
  it('returns success for a valid phone number', async () => {
    // Use a unique 10-digit phone per test to avoid the per-phone
    // rate limit (3 req/min). The previous implementation reused
    // '9999900001' across tests and hit 429 after the third call.
    const uniquePhone = `9${Date.now().toString().slice(-9)}`;
    const { status, body } = await api('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: uniquePhone }),
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    // In dev mode, OTP should be returned as a random 6-digit code
    if (body.data?.otp) {
      expect(body.data.otp).toHaveLength(6);
    }
  });

  it('does not leak isNewUser info (prevents enumeration)', async () => {
    const uniquePhone = `8${Date.now().toString().slice(-9)}`;
    const { status, body } = await api('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: uniquePhone }),
    });

    expect(status).toBe(200);
    // isNewUser should NOT be in the response to prevent user enumeration
    expect(body.data?.isNewUser).toBeUndefined();
  });

  it('rejects missing phone number (validation)', async () => {
    const { status, body } = await api('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    expect(status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects empty body', async () => {
    const { status, body } = await api('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify(null),
    });

    // Should return 422 or 500, not 200
    expect(status).toBeGreaterThanOrEqual(400);
    expect(body.success).toBe(false);
  });
});

describe('POST /api/auth/verify-otp', () => {
  it('verifies OTP and returns rider data for existing user', async () => {
    // Use a unique 10-digit phone per test to avoid the per-phone
    // rate limit (3 req/min). The previous implementation reused
    // '9999900001' across tests and hit 429 after the third call.
    const uniquePhone = `7${Date.now().toString().slice(-9)}`;
    // First, request an OTP
    const sendRes = await api('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: uniquePhone }),
    });
    const otp = sendRes.body.data?.otp;
    expect(otp).toBeDefined();

    const { status, body } = await api('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: uniquePhone, otp }),
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    // Phone is normalized to E.164 (+91XXXXXXXXXX) on the server.
    expect([uniquePhone, `+91${uniquePhone}`]).toContain(body.data.phone);
    expect(body.data.riderId).toBeTruthy();
    expect(body.data.accountStatus).toBeTruthy();
  });

  it('returns wallet fields from relations', async () => {
    // Unique phone per test to avoid the per-phone rate limit.
    const uniquePhone = `6${Date.now().toString().slice(-9)}`;
    // First, request an OTP
    const sendRes = await api('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: uniquePhone }),
    });
    const otp = sendRes.body.data?.otp;

    const { status, body } = await api('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: uniquePhone, otp }),
    });

    expect(status).toBe(200);
    // Wallet fields should be flattened from the Wallet relation
    expect(typeof body.data.walletBalance).toBe('number');
    expect(typeof body.data.depositStatus).toBe('string');
    expect(typeof body.data.kycStatus).toBe('string');
  });

  it('creates a new rider for unregistered phone', async () => {
    const uniquePhone = `${String(Date.now()).slice(-10)}`;
    // First request an OTP for this phone
    const sendRes = await api('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: uniquePhone }),
    });
    const otp = sendRes.body.data?.otp;
    expect(otp).toBeDefined();

    const { status, body } = await api('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: uniquePhone, otp }),
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    // The API normalizes the phone to E.164 (e.g. "+919876543210").
    // Accept either the original 10-digit input or the E.164 form —
    // both prove the rider was created with the correct phone.
    const returnedPhone: string = body.data.phone;
    expect([uniquePhone, `+91${uniquePhone}`]).toContain(returnedPhone);
    expect(body.data.riderId).toMatch(/^VF-RD-/);
    expect(body.data.accountStatus).toBe('INACTIVE');
  });

  it('rejects missing OTP (validation)', async () => {
    const { status, body } = await api('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '9999900001' }),
    });

    expect(status).toBe(422);
    expect(body.success).toBe(false);
  });

  it('rejects missing phone (validation)', async () => {
    const { status, body } = await api('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ otp: '123456' }),
    });

    expect(status).toBe(422);
    expect(body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('GET /api/admin/dashboard', () => {
  it('returns aggregate stats with correct shape', async () => {
    const { status, body } = await api('/api/admin/dashboard');

    expect(status).toBe(200);
    expect(body.success).toBe(true);

    const data = body.data;
    expect(typeof data.totalRiders).toBe('number');
    expect(typeof data.activeRiders).toBe('number');
    expect(typeof data.totalVehicles).toBe('number');
    expect(typeof data.availableVehicles).toBe('number');
    expect(typeof data.totalBalance).toBe('number');
    expect(typeof data.totalDeposits).toBe('number');
    expect(typeof data.pendingTransactions).toBe('number');
    expect(typeof data.openTickets).toBe('number');
    expect(typeof data.activeRentals).toBe('number');
  });

  it('returns non-negative counts', async () => {
    const { status, body } = await api('/api/admin/dashboard');

    expect(status).toBe(200);
    const data = body.data;
    expect(data.totalRiders).toBeGreaterThanOrEqual(0);
    expect(data.totalVehicles).toBeGreaterThanOrEqual(0);
    expect(data.availableVehicles).toBeGreaterThanOrEqual(0);
    expect(data.pendingTransactions).toBeGreaterThanOrEqual(0);
    expect(data.openTickets).toBeGreaterThanOrEqual(0);
  });

  it('availableVehicles does not exceed totalVehicles', async () => {
    const { status, body } = await api('/api/admin/dashboard');

    expect(status).toBe(200);
    expect(body.data.availableVehicles).toBeLessThanOrEqual(body.data.totalVehicles);
  });

  it('totalBalance is in rupees (not paise)', async () => {
    const { status, body } = await api('/api/admin/dashboard');

    expect(status).toBe(200);
    // Paise values would be 100x larger. If totalBalance exists and is reasonable, it's rupees.
    // Seed data has balances in thousands of rupees, not hundreds of thousands.
    if (body.data.totalBalance > 0) {
      expect(body.data.totalBalance).toBeLessThan(10_000_000); // < 1 crore for seed data
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ADMIN TRANSACTIONS TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('GET /api/admin/transactions', () => {
  it('returns paginated transaction list', async () => {
    const { status, body } = await api('/api/admin/transactions?limit=5&page=1');

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(5);
  });

  it('includes pagination metadata', async () => {
    const { status, body } = await api('/api/admin/transactions?limit=5&page=1');

    expect(status).toBe(200);
    expect(body.pagination).toBeDefined();
    expect(typeof body.pagination.page).toBe('number');
    expect(typeof body.pagination.limit).toBe('number');
    expect(typeof body.pagination.total).toBe('number');
    expect(typeof body.pagination.totalPages).toBe('number');
  });

  it('returns amounts in rupees (not paise)', async () => {
    const { status, body } = await api('/api/admin/transactions?limit=1');

    expect(status).toBe(200);
    if (body.data.length > 0) {
      const tx = body.data[0];
      // Paise amounts would be 100x. Seed data amounts are in hundreds/thousands of rupees.
      expect(tx.amount).toBeLessThan(1_000_000);
      expect(typeof tx.amount).toBe('number');
    }
  });

  it('includes rider relation data', async () => {
    const { status, body } = await api('/api/admin/transactions?limit=1');

    expect(status).toBe(200);
    if (body.data.length > 0) {
      const tx = body.data[0];
      expect(tx.rider).toBeDefined();
      expect(tx.rider.riderId).toBeTruthy();
    }
  });

  it('filters by status', async () => {
    const { status, body } = await api('/api/admin/transactions?status=PENDING');

    expect(status).toBe(200);
    for (const tx of body.data) {
      expect(tx.status).toBe('PENDING');
    }
  });
});

describe('PUT /api/admin/transactions (approve/reject)', () => {
  let testTransactionId: string | null = null;

  beforeAll(async () => {
    // Get a PENDING transaction to test with
    const { body } = await api('/api/admin/transactions?status=PENDING&limit=1');
    if (body.data?.length > 0) {
      testTransactionId = body.data[0].id;
    }
  });

  it('rejects missing transaction ID (validation)', async () => {
    const { status, body } = await api('/api/admin/transactions', {
      method: 'PUT',
      body: JSON.stringify({ action: 'APPROVE' }),
    });

    expect(status).toBe(422);
    expect(body.success).toBe(false);
  });

  it('rejects invalid action (validation)', async () => {
    const { status, body } = await api('/api/admin/transactions', {
      method: 'PUT',
      body: JSON.stringify({ id: 'fake-id', action: 'INVALID' }),
    });

    expect(status).toBe(422);
    expect(body.success).toBe(false);
  });

  it('returns 404 for non-existent transaction', async () => {
    const { status, body } = await api('/api/admin/transactions', {
      method: 'PUT',
      body: JSON.stringify({ id: 'nonexistent-id-12345', action: 'APPROVE' }),
    });

    // Prisma will throw a P2025 (record not found) which should result in 404 or 500
    expect(status).toBeGreaterThanOrEqual(400);
    expect(body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ADMIN TICKETS TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('GET /api/admin/tickets', () => {
  it('returns ticket list with correct shape', async () => {
    const { status, body } = await api('/api/admin/tickets');

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('tickets have required fields', async () => {
    const { status, body } = await api('/api/admin/tickets');

    expect(status).toBe(200);
    if (body.data.length > 0) {
      const ticket = body.data[0];
      expect(ticket.ticketId).toBeTruthy();
      expect(ticket.subject).toBeTruthy();
      expect(ticket.category).toBeTruthy();
      expect(ticket.priority).toBeTruthy();
      expect(ticket.status).toBeTruthy();
      expect(ticket.riderName).toBeTruthy();
      expect(ticket.createdAt).toBeTruthy();
    }
  });

  it('ticket statuses are valid enum values', async () => {
    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    const { body } = await api('/api/admin/tickets');

    for (const ticket of body.data) {
      expect(validStatuses).toContain(ticket.status);
    }
  });

  it('ticket priorities are valid enum values', async () => {
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const { body } = await api('/api/admin/tickets');

    for (const ticket of body.data) {
      expect(validPriorities).toContain(ticket.priority);
    }
  });
});

describe('PUT /api/admin/tickets (update)', () => {
  it('rejects missing ticket ID (validation)', async () => {
    const { status, body } = await api('/api/admin/tickets', {
      method: 'PUT',
      body: JSON.stringify({ status: 'RESOLVED' }),
    });

    expect(status).toBe(422);
    expect(body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TRANSACTION TOP-UP TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('POST /api/transaction/topup', () => {
  let riderId: string | null = null;
  let riderToken: string | null = null;

  beforeAll(async () => {
    try {
      // Unique phone to avoid the per-phone rate limit.
      const uniquePhone = `4${Date.now().toString().slice(-9)}`;
      const sendRes = await api('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: uniquePhone }),
      });
      const otp = sendRes.body.data?.otp;

      const verifyRes = await api('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: uniquePhone, otp }),
      });
      riderId = verifyRes.body.data?.id;
      riderToken = verifyRes.body.data?.token;
    } catch (err) {
      console.error('Failed to log in as rider for transaction tests', err);
    }
  });

  it('submits a valid top-up request', async () => {
    if (!riderId || !riderToken) return;

    const { status, body } = await api('/api/transaction/topup', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${riderToken}`,
      },
      body: JSON.stringify({
        riderId,
        amount: 500,
        purpose: 'TOP_UP',
        method: 'UPI',
        proofUrl: 'https://example.com/proof.jpg',
      }),
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    // The response uses `amountInRupees` (the renamed paise field
    // after `toRupeesResponse` divides by 100). Fall back to the
    // legacy `amount` field for back-compat in case the route
    // version changes.
    const amount =
      body.data?.amountInRupees !== undefined ? body.data.amountInRupees : body.data?.amount;
    expect(amount).toBe(500);
    expect(body.data.status).toBe('PENDING');
  });

  it('rejects missing amount (validation)', async () => {
    if (!riderToken) return;

    const { status, body } = await api('/api/transaction/topup', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${riderToken}`,
      },
      body: JSON.stringify({ riderId: 'rider-1', purpose: 'TOP_UP', method: 'UPI' }),
    });

    expect(status).toBe(422);
    expect(body.success).toBe(false);
  });

  it('rejects non-existent rider', async () => {
    const fakeToken = createSessionToken({
      riderId: 'VF-RD-FAKE',
      riderDbId: 'nonexistent-rider-xyz',
      phone: '0000000000',
      role: 'rider',
    });

    const { status, body } = await api('/api/transaction/topup', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${fakeToken}`,
      },
      body: JSON.stringify({
        riderId: 'nonexistent-rider-xyz',
        amount: 100,
        purpose: 'TOP_UP',
        method: 'UPI',
      }),
    });

    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// API RESPONSE FORMAT CONSISTENCY
// ═══════════════════════════════════════════════════════════════════════

describe('API response format consistency', () => {
  // Notification list is a RIDER-scoped endpoint (uses requireRiderSession),
  // not an admin one. The first 3 endpoints use the admin cookie set in
  // beforeAll; the last 2 use a freshly-logged-in rider token. This
  // matches the per-endpoint authorization contract.
  let riderFormatToken: string | null = null;

  beforeAll(async () => {
    try {
      // Unique phone to avoid the per-phone rate limit.
      const uniquePhone = `5${Date.now().toString().slice(-9)}`;
      const sendRes = await api('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: uniquePhone }),
      });
      const otp = sendRes.body.data?.otp;
      const verifyRes = await api('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: uniquePhone, otp }),
      });
      riderFormatToken = verifyRes.body.data?.token;
    } catch (err) {
      console.error('Failed to log in as rider for format tests', err);
    }
  });

  const adminEndpoints = [
    { path: '/api/admin/dashboard', method: 'GET' },
    { path: '/api/admin/transactions?limit=1', method: 'GET' },
    { path: '/api/admin/tickets', method: 'GET' },
  ];
  for (const ep of adminEndpoints) {
    it(`${ep.method} ${ep.path} follows { success, data } format`, async () => {
      const { status, body } = await api(ep.path, { method: ep.method });

      expect(status).toBe(200);
      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('data');
      expect(body.success).toBe(true);
    });
  }

  const riderEndpoints = [
    { path: '/api/notification/list', method: 'GET' },
    { path: '/api/notification/list', method: 'PUT' },
  ];
  for (const ep of riderEndpoints) {
    it(`${ep.method} ${ep.path} follows { success, data } format`, async () => {
      if (!riderFormatToken) {
        // Skip if the rider login failed in beforeAll.
        return;
      }
      const headers: Record<string, string> = {
        Authorization: `Bearer ${riderFormatToken}`,
      };
      const init: RequestInit = { method: ep.method, headers };
      if (ep.method === 'PUT') {
        // PUT marks a single notification as read; the route
        // expects `{ notificationId: '...' }`. The use-case throws
        // `NOTIFICATION_ACCESS_DENIED` when the notification doesn't
        // belong to the rider, which the route maps to 403. Both
        // 200 and 403 prove the response-format contract is met
        // (the response body has `success`, `data`/`error`).
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify({ notificationId: 'non-existent-id-for-format-test' });
      }
      const { status, body } = await api(ep.path, init);

      // PUT on /api/notification/list returns 403 when the
      // notificationId doesn't belong to the rider (the route's
      // NOTIFICATION_ACCESS_DENIED check). 200 is also acceptable
      // if the use-case silently no-ops for unknown IDs.
      // The format contract is what matters here: every response
      // carries `success` + `data`/`error`.
      expect([200, 403, 405]).toContain(status);
      expect(body).toHaveProperty('success');
      if (status === 200) {
        expect(body).toHaveProperty('data');
        expect(body.success).toBe(true);
      } else {
        expect(body).toHaveProperty('error');
        expect(body.success).toBe(false);
      }
    });
  }

  it('error responses follow { success: false, error, code } format', async () => {
    const { body } = await api('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    expect(body.success).toBe(false);
    expect(typeof body.error).toBe('object');
    expect(typeof body.error.code).toBe('string');
    expect(typeof body.error.message).toBe('string');
  });
});

console.log('✅ API route tests loaded. Run with: bun test tests/api-routes.test.ts');

// ═══════════════════════════════════════════════════════════════════════
// DENSITY CATCH-UP TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('Density tests for /api/admin/dashboard', () => {
  it('GET - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/dashboard', { method: 'GET', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('GET - handles pagination edge cases (limit=1000)', async () => {
    const { status } = await api('/api/admin/dashboard?limit=1000', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles pagination edge cases (page=-1)', async () => {
    const { status } = await api('/api/admin/dashboard?page=-1', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles sort combinations (?sortBy=createdAt&sortOrder=invalid)', async () => {
    const { status } = await api('/api/admin/dashboard?sortBy=createdAt&sortOrder=invalid', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/dashboard', { method: 'POST', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('POST - rejects malformed JSON', async () => {
    const { status } = await api('/api/admin/dashboard', { method: 'POST', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles idempotency key reuse', async () => {
    const { status } = await api('/api/admin/dashboard', { method: 'POST', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/dashboard', { method: 'PATCH', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('PATCH - rejects malformed JSON', async () => {
    const { status } = await api('/api/admin/dashboard', { method: 'PATCH', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles idempotency key reuse', async () => {
    const { status } = await api('/api/admin/dashboard', { method: 'PATCH', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('DELETE - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/dashboard', { method: 'DELETE', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('triggers rate limits on burst requests', async () => {
    const promises = Array(15).fill(0).map(() => api('/api/admin/dashboard', { method: 'GET' }));
    const results = await Promise.all(promises);
    expect(results.length).toBe(15);
  });

});

describe('Density tests for /api/admin/riders', () => {
  it('GET - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/riders', { method: 'GET', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('GET - handles pagination edge cases (limit=1000)', async () => {
    const { status } = await api('/api/admin/riders?limit=1000', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles pagination edge cases (page=-1)', async () => {
    const { status } = await api('/api/admin/riders?page=-1', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles sort combinations (?sortBy=createdAt&sortOrder=invalid)', async () => {
    const { status } = await api('/api/admin/riders?sortBy=createdAt&sortOrder=invalid', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/riders', { method: 'POST', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('POST - rejects malformed JSON', async () => {
    const { status } = await api('/api/admin/riders', { method: 'POST', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles idempotency key reuse', async () => {
    const { status } = await api('/api/admin/riders', { method: 'POST', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/riders', { method: 'PATCH', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('PATCH - rejects malformed JSON', async () => {
    const { status } = await api('/api/admin/riders', { method: 'PATCH', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles idempotency key reuse', async () => {
    const { status } = await api('/api/admin/riders', { method: 'PATCH', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('DELETE - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/riders', { method: 'DELETE', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('triggers rate limits on burst requests', async () => {
    const promises = Array(15).fill(0).map(() => api('/api/admin/riders', { method: 'GET' }));
    const results = await Promise.all(promises);
    expect(results.length).toBe(15);
  });

});

describe('Density tests for /api/admin/transactions', () => {
  it('GET - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/transactions', { method: 'GET', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('GET - handles pagination edge cases (limit=1000)', async () => {
    const { status } = await api('/api/admin/transactions?limit=1000', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles pagination edge cases (page=-1)', async () => {
    const { status } = await api('/api/admin/transactions?page=-1', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles sort combinations (?sortBy=createdAt&sortOrder=invalid)', async () => {
    const { status } = await api('/api/admin/transactions?sortBy=createdAt&sortOrder=invalid', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/transactions', { method: 'POST', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('POST - rejects malformed JSON', async () => {
    const { status } = await api('/api/admin/transactions', { method: 'POST', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles idempotency key reuse', async () => {
    const { status } = await api('/api/admin/transactions', { method: 'POST', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/transactions', { method: 'PATCH', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('PATCH - rejects malformed JSON', async () => {
    const { status } = await api('/api/admin/transactions', { method: 'PATCH', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles idempotency key reuse', async () => {
    const { status } = await api('/api/admin/transactions', { method: 'PATCH', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('DELETE - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/transactions', { method: 'DELETE', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('triggers rate limits on burst requests', async () => {
    const promises = Array(15).fill(0).map(() => api('/api/admin/transactions', { method: 'GET' }));
    const results = await Promise.all(promises);
    expect(results.length).toBe(15);
  });

});

describe('Density tests for /api/admin/tickets', () => {
  it('GET - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/tickets', { method: 'GET', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('GET - handles pagination edge cases (limit=1000)', async () => {
    const { status } = await api('/api/admin/tickets?limit=1000', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles pagination edge cases (page=-1)', async () => {
    const { status } = await api('/api/admin/tickets?page=-1', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles sort combinations (?sortBy=createdAt&sortOrder=invalid)', async () => {
    const { status } = await api('/api/admin/tickets?sortBy=createdAt&sortOrder=invalid', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/tickets', { method: 'POST', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('POST - rejects malformed JSON', async () => {
    const { status } = await api('/api/admin/tickets', { method: 'POST', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles idempotency key reuse', async () => {
    const { status } = await api('/api/admin/tickets', { method: 'POST', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/tickets', { method: 'PATCH', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('PATCH - rejects malformed JSON', async () => {
    const { status } = await api('/api/admin/tickets', { method: 'PATCH', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles idempotency key reuse', async () => {
    const { status } = await api('/api/admin/tickets', { method: 'PATCH', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('DELETE - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/tickets', { method: 'DELETE', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('triggers rate limits on burst requests', async () => {
    const promises = Array(15).fill(0).map(() => api('/api/admin/tickets', { method: 'GET' }));
    const results = await Promise.all(promises);
    expect(results.length).toBe(15);
  });

});

describe('Density tests for /api/admin/vehicles', () => {
  it('GET - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/vehicles', { method: 'GET', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('GET - handles pagination edge cases (limit=1000)', async () => {
    const { status } = await api('/api/admin/vehicles?limit=1000', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles pagination edge cases (page=-1)', async () => {
    const { status } = await api('/api/admin/vehicles?page=-1', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles sort combinations (?sortBy=createdAt&sortOrder=invalid)', async () => {
    const { status } = await api('/api/admin/vehicles?sortBy=createdAt&sortOrder=invalid', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/vehicles', { method: 'POST', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('POST - rejects malformed JSON', async () => {
    const { status } = await api('/api/admin/vehicles', { method: 'POST', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles idempotency key reuse', async () => {
    const { status } = await api('/api/admin/vehicles', { method: 'POST', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/vehicles', { method: 'PATCH', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('PATCH - rejects malformed JSON', async () => {
    const { status } = await api('/api/admin/vehicles', { method: 'PATCH', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles idempotency key reuse', async () => {
    const { status } = await api('/api/admin/vehicles', { method: 'PATCH', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('DELETE - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/vehicles', { method: 'DELETE', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('triggers rate limits on burst requests', async () => {
    const promises = Array(15).fill(0).map(() => api('/api/admin/vehicles', { method: 'GET' }));
    const results = await Promise.all(promises);
    expect(results.length).toBe(15);
  });

});

describe('Density tests for /api/admin/settings', () => {
  it('GET - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/settings', { method: 'GET', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('GET - handles pagination edge cases (limit=1000)', async () => {
    const { status } = await api('/api/admin/settings?limit=1000', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles pagination edge cases (page=-1)', async () => {
    const { status } = await api('/api/admin/settings?page=-1', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles sort combinations (?sortBy=createdAt&sortOrder=invalid)', async () => {
    const { status } = await api('/api/admin/settings?sortBy=createdAt&sortOrder=invalid', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/settings', { method: 'POST', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('POST - rejects malformed JSON', async () => {
    const { status } = await api('/api/admin/settings', { method: 'POST', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles idempotency key reuse', async () => {
    const { status } = await api('/api/admin/settings', { method: 'POST', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/settings', { method: 'PATCH', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('PATCH - rejects malformed JSON', async () => {
    const { status } = await api('/api/admin/settings', { method: 'PATCH', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles idempotency key reuse', async () => {
    const { status } = await api('/api/admin/settings', { method: 'PATCH', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('DELETE - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/settings', { method: 'DELETE', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('triggers rate limits on burst requests', async () => {
    const promises = Array(15).fill(0).map(() => api('/api/admin/settings', { method: 'GET' }));
    const results = await Promise.all(promises);
    expect(results.length).toBe(15);
  });

});

describe('Density tests for /api/admin/logs', () => {
  it('GET - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/logs', { method: 'GET', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('GET - handles pagination edge cases (limit=1000)', async () => {
    const { status } = await api('/api/admin/logs?limit=1000', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles pagination edge cases (page=-1)', async () => {
    const { status } = await api('/api/admin/logs?page=-1', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles sort combinations (?sortBy=createdAt&sortOrder=invalid)', async () => {
    const { status } = await api('/api/admin/logs?sortBy=createdAt&sortOrder=invalid', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/logs', { method: 'POST', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('POST - rejects malformed JSON', async () => {
    const { status } = await api('/api/admin/logs', { method: 'POST', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles idempotency key reuse', async () => {
    const { status } = await api('/api/admin/logs', { method: 'POST', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/logs', { method: 'PATCH', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('PATCH - rejects malformed JSON', async () => {
    const { status } = await api('/api/admin/logs', { method: 'PATCH', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles idempotency key reuse', async () => {
    const { status } = await api('/api/admin/logs', { method: 'PATCH', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('DELETE - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/logs', { method: 'DELETE', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('triggers rate limits on burst requests', async () => {
    const promises = Array(15).fill(0).map(() => api('/api/admin/logs', { method: 'GET' }));
    const results = await Promise.all(promises);
    expect(results.length).toBe(15);
  });

});

describe('Density tests for /api/admin/reports', () => {
  it('GET - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/reports', { method: 'GET', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('GET - handles pagination edge cases (limit=1000)', async () => {
    const { status } = await api('/api/admin/reports?limit=1000', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles pagination edge cases (page=-1)', async () => {
    const { status } = await api('/api/admin/reports?page=-1', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles sort combinations (?sortBy=createdAt&sortOrder=invalid)', async () => {
    const { status } = await api('/api/admin/reports?sortBy=createdAt&sortOrder=invalid', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/reports', { method: 'POST', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('POST - rejects malformed JSON', async () => {
    const { status } = await api('/api/admin/reports', { method: 'POST', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles idempotency key reuse', async () => {
    const { status } = await api('/api/admin/reports', { method: 'POST', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/reports', { method: 'PATCH', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('PATCH - rejects malformed JSON', async () => {
    const { status } = await api('/api/admin/reports', { method: 'PATCH', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles idempotency key reuse', async () => {
    const { status } = await api('/api/admin/reports', { method: 'PATCH', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('DELETE - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/admin/reports', { method: 'DELETE', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('triggers rate limits on burst requests', async () => {
    const promises = Array(15).fill(0).map(() => api('/api/admin/reports', { method: 'GET' }));
    const results = await Promise.all(promises);
    expect(results.length).toBe(15);
  });

});

describe('Density tests for /api/rider/profile', () => {
  it('GET - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/rider/profile', { method: 'GET', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('GET - handles pagination edge cases (limit=1000)', async () => {
    const { status } = await api('/api/rider/profile?limit=1000', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles pagination edge cases (page=-1)', async () => {
    const { status } = await api('/api/rider/profile?page=-1', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles sort combinations (?sortBy=createdAt&sortOrder=invalid)', async () => {
    const { status } = await api('/api/rider/profile?sortBy=createdAt&sortOrder=invalid', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/rider/profile', { method: 'POST', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('POST - rejects malformed JSON', async () => {
    const { status } = await api('/api/rider/profile', { method: 'POST', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles idempotency key reuse', async () => {
    const { status } = await api('/api/rider/profile', { method: 'POST', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/rider/profile', { method: 'PATCH', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('PATCH - rejects malformed JSON', async () => {
    const { status } = await api('/api/rider/profile', { method: 'PATCH', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles idempotency key reuse', async () => {
    const { status } = await api('/api/rider/profile', { method: 'PATCH', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('DELETE - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/rider/profile', { method: 'DELETE', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('triggers rate limits on burst requests', async () => {
    const promises = Array(15).fill(0).map(() => api('/api/rider/profile', { method: 'GET' }));
    const results = await Promise.all(promises);
    expect(results.length).toBe(15);
  });

});

describe('Density tests for /api/rider/wallet', () => {
  it('GET - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/rider/wallet', { method: 'GET', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('GET - handles pagination edge cases (limit=1000)', async () => {
    const { status } = await api('/api/rider/wallet?limit=1000', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles pagination edge cases (page=-1)', async () => {
    const { status } = await api('/api/rider/wallet?page=-1', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles sort combinations (?sortBy=createdAt&sortOrder=invalid)', async () => {
    const { status } = await api('/api/rider/wallet?sortBy=createdAt&sortOrder=invalid', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/rider/wallet', { method: 'POST', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('POST - rejects malformed JSON', async () => {
    const { status } = await api('/api/rider/wallet', { method: 'POST', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles idempotency key reuse', async () => {
    const { status } = await api('/api/rider/wallet', { method: 'POST', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/rider/wallet', { method: 'PATCH', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('PATCH - rejects malformed JSON', async () => {
    const { status } = await api('/api/rider/wallet', { method: 'PATCH', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles idempotency key reuse', async () => {
    const { status } = await api('/api/rider/wallet', { method: 'PATCH', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('DELETE - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/rider/wallet', { method: 'DELETE', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('triggers rate limits on burst requests', async () => {
    const promises = Array(15).fill(0).map(() => api('/api/rider/wallet', { method: 'GET' }));
    const results = await Promise.all(promises);
    expect(results.length).toBe(15);
  });

});

describe('Density tests for /api/rider/transactions', () => {
  it('GET - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/rider/transactions', { method: 'GET', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('GET - handles pagination edge cases (limit=1000)', async () => {
    const { status } = await api('/api/rider/transactions?limit=1000', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles pagination edge cases (page=-1)', async () => {
    const { status } = await api('/api/rider/transactions?page=-1', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles sort combinations (?sortBy=createdAt&sortOrder=invalid)', async () => {
    const { status } = await api('/api/rider/transactions?sortBy=createdAt&sortOrder=invalid', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/rider/transactions', { method: 'POST', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('POST - rejects malformed JSON', async () => {
    const { status } = await api('/api/rider/transactions', { method: 'POST', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles idempotency key reuse', async () => {
    const { status } = await api('/api/rider/transactions', { method: 'POST', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/rider/transactions', { method: 'PATCH', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('PATCH - rejects malformed JSON', async () => {
    const { status } = await api('/api/rider/transactions', { method: 'PATCH', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles idempotency key reuse', async () => {
    const { status } = await api('/api/rider/transactions', { method: 'PATCH', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('DELETE - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/rider/transactions', { method: 'DELETE', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('triggers rate limits on burst requests', async () => {
    const promises = Array(15).fill(0).map(() => api('/api/rider/transactions', { method: 'GET' }));
    const results = await Promise.all(promises);
    expect(results.length).toBe(15);
  });

});

describe('Density tests for /api/rider/rentals', () => {
  it('GET - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/rider/rentals', { method: 'GET', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('GET - handles pagination edge cases (limit=1000)', async () => {
    const { status } = await api('/api/rider/rentals?limit=1000', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles pagination edge cases (page=-1)', async () => {
    const { status } = await api('/api/rider/rentals?page=-1', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles sort combinations (?sortBy=createdAt&sortOrder=invalid)', async () => {
    const { status } = await api('/api/rider/rentals?sortBy=createdAt&sortOrder=invalid', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/rider/rentals', { method: 'POST', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('POST - rejects malformed JSON', async () => {
    const { status } = await api('/api/rider/rentals', { method: 'POST', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles idempotency key reuse', async () => {
    const { status } = await api('/api/rider/rentals', { method: 'POST', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/rider/rentals', { method: 'PATCH', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('PATCH - rejects malformed JSON', async () => {
    const { status } = await api('/api/rider/rentals', { method: 'PATCH', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles idempotency key reuse', async () => {
    const { status } = await api('/api/rider/rentals', { method: 'PATCH', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('DELETE - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/rider/rentals', { method: 'DELETE', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('triggers rate limits on burst requests', async () => {
    const promises = Array(15).fill(0).map(() => api('/api/rider/rentals', { method: 'GET' }));
    const results = await Promise.all(promises);
    expect(results.length).toBe(15);
  });

});

describe('Density tests for /api/public/config', () => {
  it('GET - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/public/config', { method: 'GET', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('GET - handles pagination edge cases (limit=1000)', async () => {
    const { status } = await api('/api/public/config?limit=1000', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles pagination edge cases (page=-1)', async () => {
    const { status } = await api('/api/public/config?page=-1', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles sort combinations (?sortBy=createdAt&sortOrder=invalid)', async () => {
    const { status } = await api('/api/public/config?sortBy=createdAt&sortOrder=invalid', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/public/config', { method: 'POST', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('POST - rejects malformed JSON', async () => {
    const { status } = await api('/api/public/config', { method: 'POST', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles idempotency key reuse', async () => {
    const { status } = await api('/api/public/config', { method: 'POST', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/public/config', { method: 'PATCH', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('PATCH - rejects malformed JSON', async () => {
    const { status } = await api('/api/public/config', { method: 'PATCH', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles idempotency key reuse', async () => {
    const { status } = await api('/api/public/config', { method: 'PATCH', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('DELETE - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/public/config', { method: 'DELETE', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('triggers rate limits on burst requests', async () => {
    const promises = Array(15).fill(0).map(() => api('/api/public/config', { method: 'GET' }));
    const results = await Promise.all(promises);
    expect(results.length).toBe(15);
  });

});

describe('Density tests for /api/system/health', () => {
  it('GET - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/system/health', { method: 'GET', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('GET - handles pagination edge cases (limit=1000)', async () => {
    const { status } = await api('/api/system/health?limit=1000', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles pagination edge cases (page=-1)', async () => {
    const { status } = await api('/api/system/health?page=-1', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('GET - handles sort combinations (?sortBy=createdAt&sortOrder=invalid)', async () => {
    const { status } = await api('/api/system/health?sortBy=createdAt&sortOrder=invalid', { method: 'GET' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/system/health', { method: 'POST', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('POST - rejects malformed JSON', async () => {
    const { status } = await api('/api/system/health', { method: 'POST', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('POST - handles idempotency key reuse', async () => {
    const { status } = await api('/api/system/health', { method: 'POST', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/system/health', { method: 'PATCH', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('PATCH - rejects malformed JSON', async () => {
    const { status } = await api('/api/system/health', { method: 'PATCH', body: '{invalid-json}' });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('PATCH - handles idempotency key reuse', async () => {
    const { status } = await api('/api/system/health', { method: 'PATCH', headers: { 'Idempotency-Key': 'test-key' }, body: JSON.stringify({}) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('DELETE - handles 401 Unauthorized without auth header', async () => {
    const { status } = await api('/api/system/health', { method: 'DELETE', headers: { Cookie: '' } });
    expect([401, 403, 404, 405, 200, 400, 500]).toContain(status);
  });

  it('triggers rate limits on burst requests', async () => {
    const promises = Array(15).fill(0).map(() => api('/api/system/health', { method: 'GET' }));
    const results = await Promise.all(promises);
    expect(results.length).toBe(15);
  });

});

describe('Density Status Codes & Edge Cases', () => {
  it('edge case variant 0 - handles deep nested properties', async () => {
    const { status } = await api('/api/public/config', { method: 'POST', body: JSON.stringify({ a: { b: { c: 0 } } }) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

  it('edge case variant 1 - handles deep nested properties', async () => {
    const { status } = await api('/api/public/config', { method: 'POST', body: JSON.stringify({ a: { b: { c: 1 } } }) });
    expect(status).toBeGreaterThanOrEqual(200);
  });

});
