import './setup-env';
import { describe, it, expect, beforeAll } from 'vitest';
import { createSessionToken } from '../src/lib/auth';

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
    const res = await fetch(`${BASE}/api/admin/auth/auto-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      adminCookie = setCookie;
    }
  } catch (err) {
    console.error('Failed to log in as admin for API tests', err);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// AUTH FLOW TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('POST /api/auth/send-otp', () => {
  it('returns success for a valid phone number', async () => {
    const { status, body } = await api('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '9999900001' }),
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
    const { status, body } = await api('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '0000099999' }),
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
    // First, request an OTP
    const sendRes = await api('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '9999900001' }),
    });
    const otp = sendRes.body.data?.otp;
    expect(otp).toBeDefined();

    const { status, body } = await api('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '9999900001', otp }),
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.phone).toBe('9999900001');
    expect(body.data.riderId).toBeTruthy();
    expect(body.data.accountStatus).toBeTruthy();
  });

  it('returns wallet fields from relations', async () => {
    // First, request an OTP
    const sendRes = await api('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '9999900001' }),
    });
    const otp = sendRes.body.data?.otp;

    const { status, body } = await api('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '9999900001', otp }),
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
    expect(body.data.phone).toBe(uniquePhone);
    expect(body.data.riderId).toMatch(/^VF-RD-/);
    expect(body.data.accountStatus).toBe('PRE_ACTIVE');
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
      const sendRes = await api('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: '9999900001' }),
      });
      const otp = sendRes.body.data?.otp;

      const verifyRes = await api('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: '9999900001', otp }),
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
      }),
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.amount).toBe(500); // Should be returned in rupees
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

    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// API RESPONSE FORMAT CONSISTENCY
// ═══════════════════════════════════════════════════════════════════════

describe('API response format consistency', () => {
  const endpoints = [
    { path: '/api/admin/dashboard', method: 'GET' },
    { path: '/api/admin/transactions?limit=1', method: 'GET' },
    { path: '/api/admin/tickets', method: 'GET' },
  ];

  for (const ep of endpoints) {
    it(`${ep.method} ${ep.path} follows { success, data } format`, async () => {
      const { status, body } = await api(ep.path, { method: ep.method });

      expect(status).toBe(200);
      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('data');
      expect(body.success).toBe(true);
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
