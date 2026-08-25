import { describe, it, expect, beforeAll } from 'vitest';
import { adminLogin } from '../../integration/helpers';

const BASE = 'http://localhost:8081';

async function api(path: string, options: RequestInit = {}, cookie?: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(options.headers as any),
    },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

describe('GET /api/admin/referrals', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
  });

  it('returns paginated referrals with correct data shape', async () => {
    const { status, body } = await api('/api/admin/referrals?page=1&limit=5', {}, adminCookie);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    // The route returns `{ records, pagination }` or `{ referrals, total, page, limit, hasMore }`
    // depending on the implementation revision. Accept either shape.
    const list = Array.isArray(body.data.referrals)
      ? body.data.referrals
      : body.data.records;
    expect(Array.isArray(list)).toBe(true);

    if (list.length > 0) {
      const referral = list[0];
      expect(referral).toHaveProperty('refereeId');
      expect(referral).toHaveProperty('refereeName');
      expect(referral).toHaveProperty('refereePhone');
      expect(referral).toHaveProperty('refereeState');
      expect(referral).toHaveProperty('referredAt');
      expect(referral).toHaveProperty('referrerName');
      expect(referral).toHaveProperty('referrerCode');
    }
  });

  it('handles pagination correctly', async () => {
    const { body: b1 } = await api('/api/admin/referrals?page=1&limit=2', {}, adminCookie);
    const { body: b2 } = await api('/api/admin/referrals?page=2&limit=2', {}, adminCookie);

    // The data wrapper may be flat (page, limit) or nested (pagination.page).
    const p1 = b1.data.page ?? b1.data.pagination?.page;
    const l1 = b1.data.limit ?? b1.data.pagination?.limit;
    const p2 = b2.data.page ?? b2.data.pagination?.page;
    const l2 = b2.data.limit ?? b2.data.pagination?.limit;
    expect(p1).toBe(1);
    expect(l1).toBe(2);
    expect(p2).toBe(2);
    expect(l2).toBe(2);
  });

  it('returns consistent data structure for empty results', async () => {
    // Large page number should return empty but consistent
    const { status, body } = await api('/api/admin/referrals?page=9999', {}, adminCookie);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const list = Array.isArray(body.data.referrals)
      ? body.data.referrals
      : body.data.records;
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(0);
  });
});
