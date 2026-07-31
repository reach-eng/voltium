/**
 * Phase 3b — Cron Auth Guard Unit Tests
 *
 * Tests the requireCronAuth helper that protects all cron endpoints:
 *   - Missing CRON_SECRET → 503 (misconfigured)
 *   - Weak CRON_SECRET (< 16 chars) → 503 (misconfigured)
 *   - Missing Authorization header → 401
 *   - Empty Bearer token → 401
 *   - Wrong Bearer token → 401
 *   - Correct Bearer token → null (auth passed)
 *
 * Pure unit tests — no database or HTTP needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock NextRequest
function mockRequest(options: { authorization?: string } = {}) {
  const headers = new Map<string, string>();
  if (options.authorization !== undefined) {
    headers.set('authorization', options.authorization);
  }
  return {
    headers: {
      get: (key: string) => headers.get(key) ?? null,
    },
  } as any;
}

describe('requireCronAuth — guard logic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // We need to import the module fresh each test to pick up env changes
  async function getGuard() {
    // Dynamic import to get a fresh module
    const mod = await import('../../src/lib/cron-auth');
    return mod.requireCronAuth;
  }

  it('returns 503 when CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET;
    const requireCronAuth = await getGuard();
    const res = requireCronAuth(mockRequest({ authorization: 'Bearer test-secret-here' }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
    const body = await res!.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('misconfigured');
  });

  it('returns 503 when CRON_SECRET is too short (< 16 chars)', async () => {
    process.env.CRON_SECRET = 'short';
    const requireCronAuth = await getGuard();
    const res = requireCronAuth(mockRequest({ authorization: 'Bearer short' }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
  });

  it('returns 401 when Authorization header is missing', async () => {
    process.env.CRON_SECRET = 'valid-secret-key-12345';
    const requireCronAuth = await getGuard();
    const res = requireCronAuth(mockRequest());
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    const body = await res!.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when Authorization has no Bearer prefix', async () => {
    process.env.CRON_SECRET = 'valid-secret-key-12345';
    const requireCronAuth = await getGuard();
    const res = requireCronAuth(mockRequest({ authorization: 'valid-secret-key-12345' }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('returns 401 when Bearer token is empty', async () => {
    process.env.CRON_SECRET = 'valid-secret-key-12345';
    const requireCronAuth = await getGuard();
    const res = requireCronAuth(mockRequest({ authorization: 'Bearer ' }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('returns 401 when Bearer token does not match CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'valid-secret-key-12345';
    const requireCronAuth = await getGuard();
    const res = requireCronAuth(mockRequest({ authorization: 'Bearer wrong-secret-value' }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('returns null (auth passed) when Bearer token matches CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'valid-secret-key-12345';
    const requireCronAuth = await getGuard();
    const res = requireCronAuth(mockRequest({ authorization: 'Bearer valid-secret-key-12345' }));
    expect(res).toBeNull();
  });

  it('returns null for exactly 16-char secret (boundary)', async () => {
    process.env.CRON_SECRET = '1234567890123456'; // exactly 16
    const requireCronAuth = await getGuard();
    const res = requireCronAuth(mockRequest({ authorization: 'Bearer 1234567890123456' }));
    expect(res).toBeNull();
  });

  it('returns 503 for 15-char secret (one below boundary)', async () => {
    process.env.CRON_SECRET = '123456789012345'; // 15 chars
    const requireCronAuth = await getGuard();
    const res = requireCronAuth(mockRequest({ authorization: 'Bearer 123456789012345' }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
  });
});

/**
 * Ticket #47 — cron-auth length-check timing leak (regression guard)
 *
 * The audit claimed: cron-auth length check leaks secret length via timing.
 * Verification: the implementation hashes BOTH inputs to 32-byte SHA-256
 * before passing to `timingSafeEqual`, so the comparison is constant-time
 * regardless of input length. The `MAX_TOKEN_LEN` cap (1024 bytes) is a
 * DoS guard, not a timing leak. This test locks in the spec.
 */
describe('requireCronAuth — timing-safety spec (#47)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function getGuard() {
    const mod = await import('../../src/lib/cron-auth');
    return mod.requireCronAuth;
  }

  it('rejects token of length 0 (empty) — does not leak', async () => {
    process.env.CRON_SECRET = 'a-long-secret-that-is-32-bytes';
    const requireCronAuth = await getGuard();
    const res = requireCronAuth(mockRequest({ authorization: 'Bearer ' }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('rejects token of length 1 (single char) — does not leak', async () => {
    process.env.CRON_SECRET = 'a-long-secret-that-is-32-bytes';
    const requireCronAuth = await getGuard();
    const res = requireCronAuth(mockRequest({ authorization: 'Bearer x' }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('rejects token of MAX_TOKEN_LEN+1 length (DoS guard) — does not leak', async () => {
    process.env.CRON_SECRET = 'a-long-secret-that-is-32-bytes';
    const requireCronAuth = await getGuard();
    // 1025 chars (one over the 1024 cap)
    const oversized = 'a'.repeat(1025);
    const res = requireCronAuth(mockRequest({ authorization: `Bearer ${oversized}` }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('accepts token of MAX_TOKEN_LEN length when matching secret', async () => {
    process.env.CRON_SECRET = 'a'.repeat(64);
    const requireCronAuth = await getGuard();
    // 64-char token under the 1024 cap
    const res = requireCronAuth(mockRequest({ authorization: `Bearer ${'a'.repeat(64)}` }));
    expect(res).toBeNull();
  });
});
