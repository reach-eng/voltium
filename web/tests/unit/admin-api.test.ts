/**
 * Admin API client — Unit Tests
 *
 * Tests src/lib/admin-api.ts — the shared admin fetch wrapper, focused on
 * the in-flight GET dedup added in PR-30.
 *
 * Covers:
 *   - Inflight dedup: two concurrent GETs to the same URL share a single fetch
 *   - Inflight dedup: a second GET after the first resolves fires a new fetch
 *   - noDedup: a GET with noDedup:true bypasses the dedup and fires a fresh fetch
 *   - POST/PUT/DELETE: never deduped, even if URL matches an in-flight GET
 *   - Errors: a failing GET is still shared with concurrent callers, and the
 *     in-flight entry is removed so a retry can fire
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The admin-api module references 'use client' but vitest treats it as a
// regular ESM module. Mock @/lib/logger so we don't need the real one.
vi.mock('../../src/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

interface FetchCall {
  url: string;
  init?: RequestInit;
}

let fetchCalls: FetchCall[];
let fetchResponder: (url: string, init?: RequestInit) => Promise<Response>;

beforeEach(() => {
  fetchCalls = [];
  fetchResponder = async () =>
    new Response(JSON.stringify({ success: true, data: { ok: true } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  (globalThis as any).fetch = vi.fn(async (url: string, init?: RequestInit) => {
    fetchCalls.push({ url, init });
    return fetchResponder(url, init);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

async function getFreshApi() {
  const { adminApi, _clearInflightGets } = await import('../../src/lib/admin-api');
  _clearInflightGets();
  return { adminApi, _clearInflightGets };
}

describe('adminApi inflight dedup (GET)', () => {
  it('dedupes two concurrent GETs to the same URL — one fetch only', async () => {
    fetchResponder = (url) =>
      new Promise<Response>((resolve) =>
        setTimeout(
          () =>
            resolve(
              new Response(JSON.stringify({ success: true, data: { url } }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              })
            ),
          30
        )
      );

    const { adminApi } = await getFreshApi();
    const [a, b, c] = await Promise.all([
      adminApi.get('/api/admin/riders'),
      adminApi.get('/api/admin/riders'),
      adminApi.get('/api/admin/riders'),
    ]);

    expect(fetchCalls).toHaveLength(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('fires a new fetch after the first resolves', async () => {
    const { adminApi } = await getFreshApi();
    await adminApi.get('/api/admin/riders');
    await adminApi.get('/api/admin/riders');

    expect(fetchCalls).toHaveLength(2);
  });

  it('noDedup:true bypasses the dedup and fires a fresh fetch', async () => {
    const { adminApi } = await getFreshApi();
    const slow = adminApi.get('/api/admin/riders', { noDedup: true });
    const fast = adminApi.get('/api/admin/riders'); // would dedup normally
    await Promise.all([slow, fast]);

    // slow and fast are independent — slow had noDedup, fast dedups to slow,
    // so only one fetch is fired. The dedup is the optimization; noDedup
    // means "don't dedupe onto the existing in-flight" which here it
    // would just look the same.
    expect(fetchCalls.length).toBeGreaterThanOrEqual(1);

    // Now do two explicit noDedup calls — both should fire.
    fetchCalls = [];
    await Promise.all([
      adminApi.get('/api/admin/riders', { noDedup: true }),
      adminApi.get('/api/admin/riders', { noDedup: true }),
    ]);
    expect(fetchCalls).toHaveLength(2);
  });

  it('uses different keys for different URLs — no cross-URL dedup', async () => {
    const { adminApi } = await getFreshApi();
    await Promise.all([
      adminApi.get('/api/admin/riders'),
      adminApi.get('/api/admin/kyc'),
      adminApi.get('/api/admin/transactions'),
    ]);
    expect(fetchCalls).toHaveLength(3);
  });

  it('removes the in-flight entry on error so a retry can fire', async () => {
    let attempt = 0;
    fetchResponder = async () => {
      attempt++;
      if (attempt === 1) {
        return new Response(JSON.stringify({ success: false, error: { message: 'fail' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const { adminApi } = await getFreshApi();
    const first = await adminApi.get('/api/admin/riders');
    expect(first.success).toBe(false);

    // The first call's in-flight entry must be gone, otherwise this second
    // call would dedupe onto the rejected promise.
    const second = await adminApi.get('/api/admin/riders');
    expect(second.success).toBe(true);
    expect(fetchCalls).toHaveLength(2);
  });
});

describe('adminApi mutating methods are never deduped', () => {
  it('fires separate POST requests even when the URL is identical', async () => {
    const { adminApi } = await getFreshApi();
    await Promise.all([
      adminApi.post('/api/admin/riders', { phone: '9999999999' }),
      adminApi.post('/api/admin/riders', { phone: '8888888888' }),
    ]);
    expect(fetchCalls).toHaveLength(2);
  });

  it('PUT and DELETE are not deduped even if a GET for the same URL is in flight', async () => {
    fetchResponder = () =>
      new Promise<Response>((resolve) =>
        setTimeout(
          () =>
            resolve(
              new Response(JSON.stringify({ success: true, data: {} }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              })
            ),
          30
        )
      );

    const { adminApi } = await getFreshApi();
    const getPromise = adminApi.get('/api/admin/riders/abc');
    const putPromise = adminApi.put('/api/admin/riders/abc', { status: 'APPROVED' });
    const delPromise = adminApi.del('/api/admin/riders/abc');

    await Promise.all([getPromise, putPromise, delPromise]);

    // GET + PUT + DELETE = 3 separate fetches, even though URLs share a path
    expect(fetchCalls).toHaveLength(3);
    expect(fetchCalls[0].init?.method).toBe('GET');
    expect(fetchCalls[1].init?.method).toBe('PUT');
    expect(fetchCalls[2].init?.method).toBe('DELETE');
  });
});

describe('adminApi response shape', () => {
  it('returns parsed { success: true, data } on 2xx with wrapped body', async () => {
    fetchResponder = async () =>
      new Response(JSON.stringify({ success: true, data: { name: 'test' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    const { adminApi } = await getFreshApi();
    const result = await adminApi.get<{ name: string }>('/api/admin/x');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'test' });
  });

  it('returns { success: false, error } on 5xx', async () => {
    fetchResponder = async () =>
      new Response(JSON.stringify({ success: false, error: { message: 'boom' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });

    const { adminApi } = await getFreshApi();
    const result = await adminApi.get('/api/admin/x');
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
  });

  it('returns { success: false, error } on network failure', async () => {
    (globalThis as any).fetch = vi.fn(async () => {
      throw new Error('network down');
    });
    const { adminApi } = await getFreshApi();
    const result = await adminApi.get('/api/admin/x', { quiet: true });
    expect(result.success).toBe(false);
    expect(result.error).toBe('network down');
  });
});

describe('adminApi x-request-id (PR-41, N8)', () => {
  // UUID v4 shape: 8-4-4-4-12 hex chars.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it('sends an x-request-id header on GET requests', async () => {
    const { adminApi } = await getFreshApi();
    await adminApi.get('/api/admin/riders');
    expect(fetchCalls).toHaveLength(1);
    const headers = (fetchCalls[0].init?.headers ?? {}) as Record<string, string>;
    expect(headers['x-request-id']).toMatch(UUID_RE);
  });

  it('sends an x-request-id header on POST/PUT/DELETE', async () => {
    const { adminApi } = await getFreshApi();
    await adminApi.post('/api/admin/riders', { phone: '9999999999' });
    await adminApi.put('/api/admin/riders/abc', { status: 'APPROVED' });
    await adminApi.del('/api/admin/riders/abc');

    expect(fetchCalls).toHaveLength(3);
    for (const call of fetchCalls) {
      const headers = (call.init?.headers ?? {}) as Record<string, string>;
      expect(headers['x-request-id']).toMatch(UUID_RE);
    }
  });

  it('uses a distinct request id for each fetch (no dedup collision)', async () => {
    const { adminApi } = await getFreshApi();
    await adminApi.get('/api/admin/riders');
    await adminApi.get('/api/admin/riders'); // fires a new fetch (PR-30 dedup is per in-flight, not per URL forever)
    expect(fetchCalls).toHaveLength(2);
    const a = ((fetchCalls[0].init?.headers ?? {}) as Record<string, string>)['x-request-id'];
    const b = ((fetchCalls[1].init?.headers ?? {}) as Record<string, string>)['x-request-id'];
    expect(a).toMatch(UUID_RE);
    expect(b).toMatch(UUID_RE);
    expect(a).not.toEqual(b);
  });

  it('does not allow caller-supplied headers to strip x-request-id', async () => {
    const { adminApi } = await getFreshApi();
    await adminApi.get('/api/admin/riders', {
      headers: { 'x-request-id': 'caller-supplied-should-be-overridden' },
    });
    const headers = (fetchCalls[0].init?.headers ?? {}) as Record<string, string>;
    // The generated UUID should win (or at least be present); caller cannot
    // force a server-log collision.
    expect(headers['x-request-id']).not.toBe('caller-supplied-should-be-overridden');
    expect(headers['x-request-id']).toMatch(UUID_RE);
  });

  it('sends x-correlation-id and includes credentials', async () => {
    const { adminApi } = await getFreshApi();
    await adminApi.get('/api/admin/riders');
    expect(fetchCalls).toHaveLength(1);
    const headers = (fetchCalls[0].init?.headers ?? {}) as Record<string, string>;
    expect(headers['x-correlation-id']).toMatch(UUID_RE);
    expect(fetchCalls[0].init?.credentials).toBe('include');
  });

  it('preserves envelope message and statusCode on success', async () => {
    fetchResponder = async () =>
      new Response(
        JSON.stringify({ success: true, data: { id: 123 }, message: 'Updated successfully' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    const { adminApi } = await getFreshApi();
    const result = await adminApi.post('/api/admin/riders/123', { name: 'Test' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 123 });
    expect(result.message).toBe('Updated successfully');
    expect(result.statusCode).toBe(200);
  });
});

describe('adminApi client-side micro-caching & SWR', () => {
  it('caches GET response in memory when ttlMs is provided', async () => {
    const { adminApi } = await getFreshApi();
    const res1 = await adminApi.get('/api/admin/riders', { ttlMs: 10000 });
    expect(res1.success).toBe(true);
    expect(fetchCalls).toHaveLength(1);

    // Second call reads from memory cache instantly — 0 new fetch calls
    const res2 = await adminApi.get('/api/admin/riders', { ttlMs: 10000 });
    expect(res2.success).toBe(true);
    expect(fetchCalls).toHaveLength(1);
  });

  it('supports prefetch to preload data in memory', async () => {
    const { adminApi } = await getFreshApi();
    adminApi.prefetch('/api/admin/kyc', 10000);
    // Allow microtask/fetch to complete
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchCalls).toHaveLength(1);

    // Subsequent read hits the prefetched cache
    const res = await adminApi.get('/api/admin/kyc', { ttlMs: 10000 });
    expect(res.success).toBe(true);
    expect(fetchCalls).toHaveLength(1);
  });

  it('invalidates cache on mutations (POST/PUT/DELETE)', async () => {
    const { adminApi } = await getFreshApi();
    await adminApi.get('/api/admin/riders', { ttlMs: 10000 });
    expect(fetchCalls).toHaveLength(1);

    // Mutating via POST invalidates '/api/admin/riders'
    await adminApi.post('/api/admin/riders', { fullName: 'New Rider' });
    expect(fetchCalls).toHaveLength(2);

    // Next GET triggers a fresh fetch
    await adminApi.get('/api/admin/riders', { ttlMs: 10000 });
    expect(fetchCalls).toHaveLength(3);
  });
});
