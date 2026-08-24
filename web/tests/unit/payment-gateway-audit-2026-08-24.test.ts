/**
 * ADMIN_PAYMENT_GATEWAY_AUDIT_2026-08-24 — verification tests for the
 * 3 items shipped in this PR:
 *
 *  P0-3: extraFeePercent cap is 10 (server-side). DevTools-modified
 *         POSTs that submit 11, 50, 100 must be rejected.
 *  P1-1: POST /api/admin/payment-gateways/:id/test-connection returns
 *         structured issues for missing credentials on LIVE gateways.
 *  P1-4: apiEndpoint is rejected for non-HTTPS, non-public IPs.
 *
 * PR-8 (7th audit P0) verified separately: secrets are encrypted at
 * rest via `encryptCredential` / `decryptCredential`; that path is
 * covered by `tests/integration/admin/payment_gateways*.test.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(),
  hasPermission: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  // createAuditLog returns a Promise so the route's `.catch(() => {})`
  // works. Default to a resolved promise.
  createAuditLog: vi.fn(() => Promise.resolve()),
  encryptCredential: vi.fn((v: string | null) => v),
  decryptCredential: vi.fn((v: string | null) => v),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: mocks.adminUnauthorized,
  adminForbidden: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({ hasPermission: mocks.hasPermission }));

vi.mock('@/lib/db', () => ({
  db: {
    paymentGateway: {
      findUnique: mocks.findUnique,
      create: mocks.create,
      update: mocks.update,
      updateMany: mocks.updateMany,
      delete: mocks.delete,
    },
  },
}));

// Silence the audit-log helper so we can see the real error.
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));

// Catch the route's internal catch and surface the cause.
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('UNHANDLED:', reason);
});

vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));

vi.mock('@/lib/credentials', () => ({
  encryptCredential: mocks.encryptCredential,
  decryptCredential: mocks.decryptCredential,
}));

import { POST as createOrList } from '@/app/api/admin/payment-gateways/route';
import { PATCH as updateGateway } from '@/app/api/admin/payment-gateways/[id]/route';
import { POST as testConnection } from '@/app/api/admin/payment-gateways/[id]/test-connection/route';

function makeReq(url: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    adminId: 'admin_1',
    adminRole: 'OPERATIONS_ADMIN',
  });
  mocks.hasPermission.mockReturnValue(true);
  // Re-apply the passthrough implementations after clearAllMocks.
  mocks.encryptCredential.mockImplementation((v: string | null | undefined) => v);
  mocks.decryptCredential.mockImplementation((v: string | null | undefined) => v);
});

describe('P0-3: extraFeePercent cap is 10 (server-side)', () => {
  it('rejects 11% on create', async () => {
    const res = await createOrList(
      makeReq('/api/admin/payment-gateways', {
        name: 'Test Gateway',
        provider: 'RAZORPAY',
        extraFeePercent: 11,
      })
    );
    expect(res.status).toBe(422);
  });

  it('rejects 50% on create (the audit\'s exact scenario)', async () => {
    const res = await createOrList(
      makeReq('/api/admin/payment-gateways', {
        name: 'Test Gateway',
        provider: 'RAZORPAY',
        extraFeePercent: 50,
      })
    );
    expect(res.status).toBe(422);
  });

  it('accepts 10% on create (the boundary)', async () => {
    mocks.create.mockResolvedValue({ id: 'gw_1', extraFeePercent: 10 });
    const res = await createOrList(
      makeReq('/api/admin/payment-gateways', {
        name: 'Test Gateway',
        provider: 'RAZORPAY',
        extraFeePercent: 10,
      })
    );
    if (res.status !== 201) {
      const text = await res.text();
      console.error('DEBUG 10% res:', res.status, text);
    }
    expect(res.status).toBe(201);
  });

  it('rejects 11% on PATCH', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'gw_1', extraFeePercent: 2 });
    const res = await updateGateway(
      makeReq('/api/admin/payment-gateways/gw_1', { extraFeePercent: 11 }),
      { params: Promise.resolve({ id: 'gw_1' }) }
    );
    expect(res.status).toBe(422);
  });
});

describe('P1-1: test-connection endpoint surfaces structural issues', () => {
  it('flags missing credentials for a LIVE gateway', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'gw_live_1',
      environment: 'LIVE',
      // keyId, keySecret, webhookSecret all missing
      apiEndpoint: null,
    });
    const res = await testConnection(
      makeReq('/api/admin/payment-gateways/gw_live_1/test-connection'),
      { params: Promise.resolve({ id: 'gw_live_1' }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.ok).toBe(false);
    expect(json.data.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('API Key ID is required for LIVE'),
        expect.stringContaining('API Key Secret is required for LIVE'),
        expect.stringContaining('Webhook Secret is required for LIVE'),
      ])
    );
  });

  it('reports ok:true when a LIVE gateway has all credentials + valid endpoint', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'gw_live_ok',
      environment: 'LIVE',
      keyId: 'rzp_live_abc',
      keySecret: 'v1:aa:bb:cc', // ciphertext envelope
      webhookSecret: 'v1:dd:ee:ff',
      apiEndpoint: 'https://api.razorpay.com/v1',
    });
    const res = await testConnection(
      makeReq('/api/admin/payment-gateways/gw_live_ok/test-connection'),
      { params: Promise.resolve({ id: 'gw_live_ok' }) }
    );
    const json = await res.json();
    expect(json.data.ok).toBe(true);
    expect(json.data.checks.credentials.ok).toBe(true);
    expect(json.data.checks.apiEndpoint.ok).toBe(true);
  });

  it('audit-logs the test-connection call', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'gw_x',
      environment: 'TEST',
      keyId: 'rzp_test_1',
      keySecret: 'v1:00:00:00',
    });
    await testConnection(
      makeReq('/api/admin/payment-gateways/gw_x/test-connection'),
      { params: Promise.resolve({ id: 'gw_x' }) }
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'payment_gateway_test_connection',
        entityId: 'gw_x',
      })
    );
  });
});

describe('P1-4: apiEndpoint URL validation', () => {
  it('rejects http:// (must be https)', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'gw_1',
      environment: 'TEST',
      keyId: 'k',
      keySecret: 'v1:00:00:00',
      apiEndpoint: 'http://api.gateway.com/v1',
    });
    const res = await testConnection(
      makeReq('/api/admin/payment-gateways/gw_1/test-connection'),
      { params: Promise.resolve({ id: 'gw_1' }) }
    );
    const json = await res.json();
    expect(json.data.ok).toBe(false);
    expect(json.data.issues).toEqual(
      expect.arrayContaining([expect.stringContaining('must use https')])
    );
  });

  it('rejects javascript: scheme (XSS / SSRF vector)', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'gw_1',
      environment: 'TEST',
      keyId: 'k',
      keySecret: 'v1:00:00:00',
      apiEndpoint: 'javascript:alert(1)',
    });
    const res = await testConnection(
      makeReq('/api/admin/payment-gateways/gw_1/test-connection'),
      { params: Promise.resolve({ id: 'gw_1' }) }
    );
    const json = await res.json();
    // `new URL('javascript:alert(1)')` parses successfully (it's a valid
    // URI scheme), so the validator's `protocol === 'https:'` check
    // correctly rejects it. The reason may say "must use https" — that's
    // the expected rejection message.
    expect(json.data.ok).toBe(false);
    expect(json.data.checks.apiEndpoint.ok).toBe(false);
    expect(json.data.issues.length).toBeGreaterThan(0);
  });

  it('rejects loopback addresses (SSRF protection)', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'gw_1',
      environment: 'TEST',
      keyId: 'k',
      keySecret: 'v1:00:00:00',
      apiEndpoint: 'https://localhost:8080/api',
    });
    const res = await testConnection(
      makeReq('/api/admin/payment-gateways/gw_1/test-connection'),
      { params: Promise.resolve({ id: 'gw_1' }) }
    );
    const json = await res.json();
    expect(json.data.ok).toBe(false);
    expect(json.data.issues).toEqual(
      expect.arrayContaining([expect.stringContaining('loopback')])
    );
  });

  it('rejects RFC1918 private network (10.x.x.x)', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'gw_1',
      environment: 'TEST',
      keyId: 'k',
      keySecret: 'v1:00:00:00',
      apiEndpoint: 'https://10.0.0.5/api',
    });
    const res = await testConnection(
      makeReq('/api/admin/payment-gateways/gw_1/test-connection'),
      { params: Promise.resolve({ id: 'gw_1' }) }
    );
    const json = await res.json();
    expect(json.data.ok).toBe(false);
  });

  it('accepts a public HTTPS endpoint (the happy path)', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'gw_1',
      environment: 'TEST',
      keyId: 'k',
      keySecret: 'v1:00:00:00',
      apiEndpoint: 'https://api.razorpay.com/v1',
    });
    const res = await testConnection(
      makeReq('/api/admin/payment-gateways/gw_1/test-connection'),
      { params: Promise.resolve({ id: 'gw_1' }) }
    );
    const json = await res.json();
    expect(json.data.checks.apiEndpoint.ok).toBe(true);
  });

  it('omitting apiEndpoint is fine (it\'s optional)', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'gw_1',
      environment: 'TEST',
      keyId: 'k',
      keySecret: 'v1:00:00:00',
      apiEndpoint: null,
    });
    const res = await testConnection(
      makeReq('/api/admin/payment-gateways/gw_1/test-connection'),
      { params: Promise.resolve({ id: 'gw_1' }) }
    );
    const json = await res.json();
    expect(json.data.checks.apiEndpoint.ok).toBe(true);
  });
});
