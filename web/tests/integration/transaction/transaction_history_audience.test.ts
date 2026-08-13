/**
 * H6-2026-08-13: contract test for /api/transaction/history audience filter.
 *
 * Verifies the rider-facing endpoint defaults to USER-audience rows
 * (top-ups + deposits) and that ?audience=ALL / SYSTEM / garbage all
 * behave per the contract.
 *
 * Each test passes a unique `x-idempotency-key` header so the 5-min
 * wallet bucket doesn't collide across tests in the same dev DB.
 * Requires: dev server running on $TEST_BASE_URL (default localhost:8081).
 */

import { describe, it, expect } from 'vitest';
import { api, generateRandomPhone, riderLogin } from '../helpers';

function uniqueKey(label: string): string {
  return `h6-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('GET /api/transaction/history — H6 audience filter', () => {
  it('default filter (no audience param) returns USER-audience rows', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    // Submit one top-up. Unique idempotency key so it doesn't collide
    // with any other test in the same 5-min bucket.
    // NOTE: the topup endpoint always stores purpose=SECURITY_DEPOSIT
    // regardless of what the client sends (the route handler runs
    // requestTopup which normalizes). Both TOP_UP and SECURITY_DEPOSIT
    // are USER-audience, so the test still verifies the audience filter.
    const topupRes = await api('/api/transaction/topup', {
      method: 'POST',
      token,
      headers: { 'x-idempotency-key': uniqueKey('default-topup') },
      json: {
        amount: 500,
        purpose: 'TOP_UP',
        method: 'UPI',
        upiRef: `H6-DEFAULT-${Date.now()}`,
      },
    });
    expect(topupRes.status).toBe(200);
    expect(topupRes.body.success).toBe(true);

    // Default history → the top-up (stored as SECURITY_DEPOSIT) should
    // be present with audience=USER.
    const histRes = await api('/api/transaction/history?limit=50', { token });
    expect(histRes.status).toBe(200);
    expect(histRes.body.success).toBe(true);
    const txns = histRes.body.data.transactions as Array<{ purpose: string; audience?: string }>;
    expect(txns.length).toBeGreaterThanOrEqual(1);
    // Every returned row should be USER (or have no audience field, which
    // means it predates the H6 migration's column add).
    for (const t of txns) {
      if (t.audience !== undefined) {
        expect(t.audience).toBe('USER');
      }
    }
    // The top-up we just created should be there.
    expect(txns.some((t) => t.purpose === 'SECURITY_DEPOSIT' || t.purpose === 'TOP_UP')).toBe(true);
  });

  it('?audience=ALL returns every row for the rider (including SYSTEM flows)', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    // Submit one top-up.
    await api('/api/transaction/topup', {
      method: 'POST',
      token,
      headers: { 'x-idempotency-key': uniqueKey('all-topup') },
      json: {
        amount: 250,
        purpose: 'TOP_UP',
        method: 'UPI',
        upiRef: `H6-ALL-${Date.now()}`,
      },
    });

    const histRes = await api('/api/transaction/history?audience=ALL&limit=50', { token });
    expect(histRes.status).toBe(200);
    expect(histRes.body.success).toBe(true);
    const txns = histRes.body.data.transactions as Array<{ purpose: string }>;
    // The top-up we just created should be present.
    expect(txns.some((t) => t.purpose === 'SECURITY_DEPOSIT' || t.purpose === 'TOP_UP')).toBe(true);
  });

  it('?audience=SYSTEM excludes the rider\'s own top-ups', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    // Submit a USER row.
    await api('/api/transaction/topup', {
      method: 'POST',
      token,
      headers: { 'x-idempotency-key': uniqueKey('sys-topup') },
      json: {
        amount: 100,
        purpose: 'TOP_UP',
        method: 'UPI',
        upiRef: `H6-SYS-${Date.now()}`,
      },
    });

    // SYSTEM filter → the top-up should NOT appear (it has USER audience).
    const histRes = await api('/api/transaction/history?audience=SYSTEM&limit=50', { token });
    expect(histRes.status).toBe(200);
    expect(histRes.body.success).toBe(true);
    const txns = histRes.body.data.transactions as Array<{ purpose: string }>;
    const userOnly = txns.filter(
      (t) => t.purpose === 'TOP_UP' || t.purpose === 'SECURITY_DEPOSIT'
    );
    expect(userOnly).toHaveLength(0);
  });

  it('invalid audience string falls back to USER (safe default)', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    await api('/api/transaction/topup', {
      method: 'POST',
      token,
      headers: { 'x-idempotency-key': uniqueKey('garbage-topup') },
      json: {
        amount: 75,
        purpose: 'TOP_UP',
        method: 'UPI',
        upiRef: `H6-INVALID-${Date.now()}`,
      },
    });

    const histRes = await api('/api/transaction/history?audience=GARBAGE&limit=50', { token });
    expect(histRes.status).toBe(200);
    expect(histRes.body.success).toBe(true);
    // The top-up should still be visible (USER default).
    const txns = histRes.body.data.transactions as Array<{ purpose: string }>;
    expect(txns.some((t) => t.purpose === 'SECURITY_DEPOSIT' || t.purpose === 'TOP_UP')).toBe(true);
  });
});
