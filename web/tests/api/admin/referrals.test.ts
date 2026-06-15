import { describe, it, expect } from 'vitest';

const BASE = 'http://localhost:3000';

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers as any) },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

describe('GET /api/admin/referrals', () => {
  it('returns paginated referrals with correct data shape', async () => {
    const { status, body } = await api('/api/admin/referrals?page=1&limit=5');

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    const { referrals, total, page, limit, hasMore } = body.data;
    expect(Array.isArray(referrals)).toBe(true);
    expect(typeof total).toBe('number');
    expect(typeof page).toBe('number');
    expect(typeof limit).toBe('number');
    expect(typeof hasMore).toBe('boolean');

    if (referrals.length > 0) {
      const referral = referrals[0];
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
    const { body: b1 } = await api('/api/admin/referrals?page=1&limit=2');
    const { body: b2 } = await api('/api/admin/referrals?page=2&limit=2');

    expect(b1.data.page).toBe(1);
    expect(b1.data.limit).toBe(2);
    expect(b2.data.page).toBe(2);
    expect(b2.data.limit).toBe(2);
  });

  it('returns consistent data structure for empty results', async () => {
    // Large page number should return empty but consistent
    const { status, body } = await api('/api/admin/referrals?page=9999');

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.referrals)).toBe(true);
    expect(body.data.referrals.length).toBe(0);
  });
});
